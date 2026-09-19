'use client';

// The dot field's GPU half. The trick that makes a "grid of dots" cheap: no
// dot is ever drawn as an object. Instead every pixel figures out which grid
// cell it lives in, where it sits relative to that cell's (ripple-displaced)
// dot center, and shades itself dot-colored or transparent from there: by
// distance to the edge for a built-in mark, or by a read from a decoded
// texture for a custom SVG mark. All sizing props are in real pixels, so
// the shader also tracks the canvas resolution to convert between pixels
// and cell units.
import { useEffect, useMemo } from 'react';

import type { ShaderNodeObject } from 'three/tsl';
import {
  abs,
  exp,
  float,
  length,
  log2,
  max,
  modInt,
  round,
  select,
  sin,
  smoothstep,
  step,
  texture,
  uint,
  uniform,
  uv,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import type { Node, TextureNode } from 'three/webgpu';
import { Mesh, MeshBasicNodeMaterial, PlaneGeometry, Vector2 } from 'three/webgpu';

import {
  displace,
  signedDistanceFieldCircle,
  signedDistanceFieldCross,
  stableHashUint,
  type TSLNode,
} from '../../engine.js';
import { decodeMarkAtlas, getMarkAtlasPlaceholder } from '../../primitives/mark-atlas/atlas.js';
import {
  MARK_TILE_MAX_MIP_LEVEL,
  MARK_TILE_PADDING,
  MARK_TILE_SIZE,
  type MarkTile,
  type MarkTilePlan,
  planMarkTiles,
} from '../../primitives/mark-atlas/plan.js';
import type { AnimatableProp } from '../../react/hooks/animatable-signal/animatable-signal.js';
import { useAnimatablePoint } from '../../react/hooks/use-animatable-point/use-animatable-point.js';
import { useAnimatableSpeed } from '../../react/hooks/use-animatable-speed/use-animatable-speed.js';
import { useAnimatableUniform } from '../../react/hooks/use-animatable-uniform/use-animatable-uniform.js';
import { type ResizeValue, useResize } from '../../react/hooks/use-resize/use-resize.js';
import { useShaderContext } from '../../react/hooks/use-shader-context/use-shader-context.js';
import { parseColor } from '../shared/color.js';
import { type DotShape, resolveMarkEntries } from './marks.js';

export type { DotShape } from './marks.js';

export interface DotFieldShaderProps {
  /**
   * The mark at each grid point, or a list of marks the field scatters
   * across the grid. `'circle'` is a disk and `'cross'` is an x with
   * flat-ended arms, and `{ svg }` is a custom mark from inline SVG markup,
   * scaled so its `viewBox` fits `dotSize` on its longer side. Only the
   * markup's alpha is read, so its fills are ignored and every mark takes
   * `color`. `dotSize` is the mark's overall size in every case. With a
   * list, each cell draws one entry, chosen by a hash of its cell index, so
   * the pick holds still from frame to frame, and names and `{ svg }`
   * objects mix freely. A mark listed more than once is drawn that many
   * times as often: `['cross', { svg: star }, { svg: star }]` is a confetti
   * of crosses and about twice as many stars. A change rebuilds the shader.
   */
  shape: DotShape | readonly DotShape[];
  /** Grid cell size in pixels. Accepts a static value or an animation signal. */
  spacing: AnimatableProp<number>;
  /**
   * Mark size in pixels: the diameter of a circle, the width of a cross
   * from tip to tip, or the longer side of a custom mark's `viewBox`.
   * Accepts a static value or an animation signal.
   */
  dotSize: AnimatableProp<number>;
  /** Dot color — hex, `oklch()`, or `oklab()`. */
  color: string;
  /**
   * Ripple travel speed (rings expand faster as this grows). Accepts a static
   * value or an animation signal.
   */
  speed: AnimatableProp<number>;
  /**
   * Peak radial displacement, as a fraction of `spacing` (≈0–0.9). 0 = a
   * static grid. Accepts a static value or an animation signal.
   */
  amplitude: AnimatableProp<number>;
  /**
   * Distance between wave crests, in pixels. Accepts a static value or an
   * animation signal.
   */
  wavelength: AnimatableProp<number>;
  /**
   * How quickly ripples decay with distance from `center`. 0 = no decay
   * (uniform field). Accepts a static value or an animation signal.
   */
  decay: AnimatableProp<number>;
  /**
   * Ripple origin, 0..1 across the canvas; `[0.5, 0.5]` is centered and
   * `[0, 0]` is the top-left corner. Accepts a static value or an animation
   * signal.
   */
  center: AnimatableProp<readonly [number, number]>;
}

// ---------------------------------------------
// Constants
// ---------------------------------------------
// How thick a cross's arms are, as a fraction of `dotSize`. Measured from
// the Figma pattern the Components banner is drawn after: arms 2.01 units
// thick on a mark 6.34 units tip to tip. Higher makes a bolder x. At
// 1 / sqrt(2), about 0.71, the arms are as long as they are thick and the
// x closes into a diamond, a square tipped 45 degrees whose corners sit at
// the mark's tips. Past that the arms are thicker than they are long.
const CROSS_ARM_THICKNESS = 0.317;

// Width of the anti-aliasing band across a mark's edge, in device pixels,
// on each side of the rim. Measured in pixels rather than as a fraction of
// the cell, so a mark on a tight grid stays as smooth as one on a wide
// grid: a fraction of a 6px cell is no band at all, and every device pixel
// then samples the mark hard in-or-out, which drew different pixel patterns
// on marks that sat at different sub-pixel positions. Wider softens every
// edge into a blur; narrower stair-steps it. 0.7 is under one pixel, so
// the fade stays within about a pixel of the rim on either side. Same
// figure as LedWall's rim.
const RIM_SOFTNESS_PX = 0.7;

// Shifts a cell index positive before it is hashed. The grid is anchored
// to the canvas center, so half the cells have a negative index, and
// stableHashUint converts its seed to u32, where a negative float is
// backend-defined. 2^20 absorbs indices down to about a million cells
// left of or below center, which even at a 1px spacing is a canvas two
// million pixels wide, and a shifted index stays an exact float, since
// f32 holds every integer below 2^24. Voronoi and metaballs use 512 for
// the same job, because their cell counts are bounded by a scale prop;
// here spacing has no floor, so the margin is wider.
const HASH_DOMAIN_OFFSET = 2 ** 20;

// Everything the material bakes in or reads from a uniform, named so a call
// site reads as a record rather than a positional list: the uniforms are
// all typed alike, and a swapped pair of them would typecheck fine while
// drawing garbage.
interface DotFieldMaterialInputs {
  /**
   * The marks to scatter, in order. One entry is the plain single-mark
   * field, and none draws nothing.
   */
  entries: readonly DotShape[];
  /**
   * Where each custom mark sits in the atlas. Baked in with the entries:
   * the rectangles are compile-time constants in the shader.
   */
  plan: MarkTilePlan;
  /**
   * The atlas as a texture node. Stable for the mount, and the component
   * swaps the texture behind it when a decode lands, so the node is a
   * uniform in all but name.
   */
  atlasNode: ShaderNodeObject<TextureNode>;
  spacingUniform: TSLNode;
  dprUniform: TSLNode;
  dotSizeUniform: TSLNode;
  phaseUniform: TSLNode;
  amplitudeUniform: TSLNode;
  wavelengthUniform: TSLNode;
  decayUniform: TSLNode;
  centerUniform: TSLNode;
  resUniform: TSLNode;
  /** Linear rgb, already decoded from the color string. */
  color: readonly [number, number, number];
}

function buildDotFieldMaterial({
  entries,
  plan,
  atlasNode,
  spacingUniform,
  dprUniform,
  dotSizeUniform,
  phaseUniform,
  amplitudeUniform,
  wavelengthUniform,
  decayUniform,
  centerUniform,
  resUniform,
  color,
}: DotFieldMaterialInputs): MeshBasicNodeMaterial {
  const [redChannel, greenChannel, blueChannel] = color;

  // ---------------------------------------------
  // Carve the canvas into grid cells
  // ---------------------------------------------
  // Convert the pixel's uv (0..1) into "cell space": center it (so the grid
  // is anchored to the middle of the canvas), scale by the resolution to get
  // real pixels, then divide by spacing so one unit = one grid cell.
  // round() gives the whole-number id of the nearest cell — every pixel in a
  // cell shares it — and subtracting it leaves the pixel's position within
  // its cell (-0.5..0.5, with 0 at the dot center).
  const cellCoord = uv().sub(0.5).mul(resUniform).div(spacingUniform);
  const cellIndex = round(cellCoord);
  const cellLocal = cellCoord.sub(cellIndex);

  // ---------------------------------------------
  // The ripple: a traveling wave radiating from center
  // ---------------------------------------------
  // Ripple origin snapped to the nearest dot, in the same integer lattice space
  // as the cells. vec2(0).add(centerUniform) lifts the bare uniform into a node
  // receiver so the chain stays safe (the vec-uniform-as-receiver gotcha —
  // chaining directly off a vec uniform silently produces wrong GPU values).
  const originIndex = round(
    vec2(0, 0).add(centerUniform).sub(0.5).mul(resUniform).div(spacingUniform),
  );

  // Vector from the origin dot to this dot, in cell units (isotropic, square cells).
  const toCell = cellIndex.sub(originIndex);
  const distCells = length(toCell);
  // +0.001 avoids div-by-zero for the dot sitting exactly on the ripple origin
  const dirFromCenter = toCell.div(distCells.add(0.001));
  const distToCenterPx = distCells.mul(spacingUniform);

  // Traveling wave: crests move outward as the phase grows. Distance over
  // wavelength counts how many crests fit between here and the origin;
  // subtracting the accumulated phase (speed x delta summed on the CPU each
  // frame, so a speed change shifts the ripple tempo without snapping it)
  // slides the whole pattern outward; sin() over that (scaled to a full
  // circle per crest) turns it into a smooth push/pull between -1 and 1.
  // Because the wave is evaluated per DOT (from cellIndex, not per pixel),
  // each dot moves as one rigid piece.
  const phase = distToCenterPx.div(wavelengthUniform).sub(phaseUniform);
  const wave = sin(phase.mul(Math.PI * 2));

  // Fade the wave with distance so the ripple settles toward the edges.
  // Distance is measured in half-diagonals of the canvas (0 at center, ~1 in
  // the far corners); exp(-distance * decay) starts at full strength and
  // dies off exponentially — decay 0 disables the fade entirely.
  const distNorm = distToCenterPx.div(length(resUniform).mul(0.5));
  const falloff = exp(distNorm.mul(decayUniform).mul(-1));

  // Push each dot radially by the (faded) wave, in cell-local units. The
  // offset is NEGATED because moving the sampling point one way renders the
  // shape the opposite way (displace() adds to the sample position; see the
  // SDF caveat in the engine's displace primitive).
  const offset = dirFromCenter.mul(wave).mul(amplitudeUniform).mul(falloff);
  const displacedLocal = displace(cellLocal, offset.mul(-1));

  // ---------------------------------------------
  // The mark: a circle, an x, or a custom SVG, sized by dotSize
  // ---------------------------------------------
  // Half the mark's size converted from pixels into cell units (one cell =
  // `spacing` pixels): dotSize / (spacing * 2). For a circle that is its
  // radius, so `dotSize` lands on screen as the diameter; for a cross it is
  // half the bounding box, so `dotSize` lands as the width tip to tip.
  // zeroScalar is another lift-the-uniform trick: starting the chain from a
  // plain node keeps the scalar uniforms in argument position.
  const zeroScalar = vec2(0).x;
  const halfSize = zeroScalar.add(dotSizeUniform).div(zeroScalar.add(spacingUniform).mul(2));

  // The band converted into cell units, the sdf's units: a cell is
  // `spacing` CSS pixels, or `spacing` times the pixel ratio device pixels,
  // so dividing the band by that is its width as a fraction of a cell.
  const cellDevicePixels = zeroScalar.add(spacingUniform).mul(dprUniform);
  const antialiasWidth = zeroScalar.add(RIM_SOFTNESS_PX).div(cellDevicePixels);

  // Coverage of one built-in mark at this pixel. Signed distance to the
  // mark's edge is negative inside, positive outside, zero exactly on the
  // rim, and the shape is baked into the compiled shader, so choosing it
  // here costs nothing per pixel. smoothstep ramps from 0 at the inner edge
  // to 1 at the outer edge of the band, so oneMinus flips it: pixels deeper
  // inside the rim than the band get 1, pixels further outside get 0, and
  // the band across the rim fades smoothly — that fade is the anti-aliasing
  // that keeps mark edges from stair-stepping.
  const builtInMask = (shape: 'circle' | 'cross'): TSLNode => {
    const sdf =
      shape === 'cross'
        ? signedDistanceFieldCross(displacedLocal, ...crossArms(halfSize))
        : signedDistanceFieldCircle(displacedLocal, halfSize);

    return smoothstep(antialiasWidth.negate(), antialiasWidth, sdf).oneMinus();
  };

  // Coverage of one custom mark: read from the atlas instead of computed
  // from a distance. The mark's box is `dotSize` wide in pixels, which is
  // 2 * halfSize in cell units, so dividing the displaced point by that and
  // adding 0.5 gives the point's position across the box, 0..1 on each
  // axis with (0, 0) at the bottom-left corner. From there the point is
  // mapped into the tile's rectangle in the atlas, in device pixels from
  // the atlas's top-left, and divided by the atlas size to get the 0..1
  // texture coordinate the sampler wants. The y flip is because uv space
  // grows upward while canvas rows count downward: the top of the box is
  // the top of the rectangle, which is its smallest y. The read returns the
  // canvas's rgba at that coordinate, and only the alpha is kept: a filled
  // pixel of the SVG is 1, a blank one is 0, and the browser's rasterizer
  // plus the texture filter fade the edge between them, which is the
  // anti-aliasing a custom mark gets in place of the smoothstep.
  //
  // The mip level is chosen here rather than left to the GPU. A mipmap is
  // a pyramid of half-size copies of the atlas, and the sampler normally
  // picks the copy whose texels are about one screen pixel wide from how
  // fast the texture coordinate changes between neighboring pixels. That
  // guess is what a 2x2 pixel quad straddling a branch gets wrong, and it
  // has no way to know the atlas's gutter. Here the ratio is known: the
  // mark's rectangle is `inner` device pixels wide in the atlas and
  // `dotSize` times the pixel ratio on screen, and their log2 is the level
  // where one texel covers one pixel. Clamping it at the gutter's level
  // keeps every read from blending in a neighboring mark, which the
  // padding comment in plan.ts works through; a mark smaller than that
  // level's texel count is minified from it and shimmers a little as it
  // moves, rather than picking up its neighbors. The device-pixel size is
  // held off zero by an epsilon so a `dotSize` of 0, which an animation
  // signal can pass through, gives a finite level and a finite point
  // rather than NaN.
  //
  // Outside the box the mapping would land in a neighboring tile, so the
  // read is gated to the box: the farthest a coordinate is from the box's
  // center on either axis is over 0.5 exactly when it is outside, and step
  // turns that into a 0-or-1 factor. A multiply rather than select, so the
  // read stays in straight-line code with no branch around it. Every pixel
  // off the cell's exact center at size 0 lands far outside the box and
  // gates to 0; a pixel sitting exactly on it reads the mark's center
  // texel, much as a built-in mark at size 0 still shades its center pixel
  // through the anti-aliasing band.
  const inner = MARK_TILE_SIZE - MARK_TILE_PADDING * 2;
  const boxDevicePixels = zeroScalar.add(dotSizeUniform).mul(dprUniform).max(1e-6);
  const atlasLevel = log2(float(inner).div(boxDevicePixels)).clamp(0, MARK_TILE_MAX_MIP_LEVEL);
  const customMask = (tile: MarkTile | null): TSLNode => {
    if (tile === null) return float(0);

    const { rect } = tile;
    const boxPoint = displacedLocal.div(halfSize.mul(2).max(1e-6)).add(0.5);
    const atlasUv = vec2(
      boxPoint.x.mul(rect.width).add(rect.x),
      boxPoint.y.oneMinus().mul(rect.height).add(rect.y),
    ).div(vec2(plan.width, plan.height));
    // A read node with this tile's coordinate and the clamped level. Its
    // texture argument is only a placeholder for construction: pointing
    // its referenceNode at the shared atlas node makes it read whatever
    // texture that node holds, which is how three's own uv() and level()
    // chains share one texture, and it is what lets the decode swap the
    // atlas in behind every tile's read at once.
    const read = texture(getMarkAtlasPlaceholder(), atlasUv, atlasLevel);

    read.referenceNode = atlasNode;

    const alpha = read.a;
    const fromBoxCenter = abs(boxPoint.sub(0.5));
    const insideBox = step(max(fromBoxCenter.x, fromBoxCenter.y), 0.5);

    return alpha.mul(insideBox);
  };

  // The custom entries were planned in order, so the plan's tiles line up
  // with them by markup, and a markup with no usable box has no tile.
  const tileByMarkup = new Map(plan.tiles.map((tile) => [tile.markup, tile]));
  const markMask = (shape: DotShape): TSLNode =>
    typeof shape === 'string'
      ? builtInMask(shape)
      : customMask(tileByMarkup.get(shape.svg) ?? null);

  // ---------------------------------------------
  // The pick: which entry this cell draws
  // ---------------------------------------------
  const dotMask = pickMarkMask(entries, cellIndex, markMask);

  const material = new MeshBasicNodeMaterial();

  // Alpha carries the dot mask, so the space between dots is transparent and
  // whatever rendered beneath this layer shows through. `transparent` opts
  // the material into GPU alpha blending — without it three ignores fragment
  // alpha and this quad would overwrite any layer stacked beneath it in the
  // scene. The blend already multiplies the color by alpha, so the color
  // rides at full strength here; premultiplying it by the mask as well would
  // darken the anti-aliased rim twice.
  material.transparent = true;
  material.colorNode = vec4(vec3(redChannel, greenChannel, blueChannel), dotMask);

  return material;
}

/**
 * The cross's two arm measures from half its bounding box, both in cell
 * units. The arms are rotated 45 degrees, so the tip's outer corner sits at
 * (armHalfLength + armHalfThickness) along a diagonal, and that reaches the
 * box's edge when the sum is halfSize times sqrt(2). The thickness comes
 * straight from the fraction, and the length is what the sum leaves over.
 */
function crossArms(
  halfSize: ShaderNodeObject<Node>,
): [ShaderNodeObject<Node>, ShaderNodeObject<Node>] {
  const armHalfThickness = halfSize.mul(CROSS_ARM_THICKNESS);
  const armHalfLength = halfSize.mul(Math.SQRT2).sub(armHalfThickness);

  return [armHalfLength, armHalfThickness];
}

/**
 * The coverage this pixel's cell draws, given the entry list. One entry is
 * the plain field: its mask and nothing else, so the compiled shader is the
 * same graph it was before lists existed. No entries draws nothing. Two or
 * more hash the cell index into a pick and select that entry's mask.
 */
function pickMarkMask(
  entries: readonly DotShape[],
  cellIndex: ShaderNodeObject<Node>,
  markMask: (shape: DotShape) => TSLNode,
): TSLNode {
  const lastEntry = entries[entries.length - 1];

  if (lastEntry === undefined) return float(0);
  if (entries.length === 1) return markMask(lastEntry);

  // One mask per distinct mark, shared by every entry that names it. Two
  // 'cross' entries evaluate the cross distance once, and only the pick
  // below decides which cells draw it. Keyed by the mark's content, so two
  // custom entries with the same markup share a mask whatever objects
  // carry it.
  const maskByShape = new Map<string, TSLNode>();
  const maskFor = (shape: DotShape): TSLNode => {
    const shapeKey = typeof shape === 'string' ? shape : `svg:${shape.svg}`;
    const cached = maskByShape.get(shapeKey);

    if (cached !== undefined) return cached;

    const mask = markMask(shape);

    maskByShape.set(shapeKey, mask);

    return mask;
  };

  // The per-cell pick. Shift the index positive, hash the row, add the
  // column, hash the sum: LedWall's seed, one u32 word per cell, chained
  // in u32 the whole way so both backends agree on it (the seeded-randomness
  // gotcha). The modulo, also in u32, turns that word into an index into the
  // list. A good hash spreads its words evenly, so every index is equally
  // likely, and an entry listed twice therefore owns two indices and is
  // picked twice as often. That is the whole weighting mechanism. toVar
  // stores the pick in a GPU variable so the chain below reads it back
  // rather than re-running the hash once per entry.
  const shifted = cellIndex.add(HASH_DOMAIN_OFFSET);
  const cellSeed = stableHashUint(shifted.x.toUint().add(stableHashUint(shifted.y.toUint())));
  const pick = modInt(cellSeed, uint(entries.length)).toVar();

  // Select by the pick, wrapping outward from the last entry: it is the
  // innermost fallback, and each earlier entry adds one select around what
  // is already there. Every level references the pick once, its own mask
  // once, and the level inside it once, so the graph grows linearly with
  // the entry count. The exponential-select gotcha is about a running
  // accumulator that references ITSELF twice per step, which this chain
  // never does.
  let mask = maskFor(lastEntry);

  for (let index = entries.length - 2; index >= 0; index -= 1) {
    const entry = entries[index];

    if (entry !== undefined) mask = select(pick.equal(uint(index)), maskFor(entry), mask);
  }

  return mask;
}

export function DotFieldShader({
  shape,
  spacing,
  dotSize,
  color,
  speed,
  amplitude,
  wavelength,
  decay,
  center,
}: DotFieldShaderProps) {
  const shaderContext = useShaderContext();
  const resize = useResize();

  // The shape prop flattened to the entry list the builder bakes in, plus a
  // string key that stands in for it in the material effect's deps: an
  // inline array literal in JSX is a new reference on every parent render,
  // so depending on the array itself would rebuild the shader each time
  // the parent rendered (the AGENTS.md gotcha on array props in effect
  // deps). Cheap enough to redo per render.
  const { entries, key: shapeKey } = resolveMarkEntries(shape);

  // The atlas layout for the custom entries, redone only when the list
  // changes. Keyed on shapeKey rather than entries for the same reason the
  // material effect is, so a parent re-render leaves it alone.
  const plan = useMemo(
    () => planMarkTiles(entries.flatMap((entry) => (typeof entry === 'string' ? [] : [entry.svg]))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [shapeKey],
  );

  // The texture node the shader samples custom marks from. Made once per
  // mount around the shared transparent placeholder, so the material can
  // depend on it like a uniform; the decode effect below swaps the
  // texture behind it. The swap, not a resize: three creates the GPU
  // image for an ordinary texture once and never grows it, so a bigger
  // image on the same texture would be uploaded into the one-pixel slot.
  const atlasNode = useMemo(() => texture(getMarkAtlasPlaceholder()), []);

  // The decode, once per distinct list per mount. Nothing here runs per
  // frame or per resize, and a change to the markup lands as a new
  // shapeKey, which cancels the decode in flight, decodes again, and
  // rebuilds the material below with the new plan. The atlas a run
  // installs is its own to dispose, so the cleanup puts the placeholder
  // back first, and a decode that resolves after its cleanup ran disposes
  // its result instead of installing it. The poke after the swap is the
  // bare-uniform-write gotcha: a static field has parked its frame loop by
  // the time the browser finishes, so without it the triangles would sit
  // decoded on the GPU and unseen until something else asked for a frame.
  useEffect(() => {
    if (plan.tiles.length === 0) return;

    let cancelled = false;

    decodeMarkAtlas(plan)
      .then((atlas) => {
        if (cancelled) {
          atlas.dispose();

          return;
        }

        atlasNode.value = atlas;
        shaderContext?.scheduler.requestRender();
      })
      .catch(() => {
        // A mark the browser cannot decode leaves its cells on the
        // placeholder. The warning for it is the next ticket's.
      });

    return () => {
      cancelled = true;

      const installed = atlasNode.value;

      atlasNode.value = getMarkAtlasPlaceholder();
      if (installed !== getMarkAtlasPlaceholder()) installed.dispose();
      shaderContext?.scheduler.requestRender();
    };
  }, [plan, atlasNode, shaderContext]);

  // The animated dials live in uniforms (values the CPU can update each
  // frame without rebuilding the shader), tracking either a static number or
  // an animation signal. Speed is the exception: useAnimatableSpeed
  // integrates it into a phase uniform (speed x delta summed each frame), so
  // a speed change shifts the ripple tempo without snapping the pattern.
  const spacingUniform = useAnimatableUniform<number>(spacing);
  const dotSizeUniform = useAnimatableUniform<number>(dotSize);
  const phaseUniform = useAnimatableSpeed(speed);
  const amplitudeUniform = useAnimatableUniform<number>(amplitude);
  const wavelengthUniform = useAnimatableUniform<number>(wavelength);
  const decayUniform = useAnimatableUniform<number>(decay);

  // Decoded to linear rgb once per color string. The channels get baked into
  // the compiled shader as constants, which is why a color change is one of
  // the three things (with a context or shape change) that rebuild the
  // material below.
  const parsedColor = useMemo(() => parseColor(color), [color]);

  // screenOrigin converts the prop's screen-style coordinates (y grows
  // downward, [0, 0] top-left, like CSS) into uv space, where v
  // grows upward — without it, moving the center "down" would move the
  // ripples up.
  const centerUniform = useAnimatablePoint(center, { screenOrigin: true });

  // The canvas resolution in pixels, needed because spacing/dotSize/
  // wavelength are pixel-valued props. Starts at a 1920x1080 placeholder
  // until the first real measurement lands.
  const resVec = useMemo(() => new Vector2(1920, 1080), []);
  const resUniform = useMemo(() => uniform(resVec), [resVec]);

  // The device pixels per CSS pixel, so the anti-aliasing band can be sized
  // in device pixels. The renderer's own ratio (which respects any maxDPR
  // clamp) is the truth once it exists, and the resize signal's reading
  // stands in until then. Created once and written into below, so the
  // material effect can depend on the stable wrapper.
  const dprUniform = useMemo(
    () => uniform(resize.get()[2] || 1),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Each write is followed by a scheduler poke: a bare write into the
  // Vector2 or the ratio repaints nothing on a static scene, the trap
  // useAspectUniform exists for. The zero guard skips a collapsed canvas.
  useEffect(() => {
    const scheduler = shaderContext?.scheduler;
    const write = ([width, height, dpr]: ResizeValue) => {
      const rendererRatio = shaderContext?.renderer.three.getPixelRatio();

      dprUniform.value =
        rendererRatio !== undefined && rendererRatio > 0 ? rendererRatio : dpr || 1;
      if (width > 0 && height > 0) resVec.set(width, height);
      scheduler?.requestRender();
    };

    write(resize.get());

    return resize.on('change', write);
  }, [shaderContext, resize, resVec, dprUniform]);

  // ---------------------------------------------
  // Build the material and mount the mesh
  // ---------------------------------------------
  // The 2x2 plane exactly fills ShaderScene's camera view. All the dial
  // uniforms and the atlas node are stable references, so in practice this
  // runs once per mount and again only when the color string or the mark
  // list changes. A decode landing is not a rebuild: it swaps the texture
  // behind the node the compiled shader already reads.
  useEffect(() => {
    if (!shaderContext) return;

    const material = buildDotFieldMaterial({
      entries,
      plan,
      atlasNode,
      spacingUniform,
      dprUniform,
      dotSizeUniform,
      phaseUniform,
      amplitudeUniform,
      wavelengthUniform,
      decayUniform,
      centerUniform,
      resUniform,
      color: parsedColor,
    });
    const mesh = new Mesh(new PlaneGeometry(2, 2), material);

    shaderContext.scene.add(mesh);

    return () => {
      shaderContext.scene.remove(mesh);
      try {
        material.dispose();
      } catch {
        /* benign during rebuild */
      }
      try {
        mesh.geometry.dispose();
      } catch {
        /* same */
      }
    };
    // shapeKey stands in for entries: the two come from one call, and the
    // key changes exactly when the list's contents do. plan is keyed on it
    // too, so listing both is one rebuild, not two.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    shaderContext,
    shapeKey,
    plan,
    atlasNode,
    parsedColor,
    spacingUniform,
    dprUniform,
    dotSizeUniform,
    phaseUniform,
    amplitudeUniform,
    wavelengthUniform,
    decayUniform,
    centerUniform,
    resUniform,
  ]);

  return null;
}

'use client';

// The dot field's GPU half. The trick that makes a "grid of dots" cheap: no
// dot is ever drawn as an object. Instead every pixel figures out which grid
// cell it lives in, how far it sits from that cell's (ripple-displaced) dot
// center, and shades itself dot-colored or transparent based on that
// distance. All sizing props are in real pixels, so the shader also tracks
// the canvas resolution to convert between pixels and cell units.
import { useEffect, useMemo } from 'react';

import type { ShaderNodeObject } from 'three/tsl';
import { exp, length, round, sin, smoothstep, uniform, uv, vec2, vec3, vec4 } from 'three/tsl';
import type { Node } from 'three/webgpu';
import { Mesh, MeshBasicNodeMaterial, PlaneGeometry, Vector2 } from 'three/webgpu';

import {
  displace,
  signedDistanceFieldCircle,
  signedDistanceFieldCross,
  type TSLNode,
} from '../../engine.js';
import type { AnimatableProp } from '../../react/hooks/animatable-signal/animatable-signal.js';
import { useAnimatablePoint } from '../../react/hooks/use-animatable-point/use-animatable-point.js';
import { useAnimatableSpeed } from '../../react/hooks/use-animatable-speed/use-animatable-speed.js';
import { useAnimatableUniform } from '../../react/hooks/use-animatable-uniform/use-animatable-uniform.js';
import { type ResizeValue, useResize } from '../../react/hooks/use-resize/use-resize.js';
import { useShaderContext } from '../../react/hooks/use-shader-context/use-shader-context.js';
import { parseColor } from '../shared/color.js';

/** The marks the field can draw at each grid point. */
export type DotShape = 'circle' | 'cross';

export interface DotFieldShaderProps {
  /**
   * The mark drawn at each grid point. `'circle'` is a disk and `'cross'` is
   * an x with flat-ended arms. `dotSize` is the mark's overall size for both.
   */
  shape: DotShape;
  /** Grid cell size in pixels. Accepts a static value or an animation signal. */
  spacing: AnimatableProp<number>;
  /**
   * Mark size in pixels: the diameter of a circle, or the width of a cross
   * from tip to tip. Accepts a static value or an animation signal.
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

function buildDotFieldMaterial(
  shape: DotShape,
  spacingUniform: TSLNode,
  dprUniform: TSLNode,
  dotSizeUniform: TSLNode,
  phaseUniform: TSLNode,
  amplitudeUniform: TSLNode,
  wavelengthUniform: TSLNode,
  decayUniform: TSLNode,
  centerUniform: TSLNode,
  resUniform: TSLNode,
  color: readonly [number, number, number],
): MeshBasicNodeMaterial {
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
  // The mark: a circle or an x, sized by dotSize
  // ---------------------------------------------
  // Half the mark's size converted from pixels into cell units (one cell =
  // `spacing` pixels): dotSize / (spacing * 2). For a circle that is its
  // radius, so `dotSize` lands on screen as the diameter; for a cross it is
  // half the bounding box, so `dotSize` lands as the width tip to tip.
  // zeroScalar is another lift-the-uniform trick: starting the chain from a
  // plain node keeps the scalar uniforms in argument position.
  const zeroScalar = vec2(0).x;
  const halfSize = zeroScalar.add(dotSizeUniform).div(zeroScalar.add(spacingUniform).mul(2));

  // Signed distance to the mark's edge: negative inside, positive outside,
  // zero exactly on the rim. The shape is baked into the compiled shader,
  // so choosing here costs nothing per pixel.
  const sdf =
    shape === 'cross'
      ? signedDistanceFieldCross(displacedLocal, ...crossArms(halfSize))
      : signedDistanceFieldCircle(displacedLocal, halfSize);

  // The band converted into cell units, the sdf's units: a cell is
  // `spacing` CSS pixels, or `spacing` times the pixel ratio device pixels,
  // so dividing the band by that is its width as a fraction of a cell.
  const cellDevicePixels = zeroScalar.add(spacingUniform).mul(dprUniform);
  const antialiasWidth = zeroScalar.add(RIM_SOFTNESS_PX).div(cellDevicePixels);

  // smoothstep ramps from 0 at the inner edge to 1 at the outer edge of
  // the band, so oneMinus flips it: pixels deeper inside the rim than the
  // band get 1, pixels further outside get 0, and the band across the rim
  // fades smoothly — that fade is the anti-aliasing that keeps mark edges
  // from stair-stepping.
  const dotMask = smoothstep(antialiasWidth.negate(), antialiasWidth, sdf).oneMinus();

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
  // uniforms are stable references, so in practice this runs once per mount
  // and again only when the color string or the shape changes.
  useEffect(() => {
    if (!shaderContext) return;

    const material = buildDotFieldMaterial(
      shape,
      spacingUniform,
      dprUniform,
      dotSizeUniform,
      phaseUniform,
      amplitudeUniform,
      wavelengthUniform,
      decayUniform,
      centerUniform,
      resUniform,
      parsedColor,
    );
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
  }, [
    shaderContext,
    shape,
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

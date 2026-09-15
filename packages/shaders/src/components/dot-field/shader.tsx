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
// thick on a mark 6.34 units tip to tip. Higher makes a bolder x, and at 1
// the arms are as wide as the mark and the x closes into a square.
const CROSS_ARM_THICKNESS = 0.317;

function buildDotFieldMaterial(
  shape: DotShape,
  spacingUniform: TSLNode,
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

  // smoothstep with its edges REVERSED (high to low) flips the ramp: pixels
  // deeper than 0.01 inside the rim get 1, pixels past 0.01 outside get 0,
  // and the 0.02-cell band across the rim fades smoothly — that band is the
  // anti-aliasing that keeps mark edges from stair-stepping.
  const antialiasWidth = 0.01;
  const dotMask = smoothstep(antialiasWidth, -antialiasWidth, sdf);

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
  // the two things (with a context change) that rebuilds the material below.
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

  // Each write is followed by a scheduler poke: a bare write into the
  // Vector2 repaints nothing on a static scene, the trap useAspectUniform
  // exists for. The zero guard skips a collapsed canvas.
  useEffect(() => {
    const scheduler = shaderContext?.scheduler;
    const write = ([width, height]: ResizeValue) => {
      if (width <= 0 || height <= 0) return;
      resVec.set(width, height);
      scheduler?.requestRender();
    };

    write(resize.get());

    return resize.on('change', write);
  }, [shaderContext, resize, resVec]);

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

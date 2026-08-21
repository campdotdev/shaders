'use client';

// The dot field's GPU half. The trick that makes a "grid of dots" cheap: no
// dot is ever drawn as an object. Instead every pixel figures out which grid
// cell it lives in, how far it sits from that cell's (ripple-displaced) dot
// center, and shades itself dot-colored or transparent based on that
// distance. All sizing props are in real pixels, so the shader also tracks
// the canvas resolution to convert between pixels and cell units.
import { useEffect, useMemo } from 'react';

import { displace, signedDistanceFieldCircle, type TSLNode } from '@camp-dev/shaders';
import {
  type AnimatableProp,
  useAnimatablePoint,
  useAnimatableSpeed,
  useAnimatableUniform,
  useResize,
  useShaderContext,
} from '@camp-dev/shaders-react';
import { exp, length, round, sin, smoothstep, uniform, uv, vec2, vec3, vec4 } from 'three/tsl';
import { Mesh, MeshBasicNodeMaterial, PlaneGeometry, Vector2 } from 'three/webgpu';

import { parseColor } from '../utils/color';

export interface DotFieldShaderProps {
  /** Grid cell size in pixels. Accepts a static value or an animation signal. */
  spacing: AnimatableProp<number>;
  /** Dot diameter in pixels. Accepts a static value or an animation signal. */
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

function buildDotFieldMaterial(
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

  // Dot radius converted from pixels into cell units (one cell = `spacing`
  // pixels): dotSize / (spacing * 2) — the /2 means `dotSize` lands on
  // screen as the dot's diameter. zeroScalar is another lift-the-uniform
  // trick: starting the chain from a plain node keeps the scalar uniforms in
  // argument position.
  const zeroScalar = vec2(0).x;
  const radius = zeroScalar.add(dotSizeUniform).div(zeroScalar.add(spacingUniform).mul(2));

  // Signed distance to the dot's edge: negative inside the circle, positive
  // outside, zero exactly on the rim.
  const sdf = signedDistanceFieldCircle(displacedLocal, radius);

  // smoothstep with its edges REVERSED (high to low) flips the ramp: pixels
  // deeper than 0.01 inside the rim get 1, pixels past 0.01 outside get 0,
  // and the 0.02-cell band across the rim fades smoothly — that band is the
  // anti-aliasing that keeps dot edges from stair-stepping.
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

export function DotFieldShader({
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

  useEffect(() => {
    const [canvasWidth, canvasHeight] = resize.get();

    if (canvasWidth > 0 && canvasHeight > 0) resVec.set(canvasWidth, canvasHeight);

    return resize.on('change', ([updatedWidth, updatedHeight]) =>
      resVec.set(updatedWidth, updatedHeight),
    );
  }, [resize, resVec]);

  // ---------------------------------------------
  // Build the material and mount the mesh
  // ---------------------------------------------
  // The 2x2 plane exactly fills ShaderScene's camera view. All the dial
  // uniforms are stable references, so in practice this runs once per mount
  // and again only when the color string changes.
  useEffect(() => {
    if (!shaderContext) return;

    const material = buildDotFieldMaterial(
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

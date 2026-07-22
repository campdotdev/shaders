'use client';

import { useEffect } from 'react';

import { colorRamp, type ColorSpace, elapsedTime } from '@lovo/matter';
import { type AnimatableProp, useAnimatableUniform, useShaderContext } from '@lovo/matter-react';
import {
  float,
  fract,
  max,
  mix,
  type ShaderNodeObject,
  sin,
  smoothstep,
  uv,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import { Mesh, MeshBasicNodeMaterial, type Node, PlaneGeometry } from 'three/webgpu';

import { parseColor, toColorRampStops } from '../utils/color';

/**
 * A single wave line. Each numeric field scales the matching global prop
 * for this line only; omit a field to use the global value as-is.
 */
interface WavesShaderLayer {
  /** Single color, or 2+ stops forming a gradient along the line — hex, `oklch()`, or `oklab()`. */
  color?: string | string[];
  /** This line's wave height. */
  amplitude?: number;
  /** This line's softness. */
  glow?: number;
  /** This line's brightness. */
  brightness?: number;
  /** This line's width. */
  thickness?: number;
}

export interface WavesShaderProps {
  /**
   * The wave lines to draw. Lines emit light additively — overlaps
   * brighten. The first line breathes deepest; later lines calm toward the
   * back.
   */
  layers: WavesShaderLayer[];
  /**
   * Wave height of the bundle, as a fraction of half the canvas height.
   * 0 = flat lines. Accepts a static value or an animation signal.
   */
  amplitude: AnimatableProp<number>;
  /**
   * Wave count across the canvas width, shared by every line. Accepts a
   * static value or an animation signal.
   */
  frequency: AnimatableProp<number>;
  /**
   * Drift rate of the wave motion, shared by every line. 0 freezes the
   * lines. Accepts a static value or an animation signal.
   */
  speed: AnimatableProp<number>;
  /**
   * Edge softness and halo reach, 0..1. 0 = a crisp ribbon with a tight
   * edge; 1 = a long luminous haze. Accepts a static value or an animation
   * signal.
   */
  glow: AnimatableProp<number>;
  /**
   * Light output of the lines, 0 = invisible, 1 = full. Dims uniformly
   * without changing apparent width. Accepts a static value or an
   * animation signal.
   */
  brightness: AnimatableProp<number>;
  /**
   * Master line width. Larger values give broader lines. Accepts a static
   * value or an animation signal.
   */
  thickness: AnimatableProp<number>;
  /**
   * Vertical shift applied to all lines, as a fraction of half the canvas
   * height. Positive lifts, negative drops. Accepts a static value or an
   * animation signal.
   */
  baseline: AnimatableProp<number>;
  /**
   * How restlessly lines weave apart and re-converge. 0 = a frozen braid
   * that scrolls as one. 1 gives a lively weave. Accepts a static value or
   * an animation signal.
   */
  braiding: AnimatableProp<number>;
  /**
   * Depth of the slow height pulse. 0 = steady heights, 1 = full swell
   * (lines double at the peak and flatten at the trough). Accepts a static
   * value or an animation signal.
   */
  breathing: AnimatableProp<number>;
  /**
   * How strongly lines fray wide at the ends. 0 = uniform width everywhere.
   * At 1.5 lines are 2.5× wider at full flare. Accepts a static value or an
   * animation signal.
   */
  flare: AnimatableProp<number>;
  /**
   * Distance from the focal point at which the fray reaches full width,
   * 0..1 canvas half-widths. Accepts a static value or an animation signal.
   */
  flareRadius: AnimatableProp<number>;
  /**
   * Rate the gradient slides along each line. 0 pins it to the canvas.
   * Accepts a static value or an animation signal.
   */
  colorDrift: AnimatableProp<number>;
  /** Interpolation space for gradient lines. */
  colorSpace: ColorSpace;
}

const DEFAULT_AMPLITUDE = 0.2;
const DEFAULT_GLOW = 0.5;
const DEFAULT_BRIGHTNESS = 1;
const DEFAULT_THICKNESS = 0.65;
const DEFAULT_LAYER_COLOR = '#ff6f6a';

// Half of the saturated body's height at thickness 1, in canvas units.
// Gate-tunable.
const BAND_HALF_WIDTH = 0.02;
// Keeps the divide finite at the spine, where distance is 0. Canvas units.
const SPINE_EPSILON = 1e-4;
// Falloff exponent at glow 0: a near-cliff edge. Gate-tunable.
const EXPONENT_CRISP = 6;
// Falloff exponent at glow 1: the laser's 1/distance haze. Gate-tunable.
const EXPONENT_HAZY = 1;

// Phase radians the shared wave scrolls per speed-scaled second. Gate-tunable.
const SCROLL_RATE = 2;
// Fixed phase gap between neighboring lines. Gate-tunable.
const LINE_STAGGER = 0.35;
// How fast the braid's phase spread grows per speed-scaled second, at
// braiding = 1. Gate-tunable.
const BRAID_RATE = 0.35;
// Phase gap between neighboring lines' height pulses, radians. Gate-tunable.
const PULSE_STAGGER = 0.35;
// Where the flare begins easing in, as a fraction of the focal
// radius. 0 = a continuous taper from the focal point outward (no dead
// zone), which stays smooth even at small radii. Gate-tunable.
const FLARE_START = 0;

export function WavesShader({
  layers,
  amplitude,
  frequency,
  speed,
  glow,
  brightness,
  thickness,
  baseline,
  braiding,
  breathing,
  flare: flareStrength,
  flareRadius,
  colorDrift,
  colorSpace,
}: WavesShaderProps) {
  const shaderContext = useShaderContext();

  const ampUniform = useAnimatableUniform<number>(amplitude);
  const freqUniform = useAnimatableUniform<number>(frequency);
  const speedUniform = useAnimatableUniform<number>(speed);
  const glowUniform = useAnimatableUniform<number>(glow);
  const brightnessUniform = useAnimatableUniform<number>(brightness);
  const thicknessUniform = useAnimatableUniform<number>(thickness);
  const baselineUniform = useAnimatableUniform<number>(baseline);
  const braidingUniform = useAnimatableUniform<number>(braiding);
  const breathingUniform = useAnimatableUniform<number>(breathing);
  const flareStrengthUniform = useAnimatableUniform<number>(flareStrength);
  const flareRadiusUniform = useAnimatableUniform<number>(flareRadius);
  const colorDriftUniform = useAnimatableUniform<number>(colorDrift);

  const layersKey = layers
    .map(
      (layer) =>
        `${Array.isArray(layer.color) ? layer.color.join(',') : (layer.color ?? '')}|${layer.amplitude ?? ''}|${layer.glow ?? ''}|${layer.brightness ?? ''}|${layer.thickness ?? ''}`,
    )
    .join('||');

  useEffect(() => {
    if (!shaderContext) return;

    const samplePosition = vec2(uv().x.mul(2).sub(1), uv().y.mul(2).sub(1));

    const yBase = samplePosition.y.add(baselineUniform);

    // One shared clock and one shared wave phase for every line — coherence
    // comes from the architecture, not from per-line tuning. frequency = full
    // wave cycles across the canvas width (x spans 2, so the PI factor makes
    // frequency 1 exactly one cycle).
    const time = elapsedTime.mul(speedUniform);
    const wavePhase = samplePosition.x.mul(freqUniform).mul(Math.PI).sub(time.mul(SCROLL_RATE));

    // Thickness flare with C1-smooth ends: smoothstep has zero slope at BOTH
    // endpoints, so the widening eases in at FLARE_START and eases out at the
    // radius with no visible crease (a pow+clamp curve Mach-banded there).
    // Squaring keeps the late-knee character. max() guards radius 0.
    const flareInput = samplePosition.x.abs().div(max(flareRadiusUniform, 0.05));
    const flareRamp = smoothstep(float(FLARE_START), float(1), flareInput);
    const flare = flareRamp.mul(flareRamp).mul(flareStrengthUniform).add(1);

    // Gradient sample coordinate, shared by all gradient lines: canvas x
    // drifted on the speed-scaled clock (speed 0 freezes gradients too),
    // then ping-pong wrapped (0→1→0) so a drifting gradient never shows a
    // seam. The half-period phase shift keeps stop 0 at the LEFT edge at
    // drift 0, matching LinearGradient's stop direction.
    const driftedX = uv().x.sub(time.mul(colorDriftUniform));
    const rampT = fract(driftedX.mul(0.5).add(0.5)).mul(2).sub(1).abs();

    let waveColor = vec3(0, 0, 0);

    for (const [layerIndex, layer] of layers.entries()) {
      // Globals are master controls. Per-layer values preserve relative
      // differences by scaling those globals against the component defaults.
      const ampValue =
        layer.amplitude === undefined
          ? ampUniform
          : ampUniform.mul(layer.amplitude / DEFAULT_AMPLITUDE);
      const glowValue =
        layer.glow === undefined ? glowUniform : glowUniform.mul(layer.glow / DEFAULT_GLOW);
      const brightnessValue =
        layer.brightness === undefined
          ? brightnessUniform
          : brightnessUniform.mul(layer.brightness / DEFAULT_BRIGHTNESS);
      const thicknessValue =
        layer.thickness === undefined
          ? thicknessUniform
          : thicknessUniform.mul(layer.thickness / DEFAULT_THICKNESS);

      const layerColor = layer.color ?? DEFAULT_LAYER_COLOR;

      let lineColor: ShaderNodeObject<Node>;

      if (Array.isArray(layerColor) && layerColor.length > 1) {
        const rampStops = toColorRampStops(layerColor.map((stopColor) => ({ color: stopColor })));

        lineColor = colorRamp(rampT, rampStops, colorSpace);
      } else {
        const singleColor = Array.isArray(layerColor)
          ? (layerColor[0] ?? DEFAULT_LAYER_COLOR)
          : layerColor;
        const [redChannel, greenChannel, blueChannel] = parseColor(singleColor);

        lineColor = vec3(redChannel, greenChannel, blueChannel);
      }

      // Per-line phase stagger with a time-growing term: at braiding 0 the
      // spread is frozen; above 0 it evolves, so lines periodically pass
      // through full convergence (spread ≡ 0 mod 2π) and fan back out.
      const lineStagger = braidingUniform
        .mul(BRAID_RATE)
        .mul(time)
        .add(LINE_STAGGER)
        .mul(layerIndex);
      const wave = sin(wavePhase.add(lineStagger));

      // Slow per-line height pulse. depthWeight fades the pulse toward the
      // back of the stack (last layers barely breathe), matching the
      // reference. The envelope swings amplitude between (1 − breathing) and
      // (1 + breathing) times its base value.
      const depthWeight = 1 - layerIndex / layers.length;
      // Sine-of-sine shaping: still swings −1..1, but the slope hits zero at
      // the extremes, so the pulse dwells fully-swollen / fully-flattened and
      // moves quickly through the middle.
      const pulseBase = sin(time.add(layerIndex * PULSE_STAGGER));
      const pulse = sin(pulseBase.mul(Math.PI / 2));
      const envelope = pulse.mul(breathingUniform).mul(depthWeight).add(1);
      const layerY = yBase.add(wave.mul(ampValue).mul(envelope));

      // Overdriven-glow profile: one divergent glow field under a soft
      // ceiling. rawGlow explodes toward the spine and falls off as
      // (w/d)^p away from it; 1 − e^(−x) pins everything past the knee at
      // 1 (the solid body) while leaving the dim tail nearly untouched.
      // Thickness moves the saturation boundary — width, never brightness.
      const distanceFromLine = layerY.abs();
      const halfWidth = thicknessValue.mul(BAND_HALF_WIDTH).mul(flare);
      // Glow picks the falloff exponent — a softness dial, not a gain. Low
      // glow → high exponent → the tail dies within a pixel of the body
      // (crisp ribbon). High glow → exponent 1 → the 1/distance laser
      // haze. clamp keeps per-layer scaling inside the mapped range.
      const exponent = mix(float(EXPONENT_CRISP), float(EXPONENT_HAZY), glowValue.clamp(0, 1));
      const rawGlow = halfWidth.div(distanceFromLine.add(SPINE_EPSILON)).pow(exponent);
      // Brightness multiplies AFTER the ceiling: pre-ceiling scaling can't
      // dim a divergent profile (the plateau still saturates to 1) — it
      // only moves the shoulder, which reads as width.
      const intensity = rawGlow.negate().exp().oneMinus().mul(brightnessValue);

      waveColor = waveColor.add(vec3(lineColor).mul(intensity));
    }

    const material = new MeshBasicNodeMaterial();

    material.colorNode = vec4(waveColor, 1);

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
    // layersKey is a stable string proxy for layers — listing the
    // array itself would trigger rebuild on identity-only changes. Matches
    // LinearGradient's pattern.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    shaderContext,
    layersKey,
    ampUniform,
    freqUniform,
    speedUniform,
    glowUniform,
    brightnessUniform,
    thicknessUniform,
    baselineUniform,
    braidingUniform,
    breathingUniform,
    flareStrengthUniform,
    flareRadiusUniform,
    colorDriftUniform,
    colorSpace,
  ]);

  return null;
}

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
  /** This line's opacity. */
  opacity?: number;
  /** This line's width. */
  thickness?: number;
}

export interface WavesShaderProps {
  /**
   * The wave lines to draw. At opacity 0.5 (the default) lines emit light
   * additively — overlaps brighten. Above 0.5, bodies cover the lines
   * behind them: the first line is frontmost. The first line breathes
   * deepest; later lines calm toward the back.
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
   * Line presence on a three-look dial, 0..1. 0 = invisible; 0.5 = pure
   * light — overlaps add and brighten; 1 = solid ribbons — the first
   * layer is frontmost and covers the rest. Accepts a static value or an
   * animation signal.
   */
  opacity: AnimatableProp<number>;
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
const DEFAULT_OPACITY = 0.5;
const DEFAULT_THICKNESS = 0.65;
const DEFAULT_LAYER_COLOR = '#ff6f6a';

// Half of the saturated body's height at thickness 1, in canvas units.
// Gate-tunable.
const BAND_HALF_WIDTH = 0.02;
// Ceiling on the halo falloff scale (distance beyond the body edge at
// which it hits its knee), in canvas units. Lines at or above the default
// width wear this fixed skirt — widening never amplifies light — while
// thinner bodies carry a proportionally thinner skirt, so a needle body
// reads needle-thin. Matches the default line's half-width. Gate-tunable.
const HALO_SCALE = 0.013;
// Keeps the divide finite at the body edge, where the outside distance is
// 0. Canvas units.
const EDGE_EPSILON = 1e-4;
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
  opacity,
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
  const opacityUniform = useAnimatableUniform<number>(opacity);
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
        `${Array.isArray(layer.color) ? layer.color.join(',') : (layer.color ?? '')}|${layer.amplitude ?? ''}|${layer.glow ?? ''}|${layer.brightness ?? ''}|${layer.opacity ?? ''}|${layer.thickness ?? ''}`,
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

    // Painter's order: iterate back-to-front so the FIRST layer in the
    // array composites last — frontmost when opacity occludes. layerIndex
    // keeps its array meaning for the stagger and pulse math.
    for (const [layerIndex, layer] of [...layers.entries()].reverse()) {
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
      const opacityValue =
        layer.opacity === undefined
          ? opacityUniform
          : opacityUniform.mul(layer.opacity / DEFAULT_OPACITY);
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
      // ceiling. The falloff is measured from the body's EDGE, not its
      // spine: inside the body distanceOutside is 0, so the field is huge
      // and 1 − e^(−x) pins it at 1 (the solid plateau). Thickness
      // TRANSLATES the edge outward — the tail beyond it never scales
      // with width, so widening a line adds body, never scene light.
      const distanceFromLine = layerY.abs();
      const halfWidth = thicknessValue.mul(BAND_HALF_WIDTH).mul(flare);
      const distanceOutside = distanceFromLine.sub(halfWidth).max(0);
      // Glow picks the falloff exponent — a softness dial, not a gain. Low
      // glow → high exponent → the tail dies within a pixel of the body
      // (crisp ribbon). High glow → exponent 1 → the 1/distance laser
      // haze. clamp keeps per-layer scaling inside the mapped range.
      const exponent = mix(float(EXPONENT_CRISP), float(EXPONENT_HAZY), glowValue.clamp(0, 1));
      // min caps the skirt for wide lines and shrinks it with the body for
      // thin ones — apparent width tracks thickness all the way down.
      const haloScale = halfWidth.min(HALO_SCALE);
      const rawGlow = haloScale.div(distanceOutside.add(EDGE_EPSILON)).pow(exponent);
      // Brightness multiplies AFTER the ceiling: pre-ceiling scaling can't
      // dim a divergent profile (the plateau still saturates to 1) — it
      // only moves the shoulder, which reads as width.
      const intensity = rawGlow.negate().exp().oneMinus().mul(brightnessValue);

      // Three-look opacity dial. The lower half (0..0.5) fades the line's
      // own light in — 0.5 is full light with zero occlusion, the pure
      // additive look. The upper half (0.5..1) keeps full light and ramps
      // occlusion: what's already painted (the lines BEHIND this one) is
      // dimmed before this line's light adds on top, reaching solid
      // alpha-over ribbons at 1. The occlusion clamp guards brightness
      // overdrive (intensity > 1) pushing it past full cover.
      const dial = opacityValue.clamp(0, 1);
      const lightGain = dial.mul(2).min(1);
      const occlusionGain = dial.mul(2).sub(1).max(0);
      const occlusion = intensity.mul(occlusionGain).clamp(0, 1);

      waveColor = vec3(lineColor)
        .mul(intensity)
        .mul(lightGain)
        .add(waveColor.mul(occlusion.oneMinus()));
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
    opacityUniform,
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

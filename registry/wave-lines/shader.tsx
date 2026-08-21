'use client';

// The wave lines' GPU half. Every line is two ingredients: a BODY (a solid
// surface with a crisp edge that covers lines behind it, like paint) and a
// HALO (additive light that sums with everything, like a glow). All lines
// share one wave, one clock, and one width profile — coherent group motion
// comes from that shared architecture, with per-line variation limited to a
// phase stagger, a depth-weighted height pulse, and color. The wrapper
// (./wave-lines.tsx) supplies the props.
import { useEffect } from 'react';

import { colorRamp, type ColorSpace } from '@camp-dev/shaders';
import {
  type AnimatableProp,
  useAnimatableSpeed,
  useAnimatableUniform,
  useShaderContext,
} from '@camp-dev/shaders-react';
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

/** A single wave line: a flat color or a gradient along its length. */
interface WaveLinesShaderLine {
  /** Single color, or 2+ stops forming a gradient along the line — hex, `oklch()`, or `oklab()`. */
  color?: string | string[];
}

export interface WaveLinesShaderProps {
  /**
   * The wave lines to draw. Bodies are surfaces — the first line is
   * frontmost and covers those behind it per its opacity — while halos
   * add as light. The first line breathes deepest; later lines calm
   * toward the back.
   */
  lines: WaveLinesShaderLine[];
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
   * edge; 1 = a long soft haze. Shape only — brightness controls the
   * halo's light. Accepts a static value or an animation signal.
   */
  softness: AnimatableProp<number>;
  /**
   * Halo luminosity. 0 = no halo — a bare hard-edged ribbon; 1 = the
   * neutral look; higher values drive the halo hot. The body stays
   * pinned at its color. Accepts a static value or an animation signal.
   */
  brightness: AnimatableProp<number>;
  /**
   * Body opacity, 0..1. 0 = no body — lines render as pure light; 1 =
   * solid ribbons that cover the lines behind them. Halos are unaffected.
   * Accepts a static value or an animation signal.
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

const DEFAULT_LAYER_COLOR = '#ff6f6a';

// ---------------------------------------------
// Tuning constants
// ---------------------------------------------
// "Gate-tunable" marks values whose settings were approved by eye at the
// visual gates — safe to retune, but expect to re-judge the look. "Canvas
// units" are the shader's -1..1 coordinate space (see samplePosition below),
// so 0.02 spans 1% of the canvas height.

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
// Falloff exponent at softness 0: a near-cliff edge. Gate-tunable.
const EXPONENT_CRISP = 6;
// Falloff exponent at softness 1: the laser's 1/distance haze.
// Gate-tunable.
const EXPONENT_HAZY = 1;
// Halo light per unit of brightness: brightness 1 drives the skirt at
// this multiplier, reproducing the neutral look. Gate-tunable.
const DRIVE_SCALE = 2;
// Width of the body's anti-aliased edge beyond its half-width, in canvas
// units (roughly 1.5px on a typical canvas). Gate-tunable.
const BODY_EDGE = 0.004;

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

export function WaveLinesShader({
  lines,
  amplitude,
  frequency,
  speed,
  softness,
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
}: WaveLinesShaderProps) {
  const shaderContext = useShaderContext();

  // Every dial lives in a uniform (a value the CPU can update each frame
  // without rebuilding the shader), tracking either a static number or an
  // animation signal. These are scalar uniforms, so chaining methods off
  // them below is safe (the vec-uniform chaining gotcha doesn't apply).
  // Speed is integrated by useAnimatableSpeed into a phase uniform
  // (speed x delta summed each frame), so a speed change shifts the tempo
  // without snapping the lines.
  const ampUniform = useAnimatableUniform<number>(amplitude);
  const freqUniform = useAnimatableUniform<number>(frequency);
  const phaseUniform = useAnimatableSpeed(speed);
  const softnessUniform = useAnimatableUniform<number>(softness);
  const brightnessUniform = useAnimatableUniform<number>(brightness);
  const opacityUniform = useAnimatableUniform<number>(opacity);
  const thicknessUniform = useAnimatableUniform<number>(thickness);
  const baselineUniform = useAnimatableUniform<number>(baseline);
  const braidingUniform = useAnimatableUniform<number>(braiding);
  const breathingUniform = useAnimatableUniform<number>(breathing);
  const flareStrengthUniform = useAnimatableUniform<number>(flareStrength);
  const flareRadiusUniform = useAnimatableUniform<number>(flareRadius);
  const colorDriftUniform = useAnimatableUniform<number>(colorDrift);

  // Content fingerprint of the lines array (colors only — that's all a line
  // carries). The build effect keys on this string, so a re-render passing a
  // new array with the same contents doesn't rebuild the material.
  const linesKey = lines
    .map((line) => (Array.isArray(line.color) ? line.color.join(',') : (line.color ?? '')))
    .join('||');

  // ---------------------------------------------
  // Build the material and mount the mesh
  // ---------------------------------------------
  // Runs once per mount — and again when the line colors or color space
  // change, because colorRamp bakes gradient stops into the compiled shader.
  useEffect(() => {
    if (!shaderContext) return;

    // ---------------------------------------------
    // Shared coordinates and motion
    // ---------------------------------------------
    // Map uv (0..1) to canvas units (-1..1 on both axes, origin at the
    // center) — the space every constant above is expressed in.
    const samplePosition = vec2(uv().x.mul(2).sub(1), uv().y.mul(2).sub(1));

    const yBase = samplePosition.y.add(baselineUniform);

    // One shared clock and one shared wave phase for every line — coherence
    // comes from the architecture, not from per-line tuning. The clock is
    // the CPU-accumulated phase (speed x delta summed each frame), so a
    // speed change shifts the tempo without snapping. frequency = full
    // wave cycles across the canvas width (x spans 2, so the PI factor makes
    // frequency 1 exactly one cycle).
    const time = phaseUniform;
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

    // ---------------------------------------------
    // Shared line profile: width, falloff, light
    // ---------------------------------------------
    // With per-line overrides gone, the profile math is shared by every
    // line; only the spine position and color vary per layer.
    const halfWidth = thicknessUniform.mul(BAND_HALF_WIDTH).mul(flare);
    // Softness picks the falloff exponent — shape only, not a gain. Low
    // softness → high exponent → the tail dies within a pixel of the body
    // (crisp ribbon). High softness → exponent 1 → the 1/distance laser
    // haze.
    const exponent = mix(float(EXPONENT_CRISP), float(EXPONENT_HAZY), softnessUniform.clamp(0, 1));
    // min caps the skirt for wide lines and shrinks it with the body for
    // thin ones — apparent width tracks thickness all the way down.
    const haloScale = halfWidth.min(HALO_SCALE);
    // max(0) guards a negative brightness signal inverting the field.
    const drive = brightnessUniform.mul(DRIVE_SCALE).max(0);
    const bodyOpacity = opacityUniform.clamp(0, 1);

    let waveColor = vec3(0, 0, 0);

    // ---------------------------------------------
    // Paint the lines, back to front
    // ---------------------------------------------
    // Painter's order: iterate back-to-front so the FIRST layer in the
    // array composites last — frontmost when opacity occludes. layerIndex
    // keeps its array meaning for the stagger and pulse math.
    for (const [layerIndex, layer] of [...lines.entries()].reverse()) {
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
      // back of the stack (last lines barely breathe), matching the
      // reference. The envelope swings amplitude between (1 − breathing) and
      // (1 + breathing) times its base value.
      const depthWeight = 1 - layerIndex / lines.length;
      // Sine-of-sine shaping: still swings −1..1, but the slope hits zero at
      // the extremes, so the pulse dwells fully-swollen / fully-flattened and
      // moves quickly through the middle.
      const pulseBase = sin(time.add(layerIndex * PULSE_STAGGER));
      const pulse = sin(pulseBase.mul(Math.PI / 2));
      const envelope = pulse.mul(breathingUniform).mul(depthWeight).add(1);
      const layerY = yBase.add(wave.mul(ampUniform).mul(envelope));

      // Line geometry: distance measured from the body's EDGE, not its
      // spine — inside the body distanceOutside is 0. Thickness
      // TRANSLATES the edge outward; the halo skirt beyond it never
      // scales with width, so widening a line adds body, never light.
      const distanceFromLine = layerY.abs();
      const distanceOutside = distanceFromLine.sub(halfWidth).max(0);
      // Model S — a line is two ingredients. The BODY is a surface: crisp
      // anti-aliased edge, composited source-over with opacity as its
      // alpha. The HALO is additive light: brightness drives its
      // intensity, softness its falloff shape. Surfaces blend and
      // occlude; light sums.
      const bodyCoverage = smoothstep(float(0), float(BODY_EDGE), distanceOutside).oneMinus();
      const rawGlow = haloScale.div(distanceOutside.add(EDGE_EPSILON)).pow(exponent).mul(drive);
      const haloLight = rawGlow.negate().exp().oneMinus();

      // Source-over: this line's body covers everything painted so far
      // (lines AND halos behind it), with textbook-monotonic opacity.
      const bodyAlpha = bodyCoverage.mul(bodyOpacity);

      waveColor = vec3(mix(waveColor, vec3(lineColor), bodyAlpha));
      // The halo adds as light, masked by this line's own painted body so
      // the glow rings the ribbon instead of overexposing it. At opacity
      // 0 the mask vanishes and the whole line renders as pure light.
      waveColor = waveColor.add(vec3(lineColor).mul(haloLight).mul(bodyAlpha.oneMinus()));
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
    // linesKey is a stable string proxy for lines — listing the
    // array itself would trigger rebuild on identity-only changes. Matches
    // LinearGradient's pattern.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    shaderContext,
    linesKey,
    ampUniform,
    freqUniform,
    phaseUniform,
    softnessUniform,
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

'use client';

import { useEffect } from 'react';

import { elapsedTime } from '@lovo/matter';
import { type AnimatableProp, useAnimatableUniform, useShaderContext } from '@lovo/matter-react';
import { sin, uv, vec2, vec3, vec4 } from 'three/tsl';
import { Mesh, MeshBasicNodeMaterial, PlaneGeometry } from 'three/webgpu';

import { parseColor } from '../utils/color';

/**
 * A single wave line. Each numeric field scales the matching global prop
 * for this line only; omit a field to use the global value as-is.
 */
interface WavesShaderLayer {
  /** Line color — hex, `oklch()`, or `oklab()`. */
  color?: string;
  /** This line's wave height. */
  amplitude?: number;
  /** This line's brightness. */
  glow?: number;
  /** This line's width. */
  thickness?: number;
}

export interface WavesShaderProps {
  /** The wave lines to draw. Lines emit light additively — overlaps brighten. */
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
   * Master brightness of the lines. 0 = invisible. Accepts a static value
   * or an animation signal.
   */
  glow: AnimatableProp<number>;
  /**
   * Master line width. Larger values give broader, softer lines. Accepts a
   * static value or an animation signal.
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
   * that scrolls as one. 1 matches the reference feel. Accepts a static
   * value or an animation signal.
   */
  braiding: AnimatableProp<number>;
  /**
   * Depth of the slow height pulse. 0 = steady heights, 1 = full swell
   * (lines double at the peak and flatten at the trough). Accepts a static
   * value or an animation signal.
   */
  breathing: AnimatableProp<number>;
}

const DEFAULT_AMPLITUDE = 0.2;
const DEFAULT_GLOW = 0.72;
const DEFAULT_THICKNESS = 0.65;
const DEFAULT_LAYER_COLOR = '#ff6f6a';

// Phase radians the shared wave scrolls per speed-scaled second. Gate-tunable.
const SCROLL_RATE = 2;
// Fixed phase gap between neighboring lines. Gate-tunable.
const LINE_STAGGER = 0.35;
// How fast the braid's phase spread grows per speed-scaled second, at
// braiding = 1. Gate-tunable.
const BRAID_RATE = 0.35;
// Phase gap between neighboring lines' height pulses, radians. Gate-tunable.
const PULSE_STAGGER = 0.35;

export function WavesShader(props: WavesShaderProps) {
  const shaderContext = useShaderContext();

  const ampUniform = useAnimatableUniform<number>(props.amplitude);
  const freqUniform = useAnimatableUniform<number>(props.frequency);
  const speedUniform = useAnimatableUniform<number>(props.speed);
  const glowUniform = useAnimatableUniform<number>(props.glow);
  const thicknessUniform = useAnimatableUniform<number>(props.thickness);
  const baselineUniform = useAnimatableUniform<number>(props.baseline);
  const braidingUniform = useAnimatableUniform<number>(props.braiding);
  const breathingUniform = useAnimatableUniform<number>(props.breathing);

  const layersKey = props.layers
    .map(
      (layer) =>
        `${layer.color ?? ''}|${layer.amplitude ?? ''}|${layer.glow ?? ''}|${layer.thickness ?? ''}`,
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

    let waveColor = vec3(0, 0, 0);

    for (const [layerIndex, layer] of props.layers.entries()) {
      // Globals are master controls. Per-layer values preserve relative
      // differences by scaling those globals against the component defaults.
      const ampValue =
        layer.amplitude === undefined
          ? ampUniform
          : ampUniform.mul(layer.amplitude / DEFAULT_AMPLITUDE);
      const glowValue =
        layer.glow === undefined ? glowUniform : glowUniform.mul(layer.glow / DEFAULT_GLOW);
      const thicknessValue =
        layer.thickness === undefined
          ? thicknessUniform
          : thicknessUniform.mul(layer.thickness / DEFAULT_THICKNESS);

      const [redChannel, greenChannel, blueChannel] = parseColor(
        layer.color ?? DEFAULT_LAYER_COLOR,
      );

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
      const depthWeight = 1 - layerIndex / props.layers.length;
      // Sine-of-sine shaping: still swings −1..1, but the slope hits zero at
      // the extremes, so the pulse dwells fully-swollen / fully-flattened and
      // moves quickly through the middle.
      const pulseBase = sin(time.add(layerIndex * PULSE_STAGGER));
      const pulse = sin(pulseBase.mul(Math.PI / 2));
      const envelope = pulse.mul(breathingUniform).mul(depthWeight).add(1);
      const layerY = yBase.add(wave.mul(ampValue).mul(envelope));

      const width = layerY.mul(150).abs().reciprocal().mul(thicknessValue).mul(glowValue);

      waveColor = waveColor.add(
        vec3(width.mul(redChannel), width.mul(greenChannel), width.mul(blueChannel)),
      );
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
    // layersKey is a stable string proxy for props.layers — listing the
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
    thicknessUniform,
    baselineUniform,
    braidingUniform,
    breathingUniform,
  ]);

  return null;
}

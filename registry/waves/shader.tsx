'use client';

import { useEffect } from 'react';

import { elapsedTime } from '@lovo/matter';
import { type AnimatableProp, useAnimatableUniform, useShaderContext } from '@lovo/matter-react';
import { cos, type ShaderNodeObject, uv, vec2, vec3, vec4 } from 'three/tsl';
import { Mesh, MeshBasicNodeMaterial, type Node, PlaneGeometry } from 'three/webgpu';

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
  /** This line's wave count across the canvas width. */
  frequency?: number;
  /** This line's drift rate. */
  speed?: number;
  /** This line's brightness. */
  glow?: number;
  /** This line's width. */
  thickness?: number;
  /** Phase offset in radians, sliding the line's wave pattern horizontally. */
  offset?: number;
  /** Extra fine wobble on top of this line's base wave. 0 = a pure smooth wave. */
  waviness?: number;
}

export interface WavesShaderProps {
  /** The wave lines to draw. Lines emit light additively — overlaps brighten. */
  layers: WavesShaderLayer[];
  /**
   * Master wave height, as a fraction of half the canvas height. 0 = flat
   * lines. Accepts a static value or an animation signal.
   */
  amplitude: AnimatableProp<number>;
  /**
   * Master wave count across the canvas width. Accepts a static value or
   * an animation signal.
   */
  frequency: AnimatableProp<number>;
  /**
   * Master drift rate of the wave motion. 0 freezes the lines. Accepts a
   * static value or an animation signal.
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
}

const DEFAULT_AMPLITUDE = 0.09;
const DEFAULT_FREQUENCY = 1;
const DEFAULT_SPEED = 1;
const DEFAULT_GLOW = 0.72;
const DEFAULT_THICKNESS = 0.65;
const DEFAULT_WAVINESS = 0.35;
const DEFAULT_LAYER_COLOR = '#ff6f6a';

const wobble = (phase: ShaderNodeObject<Node>) =>
  cos(phase)
    .add(cos(phase.mul(1.3).add(1.3)))
    .add(cos(phase.mul(1.4).add(1.4)))
    .div(3);

export function WavesShader(props: WavesShaderProps) {
  const shaderContext = useShaderContext();

  const ampUniform = useAnimatableUniform<number>(props.amplitude);
  const freqUniform = useAnimatableUniform<number>(props.frequency);
  const speedUniform = useAnimatableUniform<number>(props.speed);
  const glowUniform = useAnimatableUniform<number>(props.glow);
  const thicknessUniform = useAnimatableUniform<number>(props.thickness);
  const baselineUniform = useAnimatableUniform<number>(props.baseline);

  const layersKey = props.layers
    .map(
      (layer) =>
        `${layer.color ?? ''}|${layer.amplitude ?? ''}|${layer.frequency ?? ''}|${layer.speed ?? ''}|${layer.glow ?? ''}|${layer.thickness ?? ''}|${layer.offset ?? ''}|${layer.waviness ?? ''}`,
    )
    .join('||');

  useEffect(() => {
    if (!shaderContext) return;

    const samplePosition = vec2(uv().x.mul(2).sub(1), uv().y.mul(2).sub(1));

    const yBase = samplePosition.y.add(baselineUniform);
    let waveColor = vec3(0, 0, 0);

    for (const layer of props.layers) {
      // Globals are master controls. Per-layer values preserve relative
      // differences by scaling those globals against the component defaults.
      const ampValue =
        layer.amplitude === undefined
          ? ampUniform
          : ampUniform.mul(layer.amplitude / DEFAULT_AMPLITUDE);
      const freqValue =
        layer.frequency === undefined
          ? freqUniform
          : freqUniform.mul(layer.frequency / DEFAULT_FREQUENCY);
      const speedValue =
        layer.speed === undefined ? speedUniform : speedUniform.mul(layer.speed / DEFAULT_SPEED);
      const glowValue =
        layer.glow === undefined ? glowUniform : glowUniform.mul(layer.glow / DEFAULT_GLOW);
      const thicknessValue =
        layer.thickness === undefined
          ? thicknessUniform
          : thicknessUniform.mul(layer.thickness / DEFAULT_THICKNESS);
      const offset = layer.offset ?? 0;
      const wavinessValue = layer.waviness ?? DEFAULT_WAVINESS;

      const [redChannel, greenChannel, blueChannel] = parseColor(
        layer.color ?? DEFAULT_LAYER_COLOR,
      );

      const layerTime = elapsedTime.mul(speedValue);
      const waveInput = samplePosition.x.mul(freqValue).add(offset);
      const baseWave = wobble(waveInput.add(layerTime));
      const wavinessWave = cos(waveInput.mul(1.7).sub(layerTime.mul(0.55)))
        .add(cos(waveInput.mul(0.43).add(layerTime.mul(1.35))))
        .mul(0.25);
      const wave = baseWave.add(wavinessWave.mul(wavinessValue));

      const layerY = yBase.add(wave.mul(ampValue));

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
  ]);

  return null;
}

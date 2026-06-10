'use client';

import { useEffect } from 'react';

import { time } from '@lovo/matter';
import { type AnimatableProp, useAnimatableUniform, useShaderContext } from '@lovo/matter-react';
import { cos, type ShaderNodeObject, uv, vec2, vec3, vec4 } from 'three/tsl';
import { Mesh, MeshBasicNodeMaterial, type Node, PlaneGeometry } from 'three/webgpu';

import { parseHex } from '../utils/color';

interface WavesShaderLayer {
  color?: string;
  amplitude?: number;
  frequency?: number;
  speed?: number;
  glow?: number;
  thickness?: number;
  offset?: number;
  motion?: number;
}

export interface WavesShaderProps {
  layers: WavesShaderLayer[];
  amplitude: AnimatableProp<number>;
  frequency: AnimatableProp<number>;
  speed: AnimatableProp<number>;
  glow: AnimatableProp<number>;
  thickness: AnimatableProp<number>;
  baseline: AnimatableProp<number>;
}

const DEFAULT_AMPLITUDE = 0.09;
const DEFAULT_FREQUENCY = 1;
const DEFAULT_SPEED = 1;
const DEFAULT_GLOW = 0.72;
const DEFAULT_THICKNESS = 0.65;
const DEFAULT_MOTION = 0.35;
const DEFAULT_LAYER_COLOR = '#ff6f6a';

const wobble = (t: ShaderNodeObject<Node>) =>
  cos(t)
    .add(cos(t.mul(1.3).add(1.3)))
    .add(cos(t.mul(1.4).add(1.4)))
    .div(3);

export function WavesShader(props: WavesShaderProps) {
  const ctx = useShaderContext();

  const ampUniform = useAnimatableUniform<number>(props.amplitude);
  const freqUniform = useAnimatableUniform<number>(props.frequency);
  const speedUniform = useAnimatableUniform<number>(props.speed);
  const glowUniform = useAnimatableUniform<number>(props.glow);
  const thicknessUniform = useAnimatableUniform<number>(props.thickness);
  const baselineUniform = useAnimatableUniform<number>(props.baseline);

  const layersKey = props.layers
    .map(
      (l) =>
        `${l.color ?? ''}|${l.amplitude ?? ''}|${l.frequency ?? ''}|${l.speed ?? ''}|${l.glow ?? ''}|${l.thickness ?? ''}|${l.offset ?? ''}|${l.motion ?? ''}`,
    )
    .join('||');

  useEffect(() => {
    if (!ctx) return;

    const p = vec2(uv().x.mul(2).sub(1), uv().y.mul(2).sub(1));

    const yBase = p.y.add(baselineUniform);
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
      const motionValue = layer.motion ?? DEFAULT_MOTION;

      const [cr, cg, cb] = parseHex(layer.color ?? DEFAULT_LAYER_COLOR);

      const layerTime = time.mul(speedValue);
      const waveInput = p.x.mul(freqValue).add(offset);
      const baseWave = wobble(waveInput.add(layerTime));
      const motionWave = cos(waveInput.mul(1.7).sub(layerTime.mul(0.55)))
        .add(cos(waveInput.mul(0.43).add(layerTime.mul(1.35))))
        .mul(0.25);
      const wave = baseWave.add(motionWave.mul(motionValue));

      const layerY = yBase.add(wave.mul(ampValue));

      const width = layerY.mul(150).abs().reciprocal().mul(thicknessValue).mul(glowValue);

      waveColor = waveColor.add(vec3(width.mul(cr), width.mul(cg), width.mul(cb)));
    }

    const material = new MeshBasicNodeMaterial();

    material.colorNode = vec4(waveColor, 1);

    const mesh = new Mesh(new PlaneGeometry(2, 2), material);

    ctx.scene.add(mesh);

    return () => {
      ctx.scene.remove(mesh);

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
    ctx,
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

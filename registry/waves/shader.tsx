'use client';

import { useEffect, useMemo } from 'react';

import { time } from '@lovo/matter';
import { type AnimatableProp, useAnimatableUniform, useShaderContext } from '@lovo/matter-react';
import { cos, type ShaderNodeObject, uv, vec2, vec3, vec4 } from 'three/tsl';
import { Mesh, MeshBasicNodeMaterial, type Node, PlaneGeometry } from 'three/webgpu';

import { parseHex } from '../utils/color';
import type { WaveLayer } from './waves';

export interface WavesShaderProps {
  layers: WaveLayer[];
  color: string;
  amplitude: AnimatableProp<number>;
  frequency: AnimatableProp<number>;
  speed: AnimatableProp<number>;
  glow: AnimatableProp<number>;
  baseline: AnimatableProp<number>;
}

// Pseudo-random 1D signal: sum of three cosines at coprime-ish frequencies
// averaged to [-1, 1]. Feels organic and non-repeating over short windows.
const wobble = (t: ShaderNodeObject<Node>) =>
  cos(t)
    .add(cos(t.mul(1.3).add(1.3)))
    .add(cos(t.mul(1.4).add(1.4)))
    .div(3);

export function WavesShader(props: WavesShaderProps) {
  const ctx = useShaderContext();

  const color = useMemo(() => parseHex(props.color), [props.color]);

  const ampUniform = useAnimatableUniform<number>(props.amplitude);
  const freqUniform = useAnimatableUniform<number>(props.frequency);
  const speedUniform = useAnimatableUniform<number>(props.speed);
  const glowUniform = useAnimatableUniform<number>(props.glow);
  const baselineUniform = useAnimatableUniform<number>(props.baseline);

  // Stable stringified proxy of the layers array — used in deps to trigger
  // material rebuild on any per-layer change. Mirrors LinearGradient's
  // colorsKey/stopsKey pattern (see registry/linear-gradient/shader.tsx).
  const layersKey = props.layers
    .map(
      (l) =>
        `${l.color ?? ''}|${l.amplitude ?? ''}|${l.frequency ?? ''}|${l.speed ?? ''}|${l.phase ?? ''}`,
    )
    .join('||');

  useEffect(() => {
    if (!ctx) return;

    const [globalCr, globalCg, globalCb] = color;

    const p = vec2(uv().x.mul(2).sub(1), uv().y.mul(2).sub(1));

    let yRunning = p.y.add(baselineUniform);
    let waveColor = vec3(0, 0, 0);

    for (const layer of props.layers) {
      // Per-layer overrides bake as JS literals; unset fields use the
      // shared global uniform node. TSL .mul/.add accept both numbers and
      // nodes via NodeRepresentation, so no float() wrapper needed.
      const ampValue = layer.amplitude ?? ampUniform;
      const freqValue = layer.frequency ?? freqUniform;
      const speedValue = layer.speed ?? speedUniform;
      const phase = layer.phase ?? 0;

      const [cr, cg, cb] =
        layer.color !== undefined ? parseHex(layer.color) : [globalCr, globalCg, globalCb];

      const layerTime = time.mul(speedValue);

      yRunning = yRunning.add(wobble(p.x.mul(freqValue).add(phase).add(layerTime)).mul(ampValue));

      const width = yRunning.mul(150).abs().reciprocal().mul(glowUniform);

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
  }, [ctx, layersKey, color, ampUniform, freqUniform, speedUniform, glowUniform, baselineUniform]);

  return null;
}

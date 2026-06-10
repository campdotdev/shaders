'use client';

import { useEffect, useMemo } from 'react';

import { time } from '@lovo/matter';
import { type AnimatableProp, useAnimatableUniform, useShaderContext } from '@lovo/matter-react';
import type { ShaderNodeObject } from 'three/tsl';
import { mix, sin, smoothstep, uv, vec2, vec3, vec4 } from 'three/tsl';
import { Mesh, MeshBasicNodeMaterial, type Node, PlaneGeometry } from 'three/webgpu';

export interface WavesShaderProps {
  amplitude: AnimatableProp<number>;
  frequency: AnimatableProp<number>;
  speed: AnimatableProp<number>;
  color: string;
  layers: number;
}

const hexToVec3 = (hex: string): readonly [number, number, number] => {
  const clean = hex.replace('#', '');

  return [
    parseInt(clean.slice(0, 2), 16) / 255,
    parseInt(clean.slice(2, 4), 16) / 255,
    parseInt(clean.slice(4, 6), 16) / 255,
  ];
};

function buildWavesMaterial(
  ampU: ShaderNodeObject<Node>,
  freqU: ShaderNodeObject<Node>,
  speedU: ShaderNodeObject<Node>,
  layers: number,
  color: readonly [number, number, number],
): MeshBasicNodeMaterial {
  const [cr, cg, cb] = color;
  const zeroScalar = vec2(0).x;
  const uvX = uv().x;
  const tNode = time;

  let waveSum: ShaderNodeObject<Node> = sin(uvX.mul(freqU).add(tNode.mul(speedU)));
  let totalAmp = 1;

  for (let i = 1; i < layers; i += 1) {
    const layerFreq = zeroScalar.add(freqU).mul(1 + i * 0.7);
    const layerSpeed = zeroScalar.add(speedU).mul(1 + i * 0.4);
    const layerAmp = 1 / (i + 1);
    const phase = i * 1.3;
    const layer = sin(uvX.mul(layerFreq).add(tNode.mul(layerSpeed).add(phase)));

    waveSum = waveSum.add(layer.mul(layerAmp));
    totalAmp += layerAmp;
  }

  const baseWave = waveSum.div(totalAmp).mul(ampU);
  const distFromBand = uv().y.sub(0.5).sub(baseWave).abs();
  const mask = smoothstep(0.04, 0.0, distFromBand);

  const colorVec = vec3(cr, cg, cb);
  const waveColor = mix(vec3(0, 0, 0), colorVec, mask);

  const material = new MeshBasicNodeMaterial();

  material.colorNode = vec4(waveColor, mask);

  return material;
}

export function WavesShader(props: WavesShaderProps) {
  const ctx = useShaderContext();
  const layers = Math.max(1, props.layers);

  const color = useMemo(() => hexToVec3(props.color), [props.color]);

  const ampUniform = useAnimatableUniform<number>(props.amplitude);
  const freqUniform = useAnimatableUniform<number>(props.frequency);
  const speedUniform = useAnimatableUniform<number>(props.speed);

  useEffect(() => {
    if (!ctx) return;

    const material = buildWavesMaterial(ampUniform, freqUniform, speedUniform, layers, color);
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
  }, [ctx, layers, color, ampUniform, freqUniform, speedUniform]);

  return null;
}

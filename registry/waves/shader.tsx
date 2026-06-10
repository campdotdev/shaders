'use client';

import { useEffect, useMemo } from 'react';

import { time } from '@lovo/matter';
import { type AnimatableProp, useAnimatableUniform, useShaderContext } from '@lovo/matter-react';
import { sin, uv, vec2, vec3, vec4 } from 'three/tsl';
import { Mesh, MeshBasicNodeMaterial, PlaneGeometry } from 'three/webgpu';

export interface WavesShaderProps {
  amplitude: AnimatableProp<number>;
  frequency: AnimatableProp<number>;
  speed: AnimatableProp<number>;
  intensity: AnimatableProp<number>;
  sharpness: AnimatableProp<number>;
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

export function WavesShader(props: WavesShaderProps) {
  const ctx = useShaderContext();
  const layers = Math.max(1, props.layers);

  const color = useMemo(() => hexToVec3(props.color), [props.color]);

  const ampUniform = useAnimatableUniform<number>(props.amplitude);
  const freqUniform = useAnimatableUniform<number>(props.frequency);
  const speedUniform = useAnimatableUniform<number>(props.speed);
  const intensityUniform = useAnimatableUniform<number>(props.intensity);
  const sharpnessUniform = useAnimatableUniform<number>(props.sharpness);

  useEffect(() => {
    if (!ctx) return;

    void layers;
    void color;

    const p = vec2(uv().x.mul(2).sub(1), uv().y.mul(2).sub(1));

    let yRunning = p.y.add(0.1);
    let waveColor = vec3(0, 0, 0);

    for (let i = 0; i < 10; i += 1) {
      yRunning = yRunning.add(
        sin(
          p.x
            .mul(freqUniform)
            .add(i / 7)
            .add(time.mul(speedUniform)),
        ).mul(ampUniform),
      );

      const width = yRunning.mul(sharpnessUniform).abs().reciprocal();

      waveColor = waveColor.add(vec3(width.mul(1.9), width, width.mul(1.5)));
    }

    const finalColor = waveColor.mul(intensityUniform);

    const material = new MeshBasicNodeMaterial();

    material.colorNode = vec4(finalColor, 1);

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
  }, [
    ctx,
    layers,
    color,
    ampUniform,
    freqUniform,
    speedUniform,
    intensityUniform,
    sharpnessUniform,
  ]);

  return null;
}

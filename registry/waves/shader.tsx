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

  useEffect(() => {
    if (!ctx) return;

    // Phase 2: single unrolled iteration. layers/color hardcoded for now.
    void layers;
    void color;

    // 1. Remap UV from [0, 1] (sampler space) to [-1, 1] (centered space).
    //    Now y = 0 is the vertical midline of the canvas.
    const p = vec2(uv().x.mul(2).sub(1), uv().y.mul(2).sub(1));

    // 2. Initial baseline shift — matches the ShaderToy's `uv.y += 0.1`.
    //    yRunning mutates per loop iteration (in JS scope), mirroring GLSL's
    //    `uv.y +=`. TSL nodes are immutable, so we rebind a JS `let` to a new node.
    let yRunning = p.y.add(0.1);

    // 3. One unrolled iteration of the wave loop with i = 0.
    //    GLSL: uv.y += 0.07 * sin(uv.x + 0/7 + iTime)
    const i = 0;

    yRunning = yRunning.add(
      sin(
        p.x
          .mul(freqUniform)
          .add(i / 7)
          .add(time.mul(speedUniform)),
      ).mul(ampUniform),
    );

    // 4. Proximity glow: width = abs(1 / (150 * yRunning)).
    const width = yRunning.mul(150).abs().reciprocal();

    // 5. Additive color with hardcoded channel weights matching the ShaderToy.
    const waveColor = vec3(width.mul(1.9), width, width.mul(1.5));

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
  }, [ctx, layers, color, ampUniform, freqUniform, speedUniform]);

  return null;
}

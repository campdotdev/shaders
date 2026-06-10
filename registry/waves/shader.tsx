'use client';

import { useEffect, useMemo } from 'react';

import { time } from '@lovo/matter';
import { type AnimatableProp, useAnimatableUniform, useShaderContext } from '@lovo/matter-react';
import { cos, type ShaderNodeObject, uv, vec2, vec3, vec4 } from 'three/tsl';
import { Mesh, MeshBasicNodeMaterial, type Node, PlaneGeometry } from 'three/webgpu';

export interface WavesShaderProps {
  amplitude: AnimatableProp<number>;
  frequency: AnimatableProp<number>;
  speed: AnimatableProp<number>;
  glow: AnimatableProp<number>;
  independence: AnimatableProp<number>;
  drift: AnimatableProp<number>;
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

// Pseudo-random 1D signal: sum of three cosines at coprime-ish frequencies
// averaged to [-1, 1]. Feels organic and non-repeating over short windows —
// the trick the ShaderToy "plasma lines" reference uses in place of pure sin.
const wobble = (t: ShaderNodeObject<Node>) =>
  cos(t)
    .add(cos(t.mul(1.3).add(1.3)))
    .add(cos(t.mul(1.4).add(1.4)))
    .div(3);

export function WavesShader(props: WavesShaderProps) {
  const ctx = useShaderContext();
  const layers = Math.max(1, props.layers);

  const color = useMemo(() => hexToVec3(props.color), [props.color]);

  const ampUniform = useAnimatableUniform<number>(props.amplitude);
  const freqUniform = useAnimatableUniform<number>(props.frequency);
  const speedUniform = useAnimatableUniform<number>(props.speed);
  const glowUniform = useAnimatableUniform<number>(props.glow);
  const independenceUniform = useAnimatableUniform<number>(props.independence);
  const driftUniform = useAnimatableUniform<number>(props.drift);

  useEffect(() => {
    if (!ctx) return;

    void layers;
    void color;

    const p = vec2(uv().x.mul(2).sub(1), uv().y.mul(2).sub(1));

    let yRunning = p.y.add(0.1);
    let waveColor = vec3(0, 0, 0);

    for (let i = 0; i < 10; i += 1) {
      // independence: static phase spread between layers. Deterministic per
      // slider value — never depends on elapsed time. independence=0 → all
      // layers use identical wave input; independence=1 → layer i is offset
      // by i/7 in phase.
      const layerPhase = independenceUniform.mul(i / 7);
      // drift: per-layer time-rate variance. Layers diverge OVER TIME — at
      // drift>0 the visible state at "drift=X" depends on accumulated wall
      // clock since animation started, so it's not deterministic across
      // slider sweeps. Default 0 (locked, deterministic).
      const layerTime = time.mul(speedUniform).mul(driftUniform.mul(i / 10).add(1));

      yRunning = yRunning.add(
        wobble(p.x.mul(freqUniform).add(layerPhase).add(layerTime)).mul(ampUniform),
      );

      // width = glow / (150 * |yRunning|). The 150 is a hidden scale constant;
      // glow=1 matches the original ShaderToy default look, glow=0 = invisible,
      // glow > 1 = blown out / wider bloom.
      const width = yRunning.mul(150).abs().reciprocal().mul(glowUniform);

      waveColor = waveColor.add(vec3(width.mul(1.9), width, width.mul(1.5)));
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
  }, [
    ctx,
    layers,
    color,
    ampUniform,
    freqUniform,
    speedUniform,
    glowUniform,
    independenceUniform,
    driftUniform,
  ]);

  return null;
}

'use client';

import { useEffect, useMemo } from 'react';

import { cursorRipple, time } from '@lovo/matter';
import {
  type AnimatableProp,
  type CursorSignal,
  useAnimatableUniform,
  useCursor,
  useShaderContext,
} from '@lovo/matter-react';
import type { ShaderNodeObject } from 'three/tsl';
import { mix, sin, smoothstep, uniform, uv, vec2, vec3, vec4 } from 'three/tsl';
import { Mesh, MeshBasicNodeMaterial, PlaneGeometry, Vector2 } from 'three/webgpu';
import type { Node } from 'three/webgpu';

export interface WavesProps {
  amplitude?: AnimatableProp<number>;
  frequency?: AnimatableProp<number>;
  speed?: AnimatableProp<number>;
  color?: string;
  layers?: number;
  interactive?: boolean;
  inputs?: { cursor?: CursorSignal };
}

const DEFAULTS = {
  amplitude: 0.1,
  frequency: 5,
  speed: 1,
  color: '#00cda6',
  layers: 3,
};

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
  cursorU: ShaderNodeObject<Node>,
  layers: number,
  color: readonly [number, number, number],
  hasCursor: boolean,
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
  // Only add cursorRipple to wave sum when a cursor signal is connected
  const fullWave: ShaderNodeObject<Node> = hasCursor
    ? baseWave.add(cursorRipple(uv(), cursorU))
    : baseWave;

  const distFromBand = uv().y.sub(0.5).sub(fullWave).abs();
  const mask = smoothstep(0.04, 0.0, distFromBand);

  const colorVec = vec3(cr, cg, cb);
  const waveColor = mix(vec3(0, 0, 0), colorVec, mask);

  const material = new MeshBasicNodeMaterial();

  material.colorNode = vec4(waveColor, mask);

  return material;
}

export function Waves(props: WavesProps) {
  const ctx = useShaderContext();
  const cursorFromInputs = props.inputs?.cursor;
  const cursorAuto = useCursor();
  const cursor = cursorFromInputs ?? (props.interactive === true ? cursorAuto : null);

  const layers = Math.max(1, props.layers ?? DEFAULTS.layers);

  // Memoized so color tuple identity is stable — prevents mesh recreation on
  // unrelated re-renders when the hex value hasn't changed
  const color = useMemo(() => hexToVec3(props.color ?? DEFAULTS.color), [props.color]);

  const ampUniform = useAnimatableUniform<number>(props.amplitude ?? DEFAULTS.amplitude);
  const freqUniform = useAnimatableUniform<number>(props.frequency ?? DEFAULTS.frequency);
  const speedUniform = useAnimatableUniform<number>(props.speed ?? DEFAULTS.speed);

  const cursorVec = useMemo(() => new Vector2(0.5, 0.5), []);
  const cursorUniform = useMemo(() => uniform(cursorVec), [cursorVec]);

  useEffect(() => {
    if (cursor) return cursor.on('change', ([x, y]) => cursorVec.set(x, 1 - y));
    cursorVec.set(0.5, 0.5);

    return undefined;
  }, [cursor, cursorVec]);

  useEffect(() => {
    if (!ctx) return;

    const material = buildWavesMaterial(
      ampUniform,
      freqUniform,
      speedUniform,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
      cursorUniform as unknown as ShaderNodeObject<Node>,
      layers,
      color,
      cursor !== null,
    );
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
  }, [ctx, layers, color, ampUniform, freqUniform, speedUniform, cursor, cursorUniform]);

  return null;
}

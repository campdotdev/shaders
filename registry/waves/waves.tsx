'use client';

import type { AnimatableProp } from '@lovo/matter-react';

import { WavesShader } from './shader';

export interface WaveLayer {
  color?: string;
  amplitude?: number;
  frequency?: number;
  speed?: number;
  phase?: number;
}

export interface WavesProps {
  layers?: WaveLayer[];

  // globals — fallback values for per-layer fields when unset
  color?: string;
  amplitude?: AnimatableProp<number>;
  frequency?: AnimatableProp<number>;
  speed?: AnimatableProp<number>;

  // pure globals (not per-layer)
  glow?: AnimatableProp<number>;
  baseline?: AnimatableProp<number>;
}

// Default layer set: teal → cyan → sky cool-ocean progression with auto-spread
// phases. Hue span ~60°, well inside the design system's ~120° guideline.
export const DEFAULT_LAYERS: WaveLayer[] = [
  { color: '#77ebce', phase: 0 }, // palette.teal.light
  { color: '#00cda6', phase: 1 / 7 }, // palette.teal.base
  { color: '#009eaf', phase: 2 / 7 }, // palette.cyan.base
  { color: '#007bc6', phase: 3 / 7 }, // palette.sky.base
];

export function Waves({
  layers = DEFAULT_LAYERS,
  color = '#77ebce', // palette.teal.light — fallback for layers without color set
  amplitude = 0.07,
  frequency = 1,
  speed = 1,
  glow = 1,
  baseline = 0.1,
}: WavesProps) {
  return (
    <WavesShader
      amplitude={amplitude}
      baseline={baseline}
      color={color}
      frequency={frequency}
      glow={glow}
      layers={layers}
      speed={speed}
    />
  );
}

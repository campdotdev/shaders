'use client';

import type { AnimatableProp } from '@lovo/matter-react';

import { WavesShader } from './shader';

export interface WaveLayer {
  color?: string;
  amplitude?: number;
  frequency?: number;
  speed?: number;
  glow?: number;
  thickness?: number;
  offset?: number;
  motion?: number;
}

export interface WavesProps {
  layers?: WaveLayer[];
  amplitude?: AnimatableProp<number>;
  frequency?: AnimatableProp<number>;
  speed?: AnimatableProp<number>;
  glow?: AnimatableProp<number>;
  thickness?: AnimatableProp<number>;
  baseline?: AnimatableProp<number>;
}

// Default layer set: red → amber → green → blue rainbow progression with
// staggered offsets so each layer is easy to distinguish.
export const DEFAULT_LAYERS: WaveLayer[] = [
  {
    color: '#ff6f6a',
    amplitude: 0.045,
    frequency: 0.75,
    speed: 0.55,
    glow: 0.55,
    thickness: 0.45,
    offset: 0,
    motion: 0.12,
  }, // palette.red.light
  {
    color: '#ecb100',
    amplitude: 0.065,
    frequency: 1.05,
    speed: 0.8,
    glow: 0.62,
    thickness: 0.55,
    offset: 1.57,
    motion: 0.32,
  }, // palette.amber.base
  {
    color: '#0ae24b',
    amplitude: 0.09,
    frequency: 1.35,
    speed: 1.05,
    glow: 0.7,
    thickness: 0.65,
    offset: 3.14,
    motion: 0.52,
  }, // palette.green.base
  {
    color: '#4370f0',
    amplitude: 0.115,
    frequency: 1.7,
    speed: 1.3,
    glow: 0.78,
    thickness: 0.75,
    offset: 4.71,
    motion: 0.72,
  }, // palette.blue.light
];

export function Waves({
  layers = DEFAULT_LAYERS,
  amplitude = 0.09,
  frequency = 1,
  speed = 1,
  glow = 0.72,
  thickness = 0.65,
  baseline = 0.08,
}: WavesProps) {
  return (
    <WavesShader
      amplitude={amplitude}
      baseline={baseline}
      frequency={frequency}
      glow={glow}
      layers={layers}
      speed={speed}
      thickness={thickness}
    />
  );
}

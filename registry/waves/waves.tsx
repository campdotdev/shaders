'use client';

import type { AnimatableProp } from '@lovo/matter-react';

import { WavesShader } from './shader';

export interface WavesProps {
  amplitude?: AnimatableProp<number>;
  frequency?: AnimatableProp<number>;
  speed?: AnimatableProp<number>;
  glow?: AnimatableProp<number>;
  independence?: AnimatableProp<number>;
  drift?: AnimatableProp<number>;
  baseline?: AnimatableProp<number>;
  color?: string;
  layers?: number;
}

export function Waves({
  amplitude = 0.07,
  frequency = 1,
  speed = 1,
  glow = 1,
  independence = 0.5,
  drift = 0,
  baseline = 0.1,
  color = '#77ebce', // palette.teal.light
  layers = 10,
}: WavesProps) {
  return (
    <WavesShader
      amplitude={amplitude}
      baseline={baseline}
      color={color}
      drift={drift}
      frequency={frequency}
      glow={glow}
      independence={independence}
      layers={layers}
      speed={speed}
    />
  );
}

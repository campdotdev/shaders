'use client';

import type { AnimatableProp } from '@lovo/matter-react';

import { WavesShader } from './shader';

export interface WavesProps {
  amplitude?: AnimatableProp<number>;
  frequency?: AnimatableProp<number>;
  speed?: AnimatableProp<number>;
  color?: string;
  layers?: number;
}

export function Waves({
  amplitude = 0.1,
  frequency = 5,
  speed = 1,
  color = '#00cda6',
  layers = 3,
}: WavesProps) {
  return (
    <WavesShader
      amplitude={amplitude}
      color={color}
      frequency={frequency}
      layers={layers}
      speed={speed}
    />
  );
}

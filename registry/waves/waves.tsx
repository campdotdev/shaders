'use client';

import type { AnimatableProp } from '@lovo/matter-react';

import { WavesShader } from './shader';

export interface WavesProps {
  amplitude?: AnimatableProp<number>;
  frequency?: AnimatableProp<number>;
  speed?: AnimatableProp<number>;
  intensity?: AnimatableProp<number>;
  sharpness?: AnimatableProp<number>;
  independence?: AnimatableProp<number>;
  color?: string;
  layers?: number;
}

export function Waves({
  amplitude = 0.07,
  frequency = 1,
  speed = 1,
  intensity = 1,
  sharpness = 150,
  independence = 0.5,
  color = '#77eecc',
  layers = 10,
}: WavesProps) {
  return (
    <WavesShader
      amplitude={amplitude}
      color={color}
      frequency={frequency}
      independence={independence}
      intensity={intensity}
      layers={layers}
      sharpness={sharpness}
      speed={speed}
    />
  );
}

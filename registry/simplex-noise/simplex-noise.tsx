'use client';

import type { AnimatableProp } from '@lovo/matter-react';

import type { ColorStop } from '../utils/color';
import { SimplexNoiseShader } from './shader';

export type { ColorStop } from '../utils/color';

export interface SimplexNoiseProps {
  stops?: ColorStop[];
  scale?: AnimatableProp<number>;
  speed?: AnimatableProp<number>;
  contrast?: AnimatableProp<number>;
  bias?: AnimatableProp<number>;
  softness?: AnimatableProp<number>;
  seed?: number;
}

const DEFAULT_STOPS: ColorStop[] = [
  { color: '#1837e6' }, // palette.blue.base
  { color: '#661acc' }, // palette.violet.base
  { color: '#9e00ba' }, // palette.purple.base
  { color: '#cc1a99' }, // palette.magenta.base
  { color: '#00cda6' }, // palette.teal.base
];

export function SimplexNoise({
  stops = DEFAULT_STOPS,
  scale = 10,
  speed = 0.2,
  contrast = 2.5,
  bias = 0.5,
  softness = 0,
  seed = 0,
}: SimplexNoiseProps) {
  return (
    <SimplexNoiseShader
      bias={bias}
      contrast={contrast}
      scale={scale}
      seed={seed}
      softness={softness}
      speed={speed}
      stops={stops}
    />
  );
}

'use client';

import type { AnimatableProp } from '@lovo/matter-react';

import { type AuroraDirection, type AuroraLayer, AuroraShader } from './shader';

export type { AuroraDirection, AuroraLayer } from './shader';

export interface AuroraProps {
  intensity?: AnimatableProp<number>;
  speed?: AnimatableProp<number>;
  densityX?: AnimatableProp<number>;
  densityY?: AnimatableProp<number>;
  falloff?: AnimatableProp<number>;
  driftX?: AnimatableProp<number>;
  driftY?: AnimatableProp<number>;
  turbulence?: AnimatableProp<number>;
  direction?: AuroraDirection;
  layers?: AuroraLayer[];
}

export const DEFAULT_LAYERS: AuroraLayer[] = [
  { color: '#0ae24b', speed: 0.07, intensity: 0.6, seed: 0 }, // palette.green.base
  { color: '#1837e6', speed: 0.1, intensity: 0.2, seed: 5 }, // palette.blue.base
  { color: '#661acc', speed: 0.15, intensity: 0.3, seed: 11 }, // palette.violet.base
  { color: '#cc1a99', speed: 0.07, intensity: 0.2, seed: 17 }, // palette.magenta.base
];

export function Aurora({
  intensity = 1,
  speed = 0.6,
  densityX = 1.35,
  densityY = 5.35,
  falloff = 1.1,
  driftX = 0.2,
  driftY = -3.15,
  turbulence = 1.3,
  direction = 'top',
  layers = DEFAULT_LAYERS,
}: AuroraProps) {
  return (
    <AuroraShader
      densityX={densityX}
      densityY={densityY}
      direction={direction}
      driftX={driftX}
      driftY={driftY}
      falloff={falloff}
      intensity={intensity}
      layers={layers}
      speed={speed}
      turbulence={turbulence}
    />
  );
}

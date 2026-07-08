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

// Modeled on a real display: dominant oxygen-green body, teal shimmer, a
// high-altitude blue veil (high falloff hugs the curtain origin), and a faint
// pink fringe reaching below the tips (low falloff). Keeping the accent
// intensities low avoids additive gray-out where curtains overlap.
export const DEFAULT_LAYERS: AuroraLayer[] = [
  { color: '#0ae24b', speed: 0.07, intensity: 0.6, seed: 0, falloff: 1 }, // palette.green.base
  { color: '#00cda6', speed: 0.1, intensity: 0.3, seed: 5, falloff: 0.95 }, // palette.teal.base
  { color: '#1b9fda', speed: 0.15, intensity: 0.15, seed: 11, falloff: 1.2 }, // palette.sky.light
  { color: '#e765b8', speed: 0.07, intensity: 0.12, seed: 17, falloff: 0.8 }, // palette.magenta.light
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

'use client';

import type { AnimatableProp } from '@lovo/matter-react';

import {
  type AuroraBackground,
  type AuroraDirection,
  type AuroraLayer,
  AuroraShader,
} from './shader';

export type { AuroraBackground, AuroraDirection, AuroraLayer } from './shader';

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
  /** Background gradient behind the aurora curtains. */
  background?: Partial<AuroraBackground>;
  layers?: AuroraLayer[];
}

export const DEFAULT_LAYERS: AuroraLayer[] = [
  { color: '#0ae24b', speed: 0.07, intensity: 0.6, seed: 0 }, // palette.green.base
  { color: '#1837e6', speed: 0.1, intensity: 0.2, seed: 5 }, // palette.blue.base
  { color: '#661acc', speed: 0.15, intensity: 0.3, seed: 11 }, // palette.violet.base
  { color: '#cc1a99', speed: 0.07, intensity: 0.2, seed: 17 }, // palette.magenta.base
];

const DEFAULT_BACKGROUND: AuroraBackground = {
  horizon: '#040009',
  sky: '#146389',
};

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
  background,
  layers = DEFAULT_LAYERS,
}: AuroraProps) {
  const resolvedBackground: AuroraBackground = {
    horizon: background?.horizon ?? DEFAULT_BACKGROUND.horizon,
    sky: background?.sky ?? DEFAULT_BACKGROUND.sky,
  };

  return (
    <AuroraShader
      background={resolvedBackground}
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

'use client';

import type { ColorSpace, HueInterpolation } from '@lovo/matter';
import type { AnimatableProp } from '@lovo/matter-react';

import type { ColorStop } from '../utils/color';
import { type AuroraDirection, AuroraShader } from './shader';

export type { AuroraDirection } from './shader';
export type { ColorStop } from '../utils/color';

// Altitude ramp, low → high, in physical emission order: oxygen green at the
// curtain base, teal mid, ionized blue high, pink fringe at the top.
export const DEFAULT_STOPS: ColorStop[] = [
  { color: '#0ae24b', position: 0 }, // palette.green.base
  { color: '#00cda6', position: 0.35 }, // palette.teal.base
  { color: '#1b9fda', position: 0.7 }, // palette.sky.light
  { color: '#e765b8', position: 1 }, // palette.magenta.light
];

export interface AuroraProps {
  stops?: ColorStop[];
  intensity?: AnimatableProp<number>;
  speed?: AnimatableProp<number>;
  drift?: AnimatableProp<number>;
  turbulence?: AnimatableProp<number>;
  density?: AnimatableProp<number>;
  falloff?: AnimatableProp<number>;
  direction?: AuroraDirection;
  colorSpace?: ColorSpace;
  hueInterpolation?: HueInterpolation;
}

// Defaults are the values tuned by eye at the MAT-46 gates, not round numbers.
export function Aurora({
  stops = DEFAULT_STOPS,
  intensity = 1.7,
  speed = 1,
  drift = 0.13,
  turbulence = 1.3,
  density = 0.7,
  falloff = 1.35,
  direction = 'bottom',
  colorSpace = 'oklab',
  hueInterpolation = 'shorter',
}: AuroraProps) {
  return (
    <AuroraShader
      colorSpace={colorSpace}
      density={density}
      direction={direction}
      drift={drift}
      falloff={falloff}
      hueInterpolation={hueInterpolation}
      intensity={intensity}
      speed={speed}
      stops={stops}
      turbulence={turbulence}
    />
  );
}

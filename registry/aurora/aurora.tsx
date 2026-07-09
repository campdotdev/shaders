'use client';

import type { ColorSpace, HueInterpolation } from '@lovo/matter';
import type { AnimatableProp } from '@lovo/matter-react';

import type { ColorStop } from '../utils/color';
import { type AuroraDirection, AuroraShader, DEFAULT_STEPS } from './shader';

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
  /** Provisional while tuning (MAT-46): raymarch slice count. */
  steps?: number;
}

export function Aurora({
  stops = DEFAULT_STOPS,
  intensity = 1,
  speed = 1,
  drift = 0.5,
  turbulence = 1.25,
  density = 1,
  falloff = 1,
  direction = 'bottom',
  colorSpace = 'oklab',
  hueInterpolation = 'shorter',
  steps = DEFAULT_STEPS,
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
      steps={steps}
      stops={stops}
      turbulence={turbulence}
    />
  );
}

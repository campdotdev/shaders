'use client';

import type { ColorSpace, HueInterpolation } from '@lovo/matter';
import type { AnimatableProp } from '@lovo/matter-react';

import type { ColorStop } from '../utils/color';
import { AuroraShader } from './shader';

export type { ColorStop } from '../utils/color';

// Depth ramp, near → far: oxygen green up close, teal mid, ionized blue and
// pink fringe in the distance. Starting point; retuned at the Phase 6 gate.
export const DEFAULT_STOPS: ColorStop[] = [
  { color: '#0ae24b', position: 0 },
  { color: '#00cda6', position: 0.35 },
  { color: '#1b9fda', position: 0.7 },
  { color: '#e765b8', position: 1 },
];

export interface AuroraProps {
  stops?: ColorStop[];
  intensity?: AnimatableProp<number>;
  speed?: AnimatableProp<number>;
  turbulence?: AnimatableProp<number>;
  falloff?: AnimatableProp<number>;
  colorSpace?: ColorSpace;
  hueInterpolation?: HueInterpolation;
}

// Dial defaults are placeholders (1 = reference feel); retuned at the
// Phase 6 gate.
export function Aurora({
  stops = DEFAULT_STOPS,
  intensity = 1,
  speed = 1,
  turbulence = 1,
  falloff = 1,
  colorSpace = 'oklab',
  hueInterpolation = 'shorter',
}: AuroraProps) {
  return (
    <AuroraShader
      colorSpace={colorSpace}
      falloff={falloff}
      hueInterpolation={hueInterpolation}
      intensity={intensity}
      speed={speed}
      stops={stops}
      turbulence={turbulence}
    />
  );
}

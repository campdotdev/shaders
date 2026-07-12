'use client';

import type { ColorSpace, HueInterpolation } from '@lovo/matter';

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
  colorSpace?: ColorSpace;
  hueInterpolation?: HueInterpolation;
}

export function Aurora({
  stops = DEFAULT_STOPS,
  colorSpace = 'oklab',
  hueInterpolation = 'shorter',
}: AuroraProps) {
  return <AuroraShader colorSpace={colorSpace} hueInterpolation={hueInterpolation} stops={stops} />;
}

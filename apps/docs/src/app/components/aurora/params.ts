import type { ColorSpace, HueInterpolation } from '@lovo/matter';
import type { AuroraDirection } from '@matter/registry/aurora';

import { paletteOklch } from '../../../lib/palette';

export interface PlainColorStop {
  color: string;
  position: number;
}

export interface AuroraParams {
  intensity: number;
  speed: number;
  drift: number;
  turbulence: number;
  density: number;
  falloff: number;
  direction: AuroraDirection;
  colorSpace: ColorSpace;
  hueInterpolation: HueInterpolation;
  stops: PlainColorStop[];
}

export const MIN_STOPS = 2;
export const MAX_STOPS = 6;

// Tuned by eye at the MAT-46 gates; keep in sync with the Aurora defaults.
export const INITIAL: AuroraParams = {
  intensity: 1.7,
  speed: 1,
  drift: 0.13,
  turbulence: 1.3,
  density: 0.7,
  falloff: 1.35,
  direction: 'bottom',
  colorSpace: 'oklab',
  hueInterpolation: 'shorter',
  stops: [
    { color: paletteOklch.green.base, position: 0 },
    { color: paletteOklch.teal.base, position: 0.35 },
    { color: paletteOklch.sky.light, position: 0.7 },
    { color: paletteOklch.magenta.light, position: 1 },
  ],
};

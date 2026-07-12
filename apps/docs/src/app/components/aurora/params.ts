import type { ColorSpace, HueInterpolation } from '@lovo/matter';

import { paletteOklch } from '../../../lib/palette';

export interface PlainColorStop {
  color: string;
  position: number;
}

export interface AuroraParams {
  intensity: number;
  speed: number;
  turbulence: number;
  density: number;
  falloff: number;
  colorSpace: ColorSpace;
  hueInterpolation: HueInterpolation;
  stops: PlainColorStop[];
}

export const MIN_STOPS = 2;
export const MAX_STOPS = 6;

// Placeholder values during the MAT-48 rebuild; retuned at the Phase 6 gate.
export const INITIAL: AuroraParams = {
  intensity: 1,
  speed: 1,
  turbulence: 1,
  density: 1,
  falloff: 1,
  colorSpace: 'oklab',
  hueInterpolation: 'shorter',
  stops: [
    { color: paletteOklch.green.base, position: 0 },
    { color: paletteOklch.teal.base, position: 0.35 },
    { color: paletteOklch.sky.light, position: 0.7 },
    { color: paletteOklch.magenta.light, position: 1 },
  ],
};

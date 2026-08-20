import type { ColorSpace, HueInterpolation } from '@mattermix/shaders';

import { paletteOklch } from '../../../lib/palette';

export interface PlainColorStop {
  color: string;
  position: number;
}

export interface AuroraParams {
  intensity: number;
  speed: number;
  waviness: number;
  coverage: number;
  colorSpace: ColorSpace;
  hueInterpolation: HueInterpolation;
  stops: PlainColorStop[];
}

export const MIN_STOPS = 2;
export const MAX_STOPS = 6;

// Approved by eye at the MAT-48 gates; keep in sync with the Aurora defaults.
export const INITIAL: AuroraParams = {
  intensity: 1,
  speed: 1,
  waviness: 1,
  coverage: 1,
  colorSpace: 'oklab',
  hueInterpolation: 'shorter',
  stops: [
    { color: paletteOklch.green[10], position: 0 },
    { color: paletteOklch.teal[9], position: 0.35 },
    { color: paletteOklch.sky[9], position: 0.7 },
    { color: paletteOklch.magenta[8], position: 1 },
  ],
};

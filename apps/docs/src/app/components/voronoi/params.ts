import type { ColorSpace, HueInterpolation } from '@lovo/matter';

import { paletteOklch } from '../../../lib/palette';

export interface PlainColorStop {
  color: string;
}

export interface Params {
  scale: number;
  seed: number;
  steps: number;
  shading: number;
  speed: number;
  irregularity: number;
  drift: number;
  borderColor: string;
  borderWidth: number;
  borderSoftness: number;
  glow: number;
  colorSpace: ColorSpace;
  hueInterpolation: HueInterpolation;
  stops: PlainColorStop[];
}

export const MIN_STOPS = 2;
export const MAX_STOPS = 5;

export const INITIAL: Params = {
  scale: 5,
  seed: 0,
  steps: 0,
  shading: 0,
  speed: 0.2,
  irregularity: 1,
  drift: 0.5,
  borderColor: 'oklch(0.145 0.02 265)',
  borderWidth: 0.4,
  borderSoftness: 0,
  glow: 0.66,
  colorSpace: 'oklab',
  hueInterpolation: 'shorter',
  stops: [
    { color: paletteOklch.sky[1] },
    { color: paletteOklch.blue[4] },
    { color: paletteOklch.violet[6] },
    { color: paletteOklch.purple[9] },
  ],
};

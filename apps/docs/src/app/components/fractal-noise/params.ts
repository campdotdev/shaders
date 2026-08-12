import type { ColorSpace, HueInterpolation } from '@lovo/matter';

import { paletteOklch } from '../../../lib/palette';

export interface PlainColorStop {
  color: string;
}

export interface Params {
  scale: number;
  speed: number;
  octaves: number;
  detail: number;
  seed: number;
  colorSpace: ColorSpace;
  hueInterpolation: HueInterpolation;
  stops: PlainColorStop[];
}

export const MIN_STOPS = 2;
export const MAX_STOPS = 5;

// Values mirror the component defaults in registry/fractal-noise/fractal-noise.tsx —
// keep the two in sync.
export const INITIAL: Params = {
  scale: 3,
  speed: 0.2,
  octaves: 4,
  detail: 0.5,
  seed: 0,
  colorSpace: 'oklab',
  hueInterpolation: 'shorter',
  stops: [
    { color: paletteOklch.sky[1] },
    { color: paletteOklch.blue[4] },
    { color: paletteOklch.violet[6] },
    { color: paletteOklch.purple[9] },
    { color: paletteOklch.magenta[11] },
  ],
};

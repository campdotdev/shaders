import type { ColorSpace, HueInterpolation } from '@lovo/matter';

import { paletteOklch } from '../../../lib/palette';

export interface PlainColorStop {
  color: string;
}

export interface Params {
  count: number;
  size: number;
  sizeVariation: number;
  spread: number;
  softness: number;
  shading: number;
  center: [number, number];
  speed: number;
  seed: number;
  colorSpace: ColorSpace;
  hueInterpolation: HueInterpolation;
  stops: PlainColorStop[];
}

export const MIN_STOPS = 2;
export const MAX_STOPS = 5;

// Values mirror the component defaults in registry/blobs/blobs.tsx — keep
// the two in sync.
export const INITIAL: Params = {
  count: 8,
  size: 0.6,
  sizeVariation: 0.5,
  spread: 0.8,
  softness: 0.4,
  shading: 0.5,
  center: [0.5, 0.5],
  speed: 0.2,
  seed: 0,
  colorSpace: 'oklab',
  hueInterpolation: 'shorter',
  stops: [
    { color: paletteOklch.blue[2] },
    { color: paletteOklch.blue[4] },
    { color: paletteOklch.violet[6] },
    { color: paletteOklch.purple[9] },
  ],
};

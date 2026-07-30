import type { ColorSpace, HueInterpolation } from '@lovo/matter';

import { paletteOklch } from '../../../lib/palette';

export interface Stop {
  color: string;
  position: number;
}

export interface Params {
  center: [number, number];
  radius: number;
  stretch: number;
  angle: number;
  colorSpace: ColorSpace;
  hueInterpolation: HueInterpolation;
  stops: Stop[];
}

export const MIN_STOPS = 1;
export const MAX_STOPS = 6;

// Mirrors the component's own defaults exactly — see
// registry/radial-gradient/radial-gradient.tsx.
export const INITIAL: Params = {
  center: [0.5, 0.5],
  radius: 1,
  stretch: 1,
  angle: 0,
  colorSpace: 'oklab',
  hueInterpolation: 'shorter',
  stops: [
    { color: paletteOklch.amber[9], position: 0 },
    { color: paletteOklch.orange[6], position: 0.5 },
    { color: paletteOklch.red[3], position: 1 },
  ],
};

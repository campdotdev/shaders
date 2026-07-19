import type { ColorSpace, HueInterpolation } from '@lovo/matter';

import { paletteOklch } from '../../../lib/palette';

export interface Stop {
  color: string;
  position: number;
}

export interface Params {
  angle: number;
  speed: number;
  centerX: number;
  centerY: number;
  colorSpace: ColorSpace;
  hueInterpolation: HueInterpolation;
  stops: Stop[];
}

export const MIN_STOPS = 1;
export const MAX_STOPS = 6;

export const INITIAL: Params = {
  angle: 90,
  speed: 0,
  centerX: 0.5,
  centerY: 0.5,
  colorSpace: 'oklab',
  hueInterpolation: 'shorter',
  stops: [
    { color: paletteOklch.violet.base, position: 0 },
    { color: paletteOklch.purple.base, position: 0.5 },
    { color: paletteOklch.magenta.dark, position: 1 },
  ],
};

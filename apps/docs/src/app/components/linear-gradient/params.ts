import type { ColorSpace, HueInterpolation } from '@mattermix/shaders';

import { paletteOklch } from '../../../lib/palette';

export interface Stop {
  color: string;
  position: number;
}

export interface Params {
  angle: number;
  speed: number;
  repeat: number;
  center: [number, number];
  colorSpace: ColorSpace;
  hueInterpolation: HueInterpolation;
  stops: Stop[];
}

export const MIN_STOPS = 1;
export const MAX_STOPS = 6;

export const INITIAL: Params = {
  angle: 90,
  speed: 0,
  repeat: 1,
  center: [0.5, 0.5],
  colorSpace: 'oklab',
  hueInterpolation: 'shorter',
  stops: [
    { color: paletteOklch.violet[8], position: 0 },
    { color: paletteOklch.purple[6], position: 0.5 },
    { color: paletteOklch.magenta[4], position: 1 },
  ],
};

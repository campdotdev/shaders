import type { ColorSpace, HueInterpolation } from '@lovo/matter';

import { palette } from '../../../lib/palette';

export interface PlainColorStop {
  color: string;
}

export interface Params {
  scale: number;
  speed: number;
  contrast: number;
  balance: number;
  softness: number;
  seed: number;
  colorSpace: ColorSpace;
  hueInterpolation: HueInterpolation;
  stops: PlainColorStop[];
}

export const MIN_STOPS = 2;
export const MAX_STOPS = 5;

export const INITIAL: Params = {
  scale: 10,
  speed: 0.2,
  contrast: 2.5,
  balance: 0.5,
  softness: 0,
  seed: 0,
  colorSpace: 'oklab',
  hueInterpolation: 'shorter',
  stops: [
    { color: palette.blue[8] },
    { color: palette.violet[8] },
    { color: palette.purple[8] },
    { color: palette.magenta[8] },
    { color: palette.teal[8] },
  ],
};

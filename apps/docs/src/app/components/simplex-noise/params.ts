import type { ColorSpace, HueInterpolation } from '@lovo/matter';

import { palette } from '../../../lib/palette';

export interface Params {
  scale: number;
  speed: number;
  contrast: number;
  balance: number;
  softness: number;
  seed: number;
  colorSpace: ColorSpace;
  hueInterpolation: HueInterpolation;
  colors: string[];
}

export const INITIAL: Params = {
  scale: 10,
  speed: 0.2,
  contrast: 2.5,
  balance: 0.5,
  softness: 0,
  seed: 0,
  colorSpace: 'oklab',
  hueInterpolation: 'shorter',
  colors: [
    palette.blue.base,
    palette.violet.base,
    palette.purple.base,
    palette.magenta.base,
    palette.teal.base,
  ],
};

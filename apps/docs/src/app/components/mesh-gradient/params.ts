import type { ColorSpace, HueInterpolation } from '@lovo/matter';

import { palette } from '../../../lib/palette';

export interface Params {
  speed: number;
  frequency: number;
  amplitude: number;
  cycleSpeed: number;
  cycleEase: number;
  colorSpace: ColorSpace;
  hueInterpolation: HueInterpolation;
  a0: string;
  a1: string;
  a2: string;
  a3: string;
  b0: string;
  b1: string;
  b2: string;
  b3: string;
}

export const INITIAL: Params = {
  speed: 2,
  frequency: 5,
  amplitude: 30,
  cycleSpeed: 0.5,
  cycleEase: 0.6,
  colorSpace: 'oklab',
  hueInterpolation: 'shorter',
  a0: palette.lime.base,
  a1: palette.green.base,
  a2: palette.teal.base,
  a3: palette.sky.base,
  b0: palette.amber.base,
  b1: palette.orange.base,
  b2: palette.red.base,
  b3: palette.magenta.base,
};

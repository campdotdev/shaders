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
  colorCount: number;
  color0: string;
  color1: string;
  color2: string;
  color3: string;
  color4: string;
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
  colorCount: 5,
  color0: palette.blue.base,
  color1: palette.violet.base,
  color2: palette.purple.base,
  color3: palette.magenta.base,
  color4: palette.teal.base,
};

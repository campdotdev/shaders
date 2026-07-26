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
  /** Two four-color palettes; the component crossfades between them. */
  palettes: [string[], string[]];
}

/** Each palette is fixed at four colors — MeshGradient's prop shape, not a UI choice. */
export const PALETTE_SIZE = 4;

export const INITIAL: Params = {
  speed: 2,
  frequency: 5,
  amplitude: 30,
  cycleSpeed: 0.5,
  cycleEase: 0.6,
  colorSpace: 'oklab',
  hueInterpolation: 'shorter',
  palettes: [
    [palette.lime.base, palette.green.base, palette.teal.base, palette.sky.base],
    [palette.amber.base, palette.orange.base, palette.red.base, palette.magenta.base],
  ],
};

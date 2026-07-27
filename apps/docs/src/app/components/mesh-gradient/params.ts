import type { ColorSpace, HueInterpolation } from '@lovo/matter';

import { paletteOklch } from '../../../lib/palette';

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
    [paletteOklch.lime[8], paletteOklch.green[8], paletteOklch.teal[8], paletteOklch.sky[8]],
    [paletteOklch.amber[8], paletteOklch.orange[8], paletteOklch.red[8], paletteOklch.magenta[8]],
  ],
};

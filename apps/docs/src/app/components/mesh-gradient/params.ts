import type { ColorSpace, HueInterpolation } from '@mattermix/shaders';

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
    [paletteOklch.teal[10], paletteOklch.green[8], paletteOklch.sky[6], paletteOklch.blue[4]],
    [paletteOklch.amber[10], paletteOklch.orange[9], paletteOklch.red[7], paletteOklch.magenta[5]],
  ],
};

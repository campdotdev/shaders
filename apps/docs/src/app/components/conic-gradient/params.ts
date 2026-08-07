import type { ColorSpace, HueInterpolation } from '@lovo/matter';

import { paletteOklch } from '../../../lib/palette';

export interface Stop {
  color: string;
  position: number;
}

export interface Params {
  center: [number, number];
  angle: number;
  repeat: number;
  speed: number;
  colorSpace: ColorSpace;
  hueInterpolation: HueInterpolation;
  stops: Stop[];
}

export const MIN_STOPS = 1;
export const MAX_STOPS = 6;

// Mirrors the component's own defaults exactly — see
// registry/conic-gradient/conic-gradient.tsx. The fourth stop repeats the
// first color to close the loop; positions are explicit thirds because the
// panel's Stop type requires them, matching what auto-spacing would compute.
export const INITIAL: Params = {
  center: [0.5, 0.5],
  angle: 0,
  repeat: 1,
  speed: 0,
  colorSpace: 'oklab',
  hueInterpolation: 'shorter',
  stops: [
    { color: paletteOklch.magenta[9], position: 0 },
    { color: paletteOklch.purple[6], position: 1 / 3 },
    { color: paletteOklch.blue[3], position: 2 / 3 },
    { color: paletteOklch.magenta[9], position: 1 },
  ],
};

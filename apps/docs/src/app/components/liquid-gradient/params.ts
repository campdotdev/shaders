import type { ColorSpace, HueInterpolation } from '@camp-dev/shaders';

import { paletteOklch } from '../../../lib/palette';

export interface Stop {
  color: string;
  position: number;
}

export interface Params {
  angle: number;
  repeat: number;
  softness: number;
  swirl: number;
  scale: number;
  speed: number;
  seed: number;
  colorSpace: ColorSpace;
  hueInterpolation: HueInterpolation;
  stops: Stop[];
}

export const MIN_STOPS = 1;
export const MAX_STOPS = 6;

// Values mirror the component defaults in liquid-gradient.tsx. Keep the two
// in sync.
export const INITIAL: Params = {
  angle: 0,
  repeat: 2,
  softness: 1,
  swirl: 0.9,
  scale: 1.5,
  speed: 0.15,
  seed: 0,
  colorSpace: 'oklab',
  hueInterpolation: 'shorter',
  stops: [
    { color: paletteOklch.blue[3], position: 0 },
    { color: paletteOklch.violet[6], position: 0.5 },
    { color: paletteOklch.purple[9], position: 1 },
  ],
};

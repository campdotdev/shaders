import type { ColorSpace, HueInterpolation } from '@camp-dev/shaders';

import { paletteOklch } from '../../../lib/palette';

export interface Stop {
  color: string;
  position: number;
}

export interface Params {
  center: [number, number];
  radius: number;
  stretch: number;
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
// registry/radial-gradient/radial-gradient.tsx.
export const INITIAL: Params = {
  center: [0.5, 0.5],
  radius: 1,
  stretch: 1,
  angle: 0,
  repeat: 1,
  speed: 0,
  colorSpace: 'oklab',
  hueInterpolation: 'shorter',
  stops: [
    { color: paletteOklch.magenta[9], position: 0 },
    { color: paletteOklch.purple[6], position: 0.5 },
    { color: paletteOklch.blue[3], position: 1 },
  ],
};

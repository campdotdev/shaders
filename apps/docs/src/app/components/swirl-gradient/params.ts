import type { ColorSpace, HueInterpolation } from '@camp-dev/shaders';

import { paletteOklch } from '../../../lib/palette';

export interface Stop {
  color: string;
  position: number;
}

/** TEMPORARY (build-phase tuning only): mirrors SwirlGradientTuning. */
export interface Tuning {
  steps: number;
  stepLength: number;
  smallEddies: number;
}

export interface Params {
  angle: number;
  repeat: number;
  swirl: number;
  scale: number;
  seed: number;
  colorSpace: ColorSpace;
  hueInterpolation: HueInterpolation;
  stops: Stop[];
  tuning: Tuning;
}

export const MIN_STOPS = 1;
export const MAX_STOPS = 6;

// Values mirror the component defaults in swirl-gradient.tsx and the flow
// constants in its shader.tsx. Keep them in sync.
export const INITIAL: Params = {
  angle: 0,
  repeat: 3,
  swirl: 1,
  scale: 2,
  seed: 0,
  colorSpace: 'oklab',
  hueInterpolation: 'shorter',
  stops: [
    { color: paletteOklch.blue[3], position: 0 },
    { color: paletteOklch.violet[6], position: 0.5 },
    { color: paletteOklch.purple[9], position: 1 },
  ],
  tuning: {
    steps: 24,
    stepLength: 0.05,
    smallEddies: 0.35,
  },
};

import type { LedWallTuning } from '@camp-dev/shaders';

export interface LedWallParams {
  spacing: number;
  dotSize: number;
  bleed: number;
  flicker: number;
  speed: number;
  focusRadius: number;
  swell: number;
  tuning: LedWallTuning;
}

export const INITIAL: LedWallParams = {
  spacing: 5,
  dotSize: 2,
  bleed: 0,
  flicker: 0.3,
  speed: 2.4,
  focusRadius: 0.3,
  swell: 0.6,
  tuning: {
    variance: 0.5,
  },
};

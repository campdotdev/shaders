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
  spacing: 8,
  dotSize: 4,
  bleed: 0,
  flicker: 0.5,
  speed: 2.4,
  focusRadius: 0.6,
  swell: 0.85,
  tuning: {
    variance: 0.5,
  },
};

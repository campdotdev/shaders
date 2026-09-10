import type { LedWallTuning } from '@camp-dev/shaders';

export interface LedWallParams {
  spacing: number;
  dotSize: number;
  bleed: number;
  progress: number;
  centerX: number;
  centerY: number;
  waviness: number;
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
  progress: 1,
  centerX: 0.5,
  centerY: 1,
  waviness: 0.25,
  flicker: 0.3,
  speed: 2.4,
  focusRadius: 0.3,
  swell: 0.6,
  tuning: {
    fadeWidth: 0.08,
    jitter: 0.12,
    warpAmount: 0.6,
    warpFrequency: 2.5,
    variance: 0.5,
  },
};

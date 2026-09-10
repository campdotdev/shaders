import type { RadialWipeTuning } from '@camp-dev/shaders';

export interface RadialWipeParams {
  progress: number;
  centerX: number;
  centerY: number;
  dissolve: number;
  pixelSize: number;
  tuning: RadialWipeTuning;
}

export const INITIAL: RadialWipeParams = {
  progress: 0.5,
  centerX: 0.5,
  centerY: 1,
  dissolve: 0.25,
  pixelSize: 4,
  tuning: { fadeWidth: 0.08, jitter: 0.12, noiseFrequency: 2.5 },
};

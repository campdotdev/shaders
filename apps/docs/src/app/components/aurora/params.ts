import type { AuroraDirection } from '@matter/registry/aurora';

import { palette } from '../../../lib/palette';

export interface PlainAuroraLayer {
  color: string;
  speed: number;
  intensity: number;
  seed: number;
  falloff: number;
}

export interface AuroraParams {
  intensity: number;
  speed: number;
  densityX: number;
  densityY: number;
  falloff: number;
  driftX: number;
  driftY: number;
  turbulence: number;
  direction: AuroraDirection;
  layers: PlainAuroraLayer[];
}

export const MIN_LAYERS = 1;
export const MAX_LAYERS = 8;

export const INITIAL: AuroraParams = {
  intensity: 1,
  speed: 0.6,
  densityX: 1.35,
  densityY: 5.35,
  falloff: 1.1,
  driftX: 0.2,
  driftY: -3.15,
  turbulence: 1.3,
  direction: 'top',
  layers: [
    { color: palette.green.base, speed: 0.07, intensity: 0.6, seed: 0, falloff: 1 },
    { color: palette.teal.base, speed: 0.1, intensity: 0.3, seed: 5, falloff: 0.95 },
    { color: palette.sky.light, speed: 0.15, intensity: 0.15, seed: 11, falloff: 1.2 },
    { color: palette.magenta.light, speed: 0.07, intensity: 0.12, seed: 17, falloff: 0.8 },
  ],
};

import type { ColorSpace } from '@lovo/matter';

import { paletteOklch } from '../../../lib/palette';

/**
 * One line's colors. Always an array here even when it holds a single color --
 * the control iterates it either way. `scene.tsx` collapses a one-entry array to
 * a bare string, which is the flat-color form <WaveLines> expects.
 */
export interface WaveLineParams {
  color: string[];
}

export interface Params {
  amplitude: number;
  frequency: number;
  speed: number;
  softness: number;
  brightness: number;
  opacity: number;
  thickness: number;
  baseline: number;
  braiding: number;
  breathing: number;
  flare: number;
  flareRadius: number;
  colorDrift: number;
  colorSpace: ColorSpace;
  lines: WaveLineParams[];
}

export const MIN_LINES = 1;
export const MAX_LINES = 12;
export const MIN_STOPS = 1;
export const MAX_STOPS = 4;

// Mirrors the <WaveLines /> wrapper defaults (registry/wave-lines/wave-lines.tsx) exactly.
export const INITIAL: Params = {
  amplitude: 0.2,
  frequency: 1,
  speed: 0.5,
  softness: 0.75,
  brightness: 1,
  opacity: 0.25,
  thickness: 3.75,
  baseline: 0,
  braiding: 0,
  breathing: 0.5,
  flare: 2,
  flareRadius: 0.92,
  colorDrift: 0.7,
  colorSpace: 'oklab',
  lines: [
    {
      color: [paletteOklch.sky[10] ?? '', paletteOklch.cyan[10] ?? ''],
    },
    {
      color: [paletteOklch.blue[9] ?? '', paletteOklch.cyan[9] ?? ''],
    },
    {
      color: [paletteOklch.blue[8] ?? '', paletteOklch.sky[8] ?? ''],
    },
    {
      color: [paletteOklch.violet[7] ?? '', paletteOklch.sky[7] ?? ''],
    },
    {
      color: [paletteOklch.violet[6] ?? '', paletteOklch.blue[6] ?? ''],
    },
    {
      color: [paletteOklch.purple[5] ?? '', paletteOklch.blue[5] ?? ''],
    },
    {
      color: [paletteOklch.purple[4] ?? '', paletteOklch.violet[4] ?? ''],
    },
    {
      color: [paletteOklch.magenta[3] ?? '', paletteOklch.violet[3] ?? ''],
    },
  ],
};

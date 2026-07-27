import type { ColorSpace } from '@lovo/matter';

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
      color: ['oklch(0.85 0.094 235)', 'oklch(0.85 0.12 205)'],
    },
    {
      color: ['oklch(0.8 0.113 250)', 'oklch(0.8 0.14 220)'],
    },
    {
      color: ['oklch(0.75 0.138 265)', 'oklch(0.75 0.16 235)'],
    },
    {
      color: ['oklch(0.7 0.17 280)', 'oklch(0.7 0.17 250)'],
    },
    {
      color: ['oklch(0.65 0.17 295)', 'oklch(0.65 0.17 265)'],
    },
    {
      color: ['oklch(0.6 0.16 310)', 'oklch(0.6 0.16 280)'],
    },
    {
      color: ['oklch(0.55 0.15 325)', 'oklch(0.55 0.15 295)'],
    },
    {
      color: ['oklch(0.5 0.13 340)', 'oklch(0.5 0.13 310)'],
    },
  ],
};

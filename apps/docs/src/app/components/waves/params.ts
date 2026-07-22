import type { ColorSpace } from '@lovo/matter';

export interface Layer {
  colors: string[];
  amplitude: number;
  glow: number;
  brightness: number;
  opacity: number;
  thickness: number;
}

export interface Params {
  amplitude: number;
  frequency: number;
  speed: number;
  glow: number;
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
  layers: Layer[];
}

export const MIN_LAYERS = 1;
export const MAX_LAYERS = 12;
export const MIN_STOPS = 1;
export const MAX_STOPS = 4;

// Mirrors the <Waves /> wrapper defaults (registry/waves/waves.tsx) exactly.
export const INITIAL: Params = {
  amplitude: 0.2,
  frequency: 1,
  speed: 1,
  glow: 0.5,
  brightness: 1,
  opacity: 0.5,
  thickness: 0.65,
  baseline: 0,
  braiding: 0,
  breathing: 0.5,
  flare: 1.5,
  flareRadius: 0.9,
  colorDrift: 0.15,
  colorSpace: 'oklab',
  layers: [
    {
      colors: ['oklch(0.85 0.12 235)', 'oklch(0.85 0.12 205)'],
      amplitude: 0.2,
      glow: 0.5,
      brightness: 1,
      opacity: 0.5,
      thickness: 0.65,
    },
    {
      colors: ['oklch(0.8 0.14 250)', 'oklch(0.8 0.14 220)'],
      amplitude: 0.2,
      glow: 0.5,
      brightness: 1,
      opacity: 0.5,
      thickness: 0.65,
    },
    {
      colors: ['oklch(0.75 0.16 265)', 'oklch(0.75 0.16 235)'],
      amplitude: 0.2,
      glow: 0.5,
      brightness: 1,
      opacity: 0.5,
      thickness: 0.65,
    },
    {
      colors: ['oklch(0.7 0.17 280)', 'oklch(0.7 0.17 250)'],
      amplitude: 0.2,
      glow: 0.5,
      brightness: 1,
      opacity: 0.5,
      thickness: 0.65,
    },
    {
      colors: ['oklch(0.65 0.17 295)', 'oklch(0.65 0.17 265)'],
      amplitude: 0.2,
      glow: 0.5,
      brightness: 1,
      opacity: 0.5,
      thickness: 0.65,
    },
    {
      colors: ['oklch(0.6 0.16 310)', 'oklch(0.6 0.16 280)'],
      amplitude: 0.2,
      glow: 0.5,
      brightness: 1,
      opacity: 0.5,
      thickness: 0.65,
    },
    {
      colors: ['oklch(0.55 0.15 325)', 'oklch(0.55 0.15 295)'],
      amplitude: 0.2,
      glow: 0.5,
      brightness: 1,
      opacity: 0.5,
      thickness: 0.65,
    },
    {
      colors: ['oklch(0.5 0.13 340)', 'oklch(0.5 0.13 310)'],
      amplitude: 0.2,
      glow: 0.5,
      brightness: 1,
      opacity: 0.5,
      thickness: 0.65,
    },
  ],
};

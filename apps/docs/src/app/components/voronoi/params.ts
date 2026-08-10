import type { ColorSpace, HueInterpolation } from '@lovo/matter';

import { paletteOklch } from '../../../lib/palette';

export interface PlainColorStop {
  color: string;
}

/** TEMPORARY dev-tuning values; mirrors VoronoiTuning. Stripped at the defaults gate. */
export interface TuningParams {
  maxBorderGap: number;
  maxBorderSoftness: number;
  flowRate: number;
  flowRange: number;
  shadingRange: number;
  glowRange: number;
  glowExponent: number;
}

export interface Params {
  scale: number;
  seed: number;
  steps: number;
  shading: number;
  speed: number;
  irregularity: number;
  drift: number;
  borderColor: string;
  borderWidth: number;
  borderSoftness: number;
  glow: number;
  glowColor: string;
  colorSpace: ColorSpace;
  hueInterpolation: HueInterpolation;
  stops: PlainColorStop[];
  tuning: TuningParams;
}

export const MIN_STOPS = 2;
export const MAX_STOPS = 5;

export const INITIAL: Params = {
  scale: 5,
  seed: 0,
  steps: 0,
  shading: 0,
  speed: 0.2,
  irregularity: 1,
  drift: 0.5,
  borderColor: 'oklch(0.145 0.02 265)',
  borderWidth: 0.05,
  borderSoftness: 0,
  glow: 0,
  glowColor: 'oklch(0.145 0.02 265)',
  colorSpace: 'oklab',
  hueInterpolation: 'shorter',
  stops: [
    { color: paletteOklch.sky[1] },
    { color: paletteOklch.blue[4] },
    { color: paletteOklch.violet[6] },
    { color: paletteOklch.purple[9] },
  ],
  tuning: {
    maxBorderGap: 0.1,
    maxBorderSoftness: 0.1,
    flowRate: 0.3,
    flowRange: 0,
    shadingRange: 2.5,
    glowRange: 2.5,
    glowExponent: 1.5,
  },
};

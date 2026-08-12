import type { ColorSpace, HueInterpolation } from '@lovo/matter';

import { paletteOklch } from '../../../lib/palette';

export interface PlainColorStop {
  color: string;
}

/** TEMPORARY (build-phase tuning only) — mirrors BlobsTuning; the whole
 *  block is stripped at the defaults-tuning gate. */
export interface TuningParams {
  threshold: number;
  fieldReach: number;
  exponentMax: number;
  exponentSpan: number;
  roamExtent: number;
  minRoam: number;
  fastWeight: number;
}

export interface Params {
  count: number;
  size: number;
  sizeVariation: number;
  spread: number;
  center: [number, number];
  speed: number;
  seed: number;
  colorSpace: ColorSpace;
  hueInterpolation: HueInterpolation;
  stops: PlainColorStop[];
  tuning: TuningParams;
}

export const MIN_STOPS = 2;
export const MAX_STOPS = 5;

// Values mirror the component defaults in registry/blobs/blobs.tsx — keep
// the two in sync.
export const INITIAL: Params = {
  count: 6,
  size: 0.5,
  sizeVariation: 0.3,
  spread: 0.5,
  center: [0.5, 0.5],
  speed: 0.2,
  seed: 0,
  colorSpace: 'oklab',
  hueInterpolation: 'shorter',
  stops: [
    { color: paletteOklch.sky[1] },
    { color: paletteOklch.blue[4] },
    { color: paletteOklch.violet[6] },
    { color: paletteOklch.purple[9] },
  ],
  tuning: {
    threshold: 0.4,
    fieldReach: 2,
    exponentMax: 45,
    exponentSpan: 30,
    roamExtent: 0.35,
    minRoam: 0.4,
    fastWeight: 0.35,
  },
};

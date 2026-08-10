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
}

export interface Params {
  scale: number;
  seed: number;
  speed: number;
  irregularity: number;
  drift: number;
  borderColor: string;
  borderWidth: number;
  borderSoftness: number;
  stops: PlainColorStop[];
  tuning: TuningParams;
}

export const MIN_STOPS = 2;
export const MAX_STOPS = 5;

export const INITIAL: Params = {
  scale: 5,
  seed: 0,
  speed: 0.2,
  irregularity: 1,
  drift: 0.5,
  borderColor: 'oklch(0.145 0.02 265)',
  borderWidth: 0.05,
  borderSoftness: 0,
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
  },
};

import { palette } from '../../../lib/palette';

export interface Layer {
  color: string;
  amplitude: number;
  glow: number;
  thickness: number;
}

export interface Params {
  amplitude: number;
  frequency: number;
  speed: number;
  glow: number;
  thickness: number;
  baseline: number;
  braiding: number;
  layers: Layer[];
}

export const MIN_LAYERS = 1;
export const MAX_LAYERS = 12;

export const INITIAL: Params = {
  amplitude: 0.2,
  frequency: 1,
  speed: 1,
  glow: 0.72,
  thickness: 0.65,
  baseline: 0.08,
  braiding: 0.6,
  layers: [
    { color: palette.red.light, amplitude: 0.14, glow: 0.55, thickness: 0.45 },
    { color: palette.amber.base, amplitude: 0.17, glow: 0.62, thickness: 0.55 },
    { color: palette.green.base, amplitude: 0.2, glow: 0.7, thickness: 0.65 },
    { color: palette.blue.light, amplitude: 0.23, glow: 0.78, thickness: 0.75 },
  ],
};

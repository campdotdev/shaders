import { palette } from '../../../lib/palette';

export interface Layer {
  color: string;
  amplitude: number;
  frequency: number;
  speed: number;
  glow: number;
  thickness: number;
  offset: number;
  turbulence: number;
}

export interface Params {
  amplitude: number;
  frequency: number;
  speed: number;
  glow: number;
  thickness: number;
  baseline: number;
  layers: Layer[];
}

export const MIN_LAYERS = 1;
export const MAX_LAYERS = 12;

export const INITIAL: Params = {
  amplitude: 0.09,
  frequency: 1,
  speed: 1,
  glow: 0.72,
  thickness: 0.65,
  baseline: 0.08,
  layers: [
    {
      color: palette.red.light,
      amplitude: 0.045,
      frequency: 0.75,
      speed: 0.55,
      glow: 0.55,
      thickness: 0.45,
      offset: 0,
      turbulence: 0.12,
    },
    {
      color: palette.amber.base,
      amplitude: 0.065,
      frequency: 1.05,
      speed: 0.8,
      glow: 0.62,
      thickness: 0.55,
      offset: 1.57,
      turbulence: 0.32,
    },
    {
      color: palette.green.base,
      amplitude: 0.09,
      frequency: 1.35,
      speed: 1.05,
      glow: 0.7,
      thickness: 0.65,
      offset: 3.14,
      turbulence: 0.52,
    },
    {
      color: palette.blue.light,
      amplitude: 0.115,
      frequency: 1.7,
      speed: 1.3,
      glow: 0.78,
      thickness: 0.75,
      offset: 4.71,
      turbulence: 0.72,
    },
  ],
};

import { paletteOklch } from '../../../lib/palette';

export interface Params {
  color: string;
  spacing: number;
  dotSize: number;
  speed: number;
  amplitude: number;
  wavelength: number;
  decay: number;
  centerX: number;
  centerY: number;
}

export const INITIAL: Params = {
  color: paletteOklch.gray[8],
  spacing: 30,
  dotSize: 3,
  speed: 0.45,
  amplitude: 0.15,
  wavelength: 150,
  decay: 0.65,
  centerX: 0.5,
  centerY: 0.5,
};

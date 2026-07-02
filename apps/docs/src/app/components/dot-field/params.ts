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
  color: 'oklch(0.65 0.01 150)',
  spacing: 30,
  dotSize: 3,
  speed: 0.45,
  amplitude: 0.15,
  wavelength: 150,
  decay: 0.65,
  centerX: 0.5,
  centerY: 0.5,
};

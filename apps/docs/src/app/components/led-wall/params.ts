export interface LedWallParams {
  spacing: number;
  dotSize: number;
  bleed: number;
  flicker: number;
  speed: number;
  swellRadius: number;
  swell: number;
}

export const INITIAL: LedWallParams = {
  spacing: 8,
  dotSize: 4,
  bleed: 0,
  flicker: 0.5,
  speed: 2.4,
  swellRadius: 0.6,
  swell: 0.85,
};

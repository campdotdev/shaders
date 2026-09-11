export interface RadialWipeParams {
  progress: number;
  centerX: number;
  centerY: number;
  feather: number;
}

export const INITIAL: RadialWipeParams = {
  progress: 0.5,
  centerX: 0.5,
  centerY: 1,
  feather: 0.15,
};

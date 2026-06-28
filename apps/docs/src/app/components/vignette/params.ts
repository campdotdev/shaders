export interface VignetteParams {
  intensity: number;
  feather: number;
  centerX: number;
  centerY: number;
  extent: number;
  color: string;
}

export const INITIAL: VignetteParams = {
  intensity: 0.7,
  feather: 0.5,
  centerX: 0.5,
  centerY: 0.5,
  extent: 0.6,
  color: '#000000',
};

export interface VignetteParams {
  intensity: number;
  softness: number;
  centerX: number;
  centerY: number;
  radius: number;
  color: string;
}

export const INITIAL: VignetteParams = {
  intensity: 0.7,
  softness: 0.5,
  centerX: 0.5,
  centerY: 0.5,
  radius: 0.6,
  color: '#000000',
};

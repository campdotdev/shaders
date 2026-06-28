import type { ColorSpace, HueInterpolation } from '@lovo/matter';

export interface VignetteParams {
  intensity: number;
  feather: number;
  centerX: number;
  centerY: number;
  falloff: number;
  color: string;
  colorSpace: ColorSpace;
  hueInterpolation: HueInterpolation;
}

export const INITIAL: VignetteParams = {
  intensity: 0.3,
  feather: 0.6,
  centerX: 0.5,
  centerY: 0.5,
  falloff: 0.6,
  color: 'oklch(0.05 0.023 0)',
  colorSpace: 'oklab',
  hueInterpolation: 'shorter',
};

import type { ColorSpace, HueInterpolation } from '@camp-dev/shaders';

export interface VignetteParams {
  intensity: number;
  feather: number;
  center: [number, number];
  radius: number;
  color: string;
  colorSpace: ColorSpace;
  hueInterpolation: HueInterpolation;
}

// Mirrors the <Vignette /> wrapper defaults (registry/vignette/vignette.tsx),
// except radius: the demo opens at 0.6 where the component defaults to 0.7.
export const INITIAL: VignetteParams = {
  intensity: 0.3,
  feather: 0.6,
  center: [0.5, 0.5],
  radius: 0.6,
  color: 'oklch(0.05 0.022 0)',
  colorSpace: 'oklab',
  hueInterpolation: 'shorter',
};

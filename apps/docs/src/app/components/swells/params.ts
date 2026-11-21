import type { ColorSpace, HueInterpolation } from '@camp-dev/shaders';

export interface SwellsParams {
  altitude: number;
  tilt: number;
  fieldOfView: number;
  scale: number;
  relief: number;
  sharpness: number;
  angle: number;
  ripples: number;
  lightAngle: number;
  lightHeight: number;
  color: string;
  shadowColor: string;
  sheen: number;
  sheenColor: string;
  shadows: number;
  skylight: number;
  rimGlow: number;
  glints: number;
  glintSize: number;
  haze: number;
  hazeColor: string;
  colorSpace: ColorSpace;
  hueInterpolation: HueInterpolation;
  glideSpeed: number;
  swellSpeed: number;
  /** The scene always passes `parallaxCenter="cursor"`, so the sway follows the pointer. */
  parallax: number;
  intro: boolean;
}

// Values mirror the component defaults in
// packages/shaders/src/components/swells. Keep the two in step.
export const INITIAL: SwellsParams = {
  altitude: 1.5,
  tilt: 12,
  fieldOfView: 32,
  scale: 3,
  relief: 0.9,
  sharpness: 0.25,
  angle: 130,
  ripples: 0.6,
  lightAngle: 265,
  lightHeight: 15,
  color: 'oklch(0.720 0.250 320)', // paletteOklch.purple[9]
  shadowColor: 'oklch(0.303 0.152 265.847)', // paletteOklch.blue[3]
  sheen: 0.5,
  sheenColor: 'oklch(0.932 0.047 343.895)', // paletteOklch.magenta[11]
  shadows: 1,
  skylight: 0.5,
  rimGlow: 0.5,
  glints: 0.8,
  glintSize: 0.02,
  haze: 0.05,
  hazeColor: 'oklch(0.460 0.248 293.328)', // paletteOklch.violet[6]
  colorSpace: 'oklab',
  hueInterpolation: 'shorter',
  glideSpeed: 0.3,
  swellSpeed: 0.3,
  parallax: 0,
  intro: true,
};

import type { ColorSpace, HueInterpolation } from '@camp-dev/shaders';

/**
 * TEMPORARY (build-phase tuning only): mirrors SwellsTuning. The whole block
 * goes at the defaults gate (SHA-327).
 */
export interface SwellsTuningParams {
  stepScale: number;
  maxDistance: number;
  maxSlope: number;
  windAngle: number;
  slipFace: number;
  crestRounding: number;
  meander: number;
  rippleSize: number;
  rippleHeight: number;
  sheenFocus: number;
  reachFade: number;
  mirageStart: number;
  mirageSway: number;
  mirageClearing: number;
  hazeFadeLag: number;
}

export interface SwellsParams {
  altitude: number;
  tilt: number;
  fieldOfView: number;
  scale: number;
  relief: number;
  sharpness: number;
  ripples: number;
  sunAngle: number;
  sunHeight: number;
  color: string;
  shadowColor: string;
  sheen: number;
  sheenColor: string;
  haze: number;
  hazeColor: string;
  mirage: number;
  colorSpace: ColorSpace;
  hueInterpolation: HueInterpolation;
  tuning: SwellsTuningParams;
}

// Values mirror the component defaults in
// packages/shaders/src/components/swells. Keep the two in step.
export const INITIAL: SwellsParams = {
  altitude: 1.5,
  tilt: 12,
  fieldOfView: 50,
  scale: 4,
  relief: 0.8,
  sharpness: 1,
  ripples: 0.5,
  sunAngle: 300,
  sunHeight: 15,
  color: 'oklch(0.82 0.08 75)',
  shadowColor: 'oklch(0.45 0.06 15)',
  sheen: 0.3,
  sheenColor: 'oklch(0.97 0.03 85)',
  haze: 0.04,
  hazeColor: 'oklch(0.78 0.07 45)',
  mirage: 0.3,
  colorSpace: 'oklab',
  hueInterpolation: 'shorter',
  tuning: {
    stepScale: 0.5,
    maxDistance: 40,
    maxSlope: 3,
    windAngle: 30,
    slipFace: 0.3,
    crestRounding: 0.8,
    meander: 1.5,
    rippleSize: 0.1,
    rippleHeight: 0.008,
    sheenFocus: 12,
    reachFade: 0.4,
    mirageStart: 12,
    mirageSway: 0.003,
    mirageClearing: 0.6,
    hazeFadeLag: 2,
  },
};

import type { ColorSpace, HueInterpolation } from '@camp-dev/shaders';

/**
 * TEMPORARY (build-phase tuning only): mirrors DunesTuning. The whole block
 * goes at the defaults gate (SHA-327).
 */
export interface DunesTuningParams {
  stepScale: number;
  maxDistance: number;
  windAngle: number;
  slipFace: number;
  meander: number;
  rippleSize: number;
  rippleHeight: number;
}

export interface DunesParams {
  altitude: number;
  tilt: number;
  fieldOfView: number;
  scale: number;
  relief: number;
  ripples: number;
  sunAngle: number;
  sunHeight: number;
  color: string;
  shadowColor: string;
  colorSpace: ColorSpace;
  hueInterpolation: HueInterpolation;
  tuning: DunesTuningParams;
}

// Values mirror the component defaults in
// packages/shaders/src/components/dunes. Keep the two in step.
export const INITIAL: DunesParams = {
  altitude: 1.5,
  tilt: 12,
  fieldOfView: 50,
  scale: 4,
  relief: 0.8,
  ripples: 0.5,
  sunAngle: 300,
  sunHeight: 15,
  color: 'oklch(0.82 0.08 75)',
  shadowColor: 'oklch(0.45 0.06 15)',
  colorSpace: 'oklab',
  hueInterpolation: 'shorter',
  tuning: {
    stepScale: 0.5,
    maxDistance: 40,
    windAngle: 30,
    slipFace: 0.3,
    meander: 1.5,
    rippleSize: 0.1,
    rippleHeight: 0.008,
  },
};

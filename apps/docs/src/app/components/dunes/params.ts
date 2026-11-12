/**
 * TEMPORARY (build-phase tuning only): mirrors DunesTuning. The whole block
 * goes at the defaults gate (SHA-327).
 */
export interface DunesTuningParams {
  frequency: number;
  terrainHeight: number;
  stepScale: number;
  maxDistance: number;
}

export interface DunesParams {
  altitude: number;
  tilt: number;
  fieldOfView: number;
  tuning: DunesTuningParams;
}

// Values mirror the component defaults in
// packages/shaders/src/components/dunes. Keep the two in step.
export const INITIAL: DunesParams = {
  altitude: 1.5,
  tilt: 12,
  fieldOfView: 50,
  tuning: {
    frequency: 0.35,
    terrainHeight: 0.8,
    stepScale: 0.5,
    maxDistance: 40,
  },
};

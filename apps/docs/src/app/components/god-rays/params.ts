export interface GodRaysParams {
  centerX: number;
  centerY: number;
  density: number;
  definition: number;
  intensity: number;
  waviness: number;
  speed: number;
  // TEMPORARY (build-phase tuning only) — stripped at the defaults-tuning
  // gate along with the panel's Tuning section.
  bendAmount: number;
  bendFrequency: number;
  dappleAmount: number;
}

// Starting values only — the defaults-tuning gate at the end of the build
// has final say; keep in sync with the GodRays defaults.
export const INITIAL: GodRaysParams = {
  centerX: 0.5,
  centerY: -0.05,
  density: 12,
  definition: 0.5,
  intensity: 1,
  waviness: 1,
  speed: 1,
  bendAmount: 0.5,
  bendFrequency: 0.6,
  dappleAmount: 0.35,
};

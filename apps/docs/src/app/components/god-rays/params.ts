export interface GodRaysParams {
  centerX: number;
  centerY: number;
  intensity: number;
}

// Starting values only — the defaults-tuning gate at the end of the build
// has final say; keep in sync with the GodRays defaults.
export const INITIAL: GodRaysParams = {
  centerX: 0.5,
  centerY: -0.05,
  intensity: 1,
};

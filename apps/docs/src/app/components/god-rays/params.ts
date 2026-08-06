export interface GodRaysParams {
  centerX: number;
  centerY: number;
  density: number;
  definition: number;
  patchiness: number;
  intensity: number;
  speed: number;
  // TEMPORARY (build-phase tuning only) — stripped at the defaults-tuning
  // gate along with the panel's Tuning section.
  patchScale: number;
  flowA: number;
  flowB: number;
  fieldARadial: number;
  fieldBRadial: number;
}

// Starting values only — the defaults-tuning gate at the end of the build
// has final say; keep in sync with the GodRays defaults.
export const INITIAL: GodRaysParams = {
  centerX: 0.5,
  centerY: -0.05,
  density: 12,
  definition: 0.5,
  patchiness: 0.5,
  intensity: 1,
  speed: 1,
  patchScale: 6,
  flowA: 0.6,
  flowB: 0.4,
  fieldARadial: 2,
  fieldBRadial: 1,
};

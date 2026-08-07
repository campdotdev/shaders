export interface GodRaysParams {
  colors: string[];
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

export const MIN_COLORS = 2;
export const MAX_COLORS = 5;

// Starting values only — the defaults-tuning gate at the end of the build
// has final say; keep in sync with the GodRays defaults.
export const INITIAL: GodRaysParams = {
  colors: ['oklch(0.80 0.12 250)', 'oklch(0.70 0.16 300)', 'oklch(0.75 0.14 345)'],
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

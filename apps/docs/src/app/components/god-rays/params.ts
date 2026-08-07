export interface GodRaysParams {
  colors: string[];
  centerX: number;
  centerY: number;
  angle: number;
  spread: number;
  radius: number;
  density: number;
  diffusion: number;
  patchiness: number;
  waviness: number;
  glowRadius: number;
  glowIntensity: number;
  intensity: number;
  speed: number;
  // TEMPORARY (build-phase tuning only) — stripped at the defaults-tuning
  // gate along with the panel's Tuning section.
  patchScale: number;
  flowA: number;
  flowB: number;
  fieldARadial: number;
  fieldBRadial: number;
  bendAmount: number;
  bendFrequency: number;
  glowRayBoost: number;
  falloffStart: number;
}

export const MIN_COLORS = 2;
export const MAX_COLORS = 5;

// Starting values only — the defaults-tuning gate at the end of the build
// has final say; keep in sync with the GodRays defaults.
export const INITIAL: GodRaysParams = {
  colors: ['oklch(0.80 0.12 250)', 'oklch(0.70 0.16 300)', 'oklch(0.75 0.14 345)'],
  centerX: 0.5,
  centerY: -0.05,
  angle: 270,
  spread: 360,
  radius: 1,
  density: 12,
  diffusion: 0.5,
  patchiness: 0.5,
  waviness: 1,
  glowRadius: 0.3,
  glowIntensity: 1,
  intensity: 1,
  speed: 1,
  patchScale: 6,
  flowA: 0.6,
  flowB: 0.4,
  fieldARadial: 2,
  fieldBRadial: 1,
  bendAmount: 0.5,
  bendFrequency: 0.6,
  glowRayBoost: 4,
  falloffStart: 0.35,
};

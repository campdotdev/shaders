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
  glowRadius: number;
  glowIntensity: number;
  intensity: number;
  speed: number;
}

export const MIN_COLORS = 2;
export const MAX_COLORS = 5;

// Approved by eye at the MAT-76 defaults gate; keep in sync with the
// GodRays defaults.
export const INITIAL: GodRaysParams = {
  colors: ['oklch(0.80 0.12 250)', 'oklch(0.70 0.16 300)', 'oklch(0.75 0.14 345)'],
  centerX: 0.5,
  centerY: -0.05,
  angle: 270,
  spread: 360,
  radius: 2,
  density: 32,
  diffusion: 0.9,
  patchiness: 0.4,
  glowRadius: 0.6,
  glowIntensity: 0.7,
  intensity: 1,
  speed: 1,
};

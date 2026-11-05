// Defaults shared by the docs controls and the poster's scene.
// Keep these aligned with CursorTrail's public defaults.
export interface CursorTrailParams {
  radius: number;
  intensity: number;
  decay: number;
  hold: boolean;
  grow: number;
  smoothing: number;
}

export const INITIAL: CursorTrailParams = {
  radius: 0.1,
  intensity: 0.5,
  decay: 0.75,
  hold: false,
  grow: 0.3,
  smoothing: 0.05,
};

export interface CursorSpotlightParams {
  radius: number;
  intensity: number;
}

// Mirrors the component's own defaults exactly.
export const INITIAL: CursorSpotlightParams = {
  radius: 0.3,
  intensity: 0.75,
};

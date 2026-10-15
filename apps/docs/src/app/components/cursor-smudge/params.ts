// Defaults shared by the docs controls and the poster's scene.
// Keep these aligned with CursorSmudge's public defaults.
export interface CursorSmudgeParams {
  strength: number;
  radius: number;
  decay: number;
}

export const INITIAL: CursorSmudgeParams = {
  strength: 0.12,
  radius: 0.18,
  decay: 0.4,
};

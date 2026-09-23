export interface CursorRippleParams {
  refraction: number;
  radius: number;
  decay: number;
  shine: number;
}

export const INITIAL: CursorRippleParams = {
  refraction: 0.1,
  radius: 0.05,
  decay: 0.75,
  shine: 0.4,
};

export interface FlutedGlassParams {
  width: number;
  angle: number;
  refraction: number;
  softness: number;
  shine: number;
  shadow: number;
  sway: number;
  swayFrequency: number;
  speed: number;
}

export const INITIAL: FlutedGlassParams = {
  width: 40,
  angle: 0,
  refraction: 0.5,
  softness: 0.5,
  shine: 0.2,
  shadow: 0.25,
  sway: 0,
  swayFrequency: 1.5,
  speed: 0,
};

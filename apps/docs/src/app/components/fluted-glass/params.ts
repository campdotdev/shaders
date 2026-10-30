export interface FlutedGlassParams {
  fluteWidth: number;
  angle: number;
  refraction: number;
  dispersion: number;
  crossSection: number;
  lightAngle: number;
  highlight: number;
  highlightColor: string;
  shadow: number;
}

export const INITIAL: FlutedGlassParams = {
  fluteWidth: 30,
  angle: 90,
  refraction: 1,
  dispersion: 0.2,
  crossSection: 0.5,
  lightAngle: 135,
  highlight: 0.15,
  highlightColor: 'oklch(1 0 0)',
  shadow: 0.2,
};

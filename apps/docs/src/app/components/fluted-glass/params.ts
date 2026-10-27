/** TEMPORARY (build-phase tuning only): mirrors FlutedGlassTuning; the
 *  whole block is stripped at the defaults-tuning gate. */
export interface TuningParams {
  prismExponent: number;
  flatExponent: number;
  grooveSmoothing: number;
  lightHeight: number;
  highlightSharpness: number;
  shadowWidth: number;
}

export interface FlutedGlassParams {
  fluteWidth: number;
  angle: number;
  refraction: number;
  crossSection: number;
  lightAngle: number;
  highlight: number;
  highlightColor: string;
  shadow: number;
  tuning: TuningParams;
}

export const INITIAL: FlutedGlassParams = {
  fluteWidth: 40,
  angle: 90,
  refraction: 1,
  crossSection: 0.5,
  lightAngle: 225,
  highlight: 0.45,
  highlightColor: '#ffffff',
  shadow: 0.2,
  tuning: {
    prismExponent: 1 / 16,
    flatExponent: 16,
    grooveSmoothing: 1,
    lightHeight: 30,
    highlightSharpness: 32,
    shadowWidth: 0.5,
  },
};

/** TEMPORARY (build-phase tuning only): mirrors FlutedGlassTuning; the
 *  whole block is stripped at the defaults-tuning gate. */
export interface TuningParams {
  prismExponent: number;
  flatExponent: number;
}

export interface FlutedGlassParams {
  fluteWidth: number;
  angle: number;
  refraction: number;
  crossSection: number;
  tuning: TuningParams;
}

export const INITIAL: FlutedGlassParams = {
  fluteWidth: 40,
  angle: 90,
  refraction: 1,
  crossSection: 0.5,
  tuning: {
    prismExponent: 1 / 16,
    flatExponent: 16,
  },
};

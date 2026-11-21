/**
 * TEMPORARY (build-phase tuning only): mirrors HeatShimmerTuning. The whole
 * block goes at the defaults gate.
 */
export interface HeatShimmerTuningParams {
  foldLimit: number;
  stretch: number;
}

export interface HeatShimmerParams {
  strength: number;
  scale: number;
  tuning: HeatShimmerTuningParams;
}

// Values mirror the component defaults in
// packages/shaders/src/components/heat-shimmer. Keep the two in step.
export const INITIAL: HeatShimmerParams = {
  strength: 0.5,
  scale: 12,
  tuning: {
    foldLimit: 0.25,
    stretch: 1.5,
  },
};

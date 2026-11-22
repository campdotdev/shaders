export interface HeatShimmerParams {
  strength: number;
  scale: number;
  speed: number;
  band: boolean;
  bandPosition: number;
  bandHeight: number;
  bandFeather: number;
}

// Values mirror the component defaults in
// packages/shaders/src/components/heat-shimmer. Keep the two in step.
export const INITIAL: HeatShimmerParams = {
  strength: 0.5,
  scale: 12,
  speed: 1,
  band: false,
  bandPosition: 0.5,
  bandHeight: 0.3,
  bandFeather: 0.5,
};

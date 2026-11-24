export interface BloomParams {
  strength: number;
  radius: number;
  threshold: number;
}

// Values mirror the component defaults in
// packages/shaders/src/components/bloom. Keep the two in step.
export const INITIAL: BloomParams = {
  strength: 0.7,
  radius: 0.5,
  threshold: 0.3,
};

export interface RadialWipeParams {
  progress: number;
  /** The wipe's origin, as the component's `center` prop takes it. */
  center: [number, number];
  feather: number;
}

export const INITIAL: RadialWipeParams = {
  progress: 0.5,
  center: [0.5, 1],
  feather: 0.15,
};

'use client';

// Public face of the radial wipe: owns the props, their JSDoc, and their
// defaults, then delegates to RadialWipeShader (./shader.tsx). RadialWipe
// is a post-process layer: stack it after other components inside a
// <ShaderScene> and it reveals or hides everything beneath it from a point
// with a feathered edge. Stack a Dissolve after it to grain that edge.
import type { AnimatableProp } from '../../react/hooks/animatable-signal/animatable-signal.js';
import { RadialWipeShader } from './shader.js';

export interface RadialWipeProps {
  /**
   * The wipe. 0 hides the scene, 1 shows it, and values between sweep the
   * front outward from `center`. Defaults to 1, so the scene is fully shown
   * unless something drives it. Accepts a static value or an animation
   * signal.
   */
  progress?: AnimatableProp<number>;
  /**
   * Where the wipe starts, 0..1 across the canvas; `[0.5, 0.5]` is the
   * middle and `[0, 0]` the top-left corner. Defaults to `[0.5, 0.5]`.
   * Accepts a static value or an animation signal.
   */
  center?: AnimatableProp<readonly [number, number]>;
  /**
   * Softness of the front, as a fraction of the distance from `center` to
   * the far corner. 0 is a hard edge, 1 feathers across the whole canvas.
   * Defaults to 0.15. Accepts a static value or an animation signal.
   */
  feather?: AnimatableProp<number>;
}

export function RadialWipe({ progress = 1, center = [0.5, 0.5], feather = 0.15 }: RadialWipeProps) {
  return <RadialWipeShader center={center} feather={feather} progress={progress} />;
}

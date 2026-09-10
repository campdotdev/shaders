'use client';

// Public face of the radial wipe: owns the props, their JSDoc, and their
// defaults, then delegates to RadialWipeShader (./shader.tsx). RadialWipe
// is a post-process layer: stack it after other components inside a
// <ShaderScene> and it reveals or hides everything beneath it from a
// point, with a front that runs from a clean ring to a noise dissolve.
import type { AnimatableProp } from '../../react/hooks/animatable-signal/animatable-signal.js';
import type { RadialWipeTuning } from './shader.js';
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
   * middle and `[0, 0]` the top-left corner. Has no effect at `dissolve` 1,
   * where the front has no direction. Defaults to `[0.5, 0.5]`. Accepts a
   * static value or an animation signal.
   */
  center?: AnimatableProp<readonly [number, number]>;
  /**
   * How much of the front dissolves into noise. 0 is a clean radial wipe
   * from `center`, 1 is a full noise dissolve with no direction, and values
   * between give a wipe with a ragged edge. Defaults to 0.25. Accepts a
   * static value or an animation signal.
   */
  dissolve?: AnimatableProp<number>;
  /**
   * Block size of the dissolve's grain in CSS pixels. Each block waits its
   * own random moment, so the front arrives in blocks of this size. Match
   * it to a dot grid's spacing and the dots arrive one at a time. Defaults
   * to 4. Accepts a static value or an animation signal.
   */
  pixelSize?: AnimatableProp<number>;
  /** TEMPORARY tuning rig. Removed at the defaults gate. */
  tuning?: Partial<RadialWipeTuning>;
}

export function RadialWipe({
  progress = 1,
  center = [0.5, 0.5],
  dissolve = 0.25,
  pixelSize = 4,
  tuning,
}: RadialWipeProps) {
  return (
    <RadialWipeShader
      center={center}
      dissolve={dissolve}
      pixelSize={pixelSize}
      progress={progress}
      tuning={tuning}
    />
  );
}

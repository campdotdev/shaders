'use client';

// Public face of the dissolve: owns the props, their JSDoc, and their
// defaults, then delegates to DissolveShader (./shader.tsx). Dissolve is a
// post-process layer: stack it after other components inside a
// <ShaderScene> and it turns everything beneath it into grain, shown block
// by block as `progress` rises. Stack it after a feathered wipe and it
// grains the wipe's soft edge.
import type { AnimatableProp } from '../../react/hooks/animatable-signal/animatable-signal.js';
import type { DissolveTuning } from './shader.js';
import { DissolveShader } from './shader.js';

export interface DissolveProps {
  /**
   * The dissolve. 0 hides the scene, 1 shows every block the scene's own
   * alpha allows, and values between show a matching share of blocks.
   * Defaults to 1, so the scene is fully shown unless something drives it
   * or a soft edge beneath it holds some blocks back. Accepts a static
   * value or an animation signal.
   */
  progress?: AnimatableProp<number>;
  /**
   * Block size of the grain in CSS pixels. Each block waits its own random
   * moment, so the scene arrives in blocks of this size. Match it to a dot
   * grid's spacing and the dots arrive one at a time. Defaults to 4.
   * Accepts a static value or an animation signal.
   */
  pixelSize?: AnimatableProp<number>;
  /** TEMPORARY tuning rig. Removed at the defaults gate. */
  tuning?: Partial<DissolveTuning>;
}

export function Dissolve({ progress = 1, pixelSize = 4, tuning }: DissolveProps) {
  return <DissolveShader pixelSize={pixelSize} progress={progress} tuning={tuning} />;
}

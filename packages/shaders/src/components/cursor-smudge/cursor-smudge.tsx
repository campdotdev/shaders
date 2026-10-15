'use client';

// Public controls for a directional cursor effect. The shader half owns
// its displacement field and reads the scene's shared cursor Input.
// Numeric controls ride uniforms, so animation signals keep the material stable.
import type { AnimatableProp } from '../../react/hooks/animatable-signal/animatable-signal.js';
import { CursorSmudgeShader } from './shader.js';

export interface CursorSmudgeProps {
  /**
   * Maximum image pull in canvas heights. 0 disables distortion. Defaults
   * to 0.12. Accepts a static value or an animation signal.
   */
  strength?: AnimatableProp<number>;
  /**
   * Brush radius in canvas heights, with a soft edge. 0 accepts no new
   * strokes. Defaults to 0.18. Accepts a static value or an animation signal.
   */
  radius?: AnimatableProp<number>;
  /**
   * Recovery speed, 0..1. 0 holds the distortion until decay is raised or
   * strength is set to 0. Positive values remove 90% of a pull in about
   * four seconds near 0 and 0.2 seconds at 1. Resizing or remounting clears
   * the distortion. Defaults to 0.4.
   * Accepts a static value or an animation signal.
   */
  decay?: AnimatableProp<number>;
}

export function CursorSmudge({ strength = 0.12, radius = 0.18, decay = 0.4 }: CursorSmudgeProps) {
  return <CursorSmudgeShader decay={decay} radius={radius} strength={strength} />;
}

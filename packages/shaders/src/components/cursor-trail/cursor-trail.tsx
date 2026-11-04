'use client';

// Public controls for a cursor effect that heats the image where the pointer
// passes and lets the heat cool, so the pointer leaves a fading trail. The
// shader half owns the heat field and reads the scene's shared cursor Input.
// Numeric controls ride uniforms, so animation signals keep the material stable.
import type { AnimatableProp } from '../../react/hooks/animatable-signal/animatable-signal.js';
import { CursorTrailShader } from './shader.js';

export interface CursorTrailProps {
  /**
   * Brush radius in canvas heights, with a soft edge. 0 lays down no new
   * heat. Defaults to 0.1. Accepts a static value or an animation signal.
   */
  radius?: AnimatableProp<number>;
  /**
   * Light added at full heat, in linear color. 0 disables the effect.
   * Defaults to 0.5. Accepts a static value or an animation signal.
   */
  intensity?: AnimatableProp<number>;
  /**
   * Seconds for full heat to cool to nothing. A faster pointer covers more
   * ground in that time, so it leaves a longer trail. 0 keeps no trail.
   * Defaults to 0.5. Accepts a static value or an animation signal.
   */
  decay?: AnimatableProp<number>;
}

export function CursorTrail({ radius = 0.1, intensity = 0.5, decay = 0.5 }: CursorTrailProps) {
  return <CursorTrailShader decay={decay} intensity={intensity} radius={radius} />;
}

'use client';

// Public face of the LED wall: owns the props, their JSDoc, and their
// defaults, then delegates to LedWallShader (./shader.tsx). LedWall is a
// post-process layer: stack it after other components inside a
// <ShaderScene> and it screens everything beneath it into a grid of square
// dots, each lit with the scene color at its cell's center.
import type { AnimatableProp } from '../../react/hooks/animatable-signal/animatable-signal.js';
import type { LedWallTuning } from './shader.js';
import { LedWallShader } from './shader.js';

export interface LedWallProps {
  /**
   * Cell pitch in CSS pixels. Defaults to 5. Accepts a static value or an
   * animation signal.
   */
  spacing?: AnimatableProp<number>;
  /**
   * Edge of the square dot in CSS pixels. Defaults to 2. Accepts a static
   * value or an animation signal.
   */
  dotSize?: AnimatableProp<number>;
  /**
   * How much of the scene shows between the dots. 0 leaves the gaps
   * transparent so the page background shows through, 1 leaves the scene
   * untouched there. Defaults to 0. Accepts a static value or an animation
   * signal.
   */
  bleed?: AnimatableProp<number>;
  /**
   * The reveal. 0 hides every dot, 1 lights every dot, and values between
   * sweep the front outward from `center`. Defaults to 1, so the wall is
   * fully lit unless something drives it. Accepts a static value or an
   * animation signal.
   */
  progress?: AnimatableProp<number>;
  /**
   * Where the reveal starts, 0..1 across the canvas; `[0.5, 0.5]` is the
   * middle and `[0, 0]` the top-left corner. Defaults to `[0.5, 0.5]`.
   * Accepts a static value or an animation signal.
   */
  center?: AnimatableProp<readonly [number, number]>;
  /**
   * Shape of the reveal front. 0 is a clean ring around `center` with a
   * little per-dot static, 1 is a fully warped front with fingers and bays.
   * Defaults to 0.25. Accepts a static value or an animation signal.
   */
  waviness?: AnimatableProp<number>;
  /** TEMPORARY tuning rig. Removed at the defaults gate. */
  tuning?: Partial<LedWallTuning>;
}

export function LedWall({
  spacing = 5,
  dotSize = 2,
  bleed = 0,
  progress = 1,
  center = [0.5, 0.5],
  waviness = 0.25,
  tuning,
}: LedWallProps) {
  return (
    <LedWallShader
      bleed={bleed}
      center={center}
      dotSize={dotSize}
      progress={progress}
      spacing={spacing}
      tuning={tuning}
      waviness={waviness}
    />
  );
}

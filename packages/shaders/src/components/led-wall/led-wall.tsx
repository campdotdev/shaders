'use client';

// Public face of the LED wall: owns the props, their JSDoc, and their
// defaults, then delegates to LedWallShader (./shader.tsx). LedWall is a
// post-process layer: stack it after other components inside a
// <ShaderScene> and it screens everything beneath it into a grid of square
// dots, each lit with the scene color at its cell's center.
import type { AnimatableProp } from '../../react/hooks/animatable-signal/animatable-signal.js';
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
}

export function LedWall({ spacing = 5, dotSize = 2, bleed = 0 }: LedWallProps) {
  return <LedWallShader bleed={bleed} dotSize={dotSize} spacing={spacing} />;
}

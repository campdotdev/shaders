'use client';

// Public face of the LED wall: owns the props, their JSDoc, and their
// defaults, then delegates to LedWallShader (./shader.tsx). LedWall is a
// post-process layer: stack it after other components inside a
// <ShaderScene> and it screens everything beneath it into a grid of square
// dots, each lit with the scene color at its cell's center.
import type {
  AnimatableProp,
  PositionProp,
} from '../../react/hooks/animatable-signal/animatable-signal.js';
import { LedWallShader } from './shader.js';

export interface LedWallProps {
  /**
   * Cell pitch in CSS pixels. Defaults to 8. Accepts a static value or an
   * animation signal.
   */
  spacing?: AnimatableProp<number>;
  /**
   * Edge of the square dot in CSS pixels. Defaults to 4. Accepts a static
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
   * How deep each dot's brightness breathes over time, on its own phase and
   * tempo. 0 holds every dot still, 1 takes each dot all the way to dark at
   * the bottom of every breath. Defaults to 0.5. Accepts a static value or
   * an animation signal.
   */
  flicker?: AnimatableProp<number>;
  /**
   * Tempo of the flicker. Each dot breathes between 0.8 and 1.2 times this
   * rate, and 1 is roughly one breath every six seconds. Defaults to 2.4.
   * Accepts a static value or an animation signal.
   */
  speed?: AnimatableProp<number>;
  /**
   * Center of the swell: the point the dots grow toward, 0..1 across the
   * canvas with `[0, 0]` at the top-left corner. Defaults to `[0.5, 0.5]`.
   * Pass `"cursor"` to follow the pointer, which parks the swell below the
   * canvas until the first move. Accepts a static value or an animation
   * signal.
   */
  swellCenter?: PositionProp;
  /**
   * Reach of the swell from its center, in canvas units where 1 is the
   * canvas height. Defaults to 0.6. Accepts a static value or an animation
   * signal.
   */
  swellRadius?: AnimatableProp<number>;
  /**
   * How much a dot grows at the swell center, as a fraction of its edge. 0
   * turns the swell off, 1 doubles the edge at the center, and the cell caps
   * it so a dot never touches its neighbour. Defaults to 0.85. Accepts a
   * static value or an animation signal.
   */
  swell?: AnimatableProp<number>;
}

export function LedWall({
  spacing = 8,
  dotSize = 4,
  bleed = 0,
  flicker = 0.5,
  speed = 2.4,
  swellCenter = [0.5, 0.5],
  swellRadius = 0.6,
  swell = 0.85,
}: LedWallProps) {
  return (
    <LedWallShader
      bleed={bleed}
      dotSize={dotSize}
      flicker={flicker}
      spacing={spacing}
      speed={speed}
      swell={swell}
      swellCenter={swellCenter}
      swellRadius={swellRadius}
    />
  );
}

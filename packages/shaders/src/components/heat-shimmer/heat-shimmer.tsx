'use client';

// Public face of the heat shimmer: owns the props, their JSDoc, and their
// defaults, then delegates to HeatShimmerShader (./shader.tsx). HeatShimmer
// is an Effect: stack it after the Sources it should act on inside a
// <ShaderScene>, and the image beneath wavers as if seen through hot air.
import type { AnimatableProp } from '../../react/hooks/animatable-signal/animatable-signal.js';
import { useStaticSceneHint } from '../../react/hooks/use-static-hint/use-static-hint.js';
import { isHeatShimmerIdle } from './idle.js';
import { HeatShimmerShader } from './shader.js';

export interface HeatShimmerProps {
  /**
   * How hard the shimmer pushes, from 0 to 1. 0 leaves the image unchanged,
   * and 1 is close to the most the image takes before it folds. A low
   * `scale` can fold it sooner. Values outside 0 to 1 clamp. Defaults to 0.5.
   * Accepts a static value or an animation signal.
   */
  strength?: AnimatableProp<number>;
  /**
   * How many lumps of shift fit in the canvas's height. Higher is more and
   * smaller, as on FractalNoise and SimplexNoise. A change of scale keeps
   * the look's strength. Defaults to 12. Accepts a static value or an
   * animation signal.
   */
  scale?: AnimatableProp<number>;
  /**
   * A multiplier on the shimmer's pace, where 1 is the tuned pace. A
   * negative value makes the shimmer sink, and 0 holds it still as a fixed
   * warp. A change of speed changes the pace without making the pattern
   * jump. Defaults to 1. Accepts a static value or an animation signal.
   */
  speed?: AnimatableProp<number>;
  /**
   * Confines the shimmer to a horizontal band, which `bandPosition`,
   * `bandHeight`, and `bandFeather` place. Off, the whole image wavers.
   * Toggling it rebuilds nothing. Defaults to false.
   */
  band?: boolean;
  /**
   * The band's middle, from 0 at the top of the canvas to 1 at the bottom.
   * It takes a number, not `'cursor'`. To put the band on Swells' horizon,
   * set it to `0.5 - tan(tilt) / (2 * tan(fieldOfView / 2))`, with both
   * angles in radians. At Swells' defaults, a `tilt` of 12 degrees and a
   * `fieldOfView` of 32, that is 0.129. Only `tilt` and `fieldOfView` move
   * Swells' horizon, so a signal here can follow an animated `tilt`.
   * Defaults to 0.5. Accepts a static value or an animation signal.
   */
  bandPosition?: AnimatableProp<number>;
  /**
   * The band's full height, as a share of the canvas's height. 1 spans the
   * canvas, and 0 leaves no band at all. Defaults to 0.3. Accepts a static
   * value or an animation signal.
   */
  bandHeight?: AnimatableProp<number>;
  /**
   * The share of the band, from each edge inward, that fades, from 0 to 1.
   * 0 gives hard edges, and 1 fades all the way to the middle, so only the
   * middle row gets the full shimmer. Values outside 0 to 1 clamp. Defaults
   * to 0.5. Accepts a static value or an animation signal.
   */
  bandFeather?: AnimatableProp<number>;
}

/**
 * Hot air over the scene: the image beneath wavers as if seen through
 * rising heat, and the shimmer rises and changes shape as it goes, across
 * the whole canvas or, with `band` on, in a soft horizontal band. Mount it
 * inside a `<ShaderScene>` after the Sources it should act on. It moves only
 * what Sources drew, so an Effect such as Grain stays still above or below
 * it, and over a flat color it shows nothing. It slows under reduced motion.
 * Mode 1 only, because it needs the scene's output stage.
 */
export function HeatShimmer({
  strength = 0.5,
  scale = 12,
  speed = 1,
  band = false,
  bandPosition = 0.5,
  bandHeight = 0.3,
  bandFeather = 0.5,
}: HeatShimmerProps) {
  // The idle vote. The clock moves the shimmer every frame, so it votes
  // animated, unless it moves the image by nothing or its clock holds
  // still. Then a scene of still Sources under it parks (./idle.ts).
  useStaticSceneHint(isHeatShimmerIdle({ strength, speed }));

  return (
    <HeatShimmerShader
      band={band}
      bandFeather={bandFeather}
      bandHeight={bandHeight}
      bandPosition={bandPosition}
      scale={scale}
      speed={speed}
      strength={strength}
    />
  );
}

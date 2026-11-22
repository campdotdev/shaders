'use client';

// Public face of the heat shimmer: owns the props, their JSDoc, and their
// defaults, then delegates to HeatShimmerShader (./shader.tsx). HeatShimmer
// is an Effect: stack it after the Sources it should act on inside a
// <ShaderScene>, and the image beneath wavers as if seen through hot air.
import type { AnimatableProp } from '../../react/hooks/animatable-signal/animatable-signal.js';
import { useStaticSceneHint } from '../../react/hooks/use-static-hint/use-static-hint.js';
import { isHeatShimmerIdle } from './idle.js';
import { HeatShimmerShader, type HeatShimmerTuning } from './shader.js';

export type { HeatShimmerTuning } from './shader.js';

export interface HeatShimmerProps {
  /**
   * How hard the shimmer pushes, from 0 to 1, where 1 is the most that
   * can't fold the image and 0 leaves it unchanged. Values outside 0 to 1
   * clamp. Defaults to 0.5. Accepts a static value or an animation signal.
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
   * TEMPORARY (build-phase tuning only): dev overrides for the feel
   * constants. Stripped at the defaults gate, so don't use it.
   */
  tuning?: HeatShimmerTuning;
}

/**
 * Hot air over the scene: the image beneath wavers as if seen through
 * rising heat, and the shimmer rises and changes shape as it goes. Mount it
 * inside a `<ShaderScene>` after the Sources it should act on. It moves only
 * what Sources drew, so an Effect such as Grain stays still above or below
 * it, and over a flat color it shows nothing. It slows under reduced motion.
 * Mode 1 only, because it needs the scene's output stage.
 */
export function HeatShimmer({ strength = 0.5, scale = 12, speed = 1, tuning }: HeatShimmerProps) {
  // `strength` and `scale` are provisional until the defaults gate tunes
  // them by eye.
  //
  // The idle vote. The clock moves the shimmer every frame, so it votes
  // animated, unless it moves the image by nothing or its clock holds
  // still. Then a scene of still Sources under it parks (./idle.ts).
  useStaticSceneHint(isHeatShimmerIdle({ strength, speed }));

  return <HeatShimmerShader scale={scale} speed={speed} strength={strength} tuning={tuning} />;
}

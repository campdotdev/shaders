'use client';

// Public face of the heat shimmer: owns the props, their JSDoc, and their
// defaults, then delegates to HeatShimmerShader (./shader.tsx). HeatShimmer
// is an Effect: stack it after the Sources it should act on inside a
// <ShaderScene>, and the image beneath wavers as if seen through hot air.
import type { AnimatableProp } from '../../react/hooks/animatable-signal/animatable-signal.js';
import { useStaticSceneHint } from '../../react/hooks/use-static-hint/use-static-hint.js';
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
   * TEMPORARY (build-phase tuning only): dev overrides for the feel
   * constants. Stripped at the defaults gate, so don't use it.
   */
  tuning?: HeatShimmerTuning;
}

/**
 * Hot air over the scene: the image beneath wavers as if seen through
 * rising heat. Mount it inside a `<ShaderScene>` after the Sources it should
 * act on. It moves only what Sources drew, so an Effect such as Grain stays
 * still above or below it, and over a flat color it shows nothing. Mode 1
 * only, because it needs the scene's output stage.
 */
export function HeatShimmer({ strength = 0.5, scale = 12, tuning }: HeatShimmerProps) {
  // The defaults above are provisional until the defaults gate tunes them
  // by eye.
  //
  // The idle vote. The shimmer has no clock yet, so nothing it draws
  // changes over time, and every dial repaints through its uniform when it
  // moves. It votes idle, and a scene of still Sources under it parks.
  useStaticSceneHint(true);

  return <HeatShimmerShader scale={scale} strength={strength} tuning={tuning} />;
}

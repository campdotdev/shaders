'use client';

// Public face of the bloom: owns the props, their JSDoc, and their defaults,
// then delegates to BloomShader (./shader.tsx). Bloom is an Effect: stack it
// after the Sources it should act on inside a <ShaderScene>. In this build
// phase it shows only the light that will bloom, over black, and the spill
// arrives in a later phase.
import type { AnimatableProp } from '../../react/hooks/animatable-signal/animatable-signal.js';
import { BloomShader } from './shader.js';

export interface BloomProps {
  /**
   * How bright a part of the image has to be before it blooms, as a
   * luminance, where 0 is black and 1 is the brightest white a screen
   * shows. 0 blooms everything. Light fades in over the range from half
   * the threshold up to it, so nothing switches on at a hard edge. A
   * Source that adds light can pass 1, so values above 1 work. Negative
   * values act as 0. Defaults to 0.7. Accepts a static value or an
   * animation signal.
   */
  threshold?: AnimatableProp<number>;
}

/**
 * Light that spills from the bright parts of the image beneath. Mount it
 * inside a `<ShaderScene>` after the Sources it should act on. In this build
 * phase it shows only the light that passes `threshold`, over black. Mode 1
 * only, because it needs the scene's output stage.
 */
export function Bloom({ threshold = 0.7 }: BloomProps) {
  return <BloomShader threshold={threshold} />;
}

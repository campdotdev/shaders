'use client';

// Public face of the grain overlay: owns the props, their JSDoc, and their
// defaults, then delegates to GrainShader (./shader.tsx). Grain is a
// post-process layer — stack it after other components inside a
// <ShaderScene> and it textures whatever rendered beneath it.
import type { AnimatableProp } from '@camp-dev/shaders-react';

import { type GrainBlend, GrainShader } from './shader';

export type { GrainBlend } from './shader';

export interface GrainProps {
  /**
   * Grain strength: each pixel's brightness shifts by a random amount up to
   * half this value in either direction. 0 = no grain. Defaults to 0.15.
   * Accepts a static value or an animation signal.
   */
  intensity?: AnimatableProp<number>;
  /**
   * How fast the grain pattern re-rolls, relative to 60 fps. 0 freezes the
   * pattern on a static frame. Defaults to 0.3. Accepts a static value or
   * an animation signal.
   */
  speed?: AnimatableProp<number>;
  /**
   * How the grain combines with the image: `'additive'` brightens and
   * darkens symmetrically; `'subtractive'` only darkens (specks on the
   * image). Defaults to `'additive'`.
   */
  blend?: GrainBlend;
}

export function Grain({ intensity = 0.15, speed = 0.3, blend = 'additive' }: GrainProps) {
  return <GrainShader blend={blend} intensity={intensity} speed={speed} />;
}

'use client';

// Public face of the dither effect: owns the props, their JSDoc, and their
// defaults, then delegates to DitherShader (./shader.tsx). Dither is a
// post-process layer — stack it after other components inside a
// <ShaderScene> and it pixelates and posterizes everything beneath it.
import type { AnimatableProp } from '@lovo/matter-react';

import { type DitherPattern, DitherShader } from './shader';

export type { DitherPattern } from './shader';

export interface DitherProps {
  /**
   * Edge length of one dither cell in CSS pixels — bigger cells, chunkier
   * image. Defaults to 2. Accepts a static value or an animation signal.
   */
  pixelSize?: AnimatableProp<number>;
  /**
   * Quantization levels per color channel. 2 is the harshest two-tone look;
   * around 6 reads as subtle banding. Fractional values animate the spacing
   * continuously. Defaults to 4. Accepts a static value or an animation
   * signal.
   */
  levels?: AnimatableProp<number>;
  /**
   * Which threshold map drives the dither. Defaults to `'bayer-8x8'`, the
   * smoothest of the Bayer matrices.
   */
  pattern?: DitherPattern;
}

export function Dither({ pixelSize = 2, levels = 4, pattern = 'bayer-8x8' }: DitherProps) {
  return <DitherShader levels={levels} pattern={pattern} pixelSize={pixelSize} />;
}

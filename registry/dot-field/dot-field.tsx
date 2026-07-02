'use client';

import type { AnimatableProp } from '@lovo/matter-react';

import { DotFieldShader } from './shader';

export interface DotFieldProps {
  /** Grid cell size in pixels. */
  spacing?: AnimatableProp<number>;
  /** Dot radius in pixels. */
  dotSize?: AnimatableProp<number>;
  /** Dot color — hex, `oklch()`, or `oklab()`. */
  color?: string;
}

export function DotField({ spacing = 30, dotSize = 2, color = '#8B918C' }: DotFieldProps) {
  return <DotFieldShader color={color} dotSize={dotSize} spacing={spacing} />;
}

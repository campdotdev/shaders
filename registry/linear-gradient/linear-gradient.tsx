'use client';

import type { AnimatableProp } from '@lovo/matter-react';

import { LinearGradientShader } from './shader';

export interface LinearGradientProps {
  colors?: string[];
  angle?: AnimatableProp<number>;
  focalPoint?: AnimatableProp<readonly [number, number]>;
  speed?: AnimatableProp<number>;
  interactive?: boolean;
}

const DEFAULT_COLORS = [
  '#661acc', // palette.violet.base
  '#9e00ba', // palette.purple.base
  '#8c0067', // palette.magenta.dark
];

export function LinearGradient({
  colors = DEFAULT_COLORS,
  angle = 0,
  focalPoint = [0.5, 0.5],
  speed = 0,
  interactive = false,
}: LinearGradientProps) {
  return (
    <LinearGradientShader
      angle={angle}
      colors={colors}
      focalPoint={focalPoint}
      interactive={interactive}
      speed={speed}
    />
  );
}

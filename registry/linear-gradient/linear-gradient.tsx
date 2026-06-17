'use client';

import type { ColorSpace, HueInterpolation } from '@lovo/matter';
import type { AnimatableProp } from '@lovo/matter-react';

import type { ColorStop } from '../utils/color';
import { LinearGradientShader } from './shader';

export type { ColorStop } from '../utils/color';

export interface LinearGradientProps {
  stops?: ColorStop[];
  angle?: AnimatableProp<number>;
  focalPoint?: AnimatableProp<readonly [number, number]>;
  speed?: AnimatableProp<number>;
  interactive?: boolean;
  colorSpace?: ColorSpace;
  hueInterpolation?: HueInterpolation;
}

const DEFAULT_STOPS: ColorStop[] = [
  { color: '#661acc' }, // palette.violet.base
  { color: '#9e00ba' }, // palette.purple.base
  { color: '#8c0067' }, // palette.magenta.dark
];

export function LinearGradient({
  stops = DEFAULT_STOPS,
  angle = 0,
  focalPoint = [0.5, 0.5],
  speed = 0,
  interactive = false,
  colorSpace = 'oklab',
  hueInterpolation = 'shorter',
}: LinearGradientProps) {
  return (
    <LinearGradientShader
      angle={angle}
      colorSpace={colorSpace}
      focalPoint={focalPoint}
      hueInterpolation={hueInterpolation}
      interactive={interactive}
      speed={speed}
      stops={stops}
    />
  );
}

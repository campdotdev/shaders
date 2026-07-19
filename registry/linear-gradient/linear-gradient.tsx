'use client';

import type { ColorSpace, HueInterpolation } from '@lovo/matter';
import type { AnimatableProp } from '@lovo/matter-react';

import type { ColorStop } from '../utils/color';
import { LinearGradientShader } from './shader';

export type { ColorStop } from '../utils/color';

export interface LinearGradientProps {
  /**
   * Colors along the gradient. Accepts hex, `oklch()`, or `oklab()`;
   * positions auto-space when omitted.
   */
  stops?: ColorStop[];
  /**
   * Gradient direction in degrees. 0 runs left to right, 90 runs bottom to
   * top. Defaults to 0. Accepts a static value or an animation signal.
   */
  angle?: AnimatableProp<number>;
  /**
   * Anchor point of the gradient in normalized UV; `[0.5, 0.5]` is centered.
   * The point on screen where the first color stop sits. Defaults to
   * `[0.5, 0.5]`. Accepts a static value or an animation signal.
   */
  center?: AnimatableProp<readonly [number, number]>;
  /**
   * Speed of the back-and-forth color drift along the gradient. 0 gives a
   * static gradient. Defaults to 0. Accepts a static value or an animation
   * signal.
   */
  speed?: AnimatableProp<number>;
  /** Color space the gradient is interpolated in. Defaults to `'oklab'`. */
  colorSpace?: ColorSpace;
  /**
   * Hue arc for cylindrical color spaces (oklch/lch/hsl/hsv); inert
   * otherwise. Defaults to `'shorter'`.
   */
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
  center = [0.5, 0.5],
  speed = 0,
  colorSpace = 'oklab',
  hueInterpolation = 'shorter',
}: LinearGradientProps) {
  return (
    <LinearGradientShader
      angle={angle}
      center={center}
      colorSpace={colorSpace}
      hueInterpolation={hueInterpolation}
      speed={speed}
      stops={stops}
    />
  );
}

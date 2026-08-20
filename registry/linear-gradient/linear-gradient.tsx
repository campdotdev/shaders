'use client';

// Public face of the linear gradient: this file owns the props, their JSDoc,
// and their default values, then hands everything to LinearGradientShader
// (./shader.tsx), which does the actual GPU work. Render it inside a
// <ShaderScene> — the component draws nothing on its own.
import type { ColorSpace, HueInterpolation } from '@mattermix/shaders';
import type { AnimatableProp } from '@mattermix/shaders-react';

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
   * Anchor point of the gradient, 0..1 across the canvas; `[0.5, 0.5]` is
   * centered and `[0, 0]` is the top-left corner. The middle of the color
   * ramp sits at the anchor, so moving it slides the whole gradient along
   * its direction. Defaults to `[0.5, 0.5]`. Accepts a static value or an
   * animation signal.
   */
  center?: AnimatableProp<readonly [number, number]>;
  /**
   * How many times the stops run across the gradient's span. 1 is a single
   * pass; above 1 the pattern tiles past both ends, so stripes run edge to
   * edge at any angle. Each pass runs the stops in the same direction and
   * snaps back to the first, so unless the first and last stop match there
   * is a visible edge at every stripe boundary. Values at or below 1 render
   * as a single pass. Defaults to 1. Accepts a static value or an animation
   * signal.
   */
  repeat?: AnimatableProp<number>;
  /**
   * Speed of the gradient's motion. At a single pass the colors drift back
   * and forth along the axis; combined with `repeat` above 1 the stripes
   * march steadily in the angle's direction instead. 0 gives a static
   * gradient. Defaults to 0. Accepts a static value or an animation signal.
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

// Three neighboring hues (violet -> purple -> magenta). Keeping the stops
// close on the color wheel means the in-between colors stay saturated
// instead of washing out toward gray.
const DEFAULT_STOPS: ColorStop[] = [
  { color: 'oklch(0.650 0.212 293.328)' }, // paletteOklch.violet[8]
  { color: 'oklch(0.460 0.211 320)' }, // paletteOklch.purple[6]
  { color: 'oklch(0.346 0.121 343.895)' }, // paletteOklch.magenta[4]
];

export function LinearGradient({
  stops = DEFAULT_STOPS,
  angle = 0,
  center = [0.5, 0.5],
  repeat = 1,
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
      repeat={repeat}
      speed={speed}
      stops={stops}
    />
  );
}

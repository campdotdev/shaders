'use client';

// Public face of the conic gradient: this file owns the props, their JSDoc,
// and their default values, then hands everything to ConicGradientShader
// (./shader.tsx), which does the actual GPU work. Render it inside a
// <ShaderScene> — the component draws nothing on its own.
import type { ColorSpace, HueInterpolation } from '@lovo/matter';
import type { AnimatableProp } from '@lovo/matter-react';

import type { ColorStop } from '../utils/color';
import { ConicGradientShader } from './shader';

export type { ColorStop } from '../utils/color';

export interface ConicGradientProps {
  /**
   * Colors around the sweep, running clockwise from the top. Accepts hex,
   * `oklch()`, or `oklab()`; positions auto-space when omitted. The sweep
   * wraps back to its start, so unless the first and last colors match there
   * is a hard seam where it closes — repeat the first color as the last stop
   * for a seamless wheel, as the default does.
   */
  stops?: ColorStop[];
  /**
   * Pivot the sweep rotates around, 0..1 across the canvas; `[0.5, 0.5]` is
   * centered and `[0, 0]` is the top-left corner. Defaults to `[0.5, 0.5]`.
   * Accepts a static value or an animation signal.
   */
  center?: AnimatableProp<readonly [number, number]>;
  /**
   * Degrees; rotates the whole sweep clockwise. 0 starts the first stop at
   * 12 o'clock. Note the direction: LinearGradient and RadialGradient's
   * `angle` turns counterclockwise, but this one follows CSS conic-gradient
   * and turns clockwise. Defaults to 0. Accepts a static value or an
   * animation signal.
   */
  angle?: AnimatableProp<number>;
  /**
   * How many times the ramp runs around the full circle. 1 is a single
   * sweep; above 1 gives a pinwheel of sectors, below 1 spreads that
   * fraction of the ramp around the whole circle. Each pass runs the stops
   * clockwise and then snaps back to the first, so unless your first and
   * last stop match there is a visible seam at every sector boundary — and
   * at values that aren't whole numbers, a mismatched wedge where the sweep
   * closes. Defaults to 1. Accepts a static value or an animation signal.
   */
  repeat?: AnimatableProp<number>;
  /** Color space the gradient is interpolated in. Defaults to `'oklab'`. */
  colorSpace?: ColorSpace;
  /**
   * Hue arc for cylindrical color spaces (oklch/lch/hsl/hsv); inert
   * otherwise. Defaults to `'shorter'`.
   */
  hueInterpolation?: HueInterpolation;
}

// The radial gradient's palette with the loop closed: magenta at the top,
// cooling through purple and blue around the circle, then the first color
// repeated so the sweep meets itself with no seam. The return leg
// (blue 266 -> magenta 344) spans 78 degrees — the same arc the radial
// default crosses — so its midpoint keeps chroma instead of washing toward
// gray, and the lightness climb back up (0.303 -> 0.720) spreads over a full
// third of the circle, reading as a glow rather than an edge. Duplicating
// the first stop is also the recipe users copy when they want a seamless
// loop of their own.
const DEFAULT_STOPS: ColorStop[] = [
  { color: 'oklch(0.720 0.281 343.895)' }, // paletteOklch.magenta[9]
  { color: 'oklch(0.460 0.211 320)' }, // paletteOklch.purple[6]
  { color: 'oklch(0.303 0.152 265.847)' }, // paletteOklch.blue[3]
  { color: 'oklch(0.720 0.281 343.895)' }, // magenta[9] again — closes the loop
];

export function ConicGradient({
  stops = DEFAULT_STOPS,
  center = [0.5, 0.5],
  angle = 0,
  repeat = 1,
  colorSpace = 'oklab',
  hueInterpolation = 'shorter',
}: ConicGradientProps) {
  return (
    <ConicGradientShader
      angle={angle}
      center={center}
      colorSpace={colorSpace}
      hueInterpolation={hueInterpolation}
      repeat={repeat}
      stops={stops}
    />
  );
}

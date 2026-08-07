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
  colorSpace = 'oklab',
  hueInterpolation = 'shorter',
}: ConicGradientProps) {
  return (
    <ConicGradientShader
      center={center}
      colorSpace={colorSpace}
      hueInterpolation={hueInterpolation}
      stops={stops}
    />
  );
}

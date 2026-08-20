'use client';

// Public face of the radial gradient: this file owns the props, their JSDoc,
// and their default values, then hands everything to RadialGradientShader
// (./shader.tsx), which does the actual GPU work. Render it inside a
// <ShaderScene> — the component draws nothing on its own.
import type { ColorSpace, HueInterpolation } from '@mattermix/shaders';
import type { AnimatableProp } from '@mattermix/shaders-react';

import type { ColorStop } from '../utils/color';
import { RadialGradientShader } from './shader';

export type { ColorStop } from '../utils/color';

export interface RadialGradientProps {
  /**
   * Colors along the gradient, running from the center outward. Accepts hex,
   * `oklch()`, or `oklab()`; positions auto-space when omitted.
   */
  stops?: ColorStop[];
  /**
   * Where the gradient starts, 0..1 across the canvas; `[0.5, 0.5]` is
   * centered and `[0, 0]` is the top-left corner. Note this is the ramp's
   * origin — the first stop sits here and the colors run outward — unlike the
   * linear gradient's `center`, which slides the ramp's midpoint along its
   * axis. Defaults to `[0.5, 0.5]`. Accepts a static value or an animation
   * signal.
   */
  center?: AnimatableProp<readonly [number, number]>;
  /**
   * How far out the ramp reaches its last color, where 1 lands at the canvas
   * corners. Below 1 the gradient tightens toward the center and the final
   * color floods the rest; above 1 only the inner part of the ramp is visible.
   * Defaults to 1. Accepts a static value or an animation signal.
   */
  radius?: AnimatableProp<number>;
  /**
   * Squashes the circle into an ellipse. 1 is a circle; above 1 stretches it
   * wider, below 1 stretches it taller. Defaults to 1. Accepts a static value
   * or an animation signal.
   */
  stretch?: AnimatableProp<number>;
  /**
   * Rotation of the ellipse in degrees, counterclockwise. At 0 `stretch` acts
   * horizontally, at 90 it acts vertically. Has no visible effect while
   * `stretch` is 1, because a circle looks the same at every angle. Defaults
   * to 0. Accepts a static value or an animation signal.
   */
  angle?: AnimatableProp<number>;
  /**
   * How many times the ramp runs between the center and `radius`. 1 is a
   * single pass; above 1 gives concentric rings. Each ring runs the stops in
   * the same direction and then snaps back to the first, so unless your first
   * and last stop match you get a visible edge at every ring boundary.
   * Defaults to 1. Accepts a static value or an animation signal.
   */
  repeat?: AnimatableProp<number>;
  /**
   * How fast the ramp drifts outward from the center. 0 holds it still.
   * Combined with `repeat` above 1 this reads as rings travelling outward.
   * Defaults to 0. Accepts a static value or an animation signal.
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

// A hot pink core cooling through purple into deep blue. The hues walk one
// direction around the wheel (344 -> 320 -> 266) and stay on the same side of
// it, so no pair is complementary and the blended midpoints keep their chroma
// instead of washing toward gray. Depth comes from the lightness drop —
// 0.720 -> 0.460 -> 0.303 in OKLCH, each step well past the 0.10 minimum —
// rather than from the hue walk. This mirrors the linear gradient's default,
// which shares the purple middle stop and travels the other way.
const DEFAULT_STOPS: ColorStop[] = [
  { color: 'oklch(0.720 0.281 343.895)' }, // paletteOklch.magenta[9]
  { color: 'oklch(0.460 0.211 320)' }, // paletteOklch.purple[6]
  { color: 'oklch(0.303 0.152 265.847)' }, // paletteOklch.blue[3]
];

export function RadialGradient({
  stops = DEFAULT_STOPS,
  center = [0.5, 0.5],
  radius = 1,
  stretch = 1,
  angle = 0,
  repeat = 1,
  speed = 0,
  colorSpace = 'oklab',
  hueInterpolation = 'shorter',
}: RadialGradientProps) {
  return (
    <RadialGradientShader
      angle={angle}
      center={center}
      colorSpace={colorSpace}
      hueInterpolation={hueInterpolation}
      radius={radius}
      repeat={repeat}
      speed={speed}
      stops={stops}
      stretch={stretch}
    />
  );
}

'use client';

// Public face of the liquid gradient: owns the props, their JSDoc, and their
// defaults, then delegates to LiquidGradientShader (./shader.tsx), which
// streaks LinearGradient's bands and a field of fractal paint along slow,
// curling currents, like color stirred into liquid. Render it inside a
// <ShaderScene>.
import type { ColorSpace, HueInterpolation } from '../../engine.js';
import type { AnimatableProp } from '../../react/hooks/animatable-signal/animatable-signal.js';
import type { ColorStop } from '../shared/color.js';
import { LiquidGradientShader } from './shader.js';

export type { ColorStop } from '../shared/color.js';

export interface LiquidGradientProps {
  /**
   * Colors of the bands. Accepts hex, `oklch()`, or `oklab()`; positions
   * auto-space when omitted.
   */
  stops?: ColorStop[];
  /**
   * Direction the bands run across before the flow carries them, in
   * degrees. 0 runs left to right, 90 runs bottom to top. Defaults to 0.
   * Accepts a static value or an animation signal.
   */
  angle?: AnimatableProp<number>;
  /**
   * How many times the stops run across the canvas. Every other pass runs
   * the stops backward, so each pass ends on the color the next one starts
   * with and no seam forms. Values at or below 1 render as a single pass.
   * Defaults to 2. Accepts a static value or an animation signal.
   */
  repeat?: AnimatableProp<number>;
  /**
   * How the colors meet. 0 gives hard bands, one flat band per stop; 1 eases
   * each stop into the next across the whole space between them. Defaults
   * to 1. Accepts a static value or an animation signal.
   */
  softness?: AnimatableProp<number>;
  /**
   * How far the current carries the colors. 0 leaves the bands straight, and
   * the paint's blotches fade in by 0.2; higher values streak and curl the
   * colors further. Above about 2, the streaks start to break into separate
   * copies around tight curls. Defaults to 0.9. Accepts a static value or an
   * animation signal.
   */
  swirl?: AnimatableProp<number>;
  /**
   * Roughly how many eddies span the canvas's height. Above 4, the flow's
   * pattern starts to repeat across a wide canvas. Defaults to 1.5. Accepts
   * a static value or an animation signal.
   */
  scale?: AnimatableProp<number>;
  /**
   * How fast the current drifts: its eddies form, merge, and dissolve as
   * they slide across the canvas. 0 holds the flow still. Defaults to 0.15.
   * Accepts a static value or an animation signal.
   */
  speed?: AnimatableProp<number>;
  /**
   * Picks a different flow and paint with the same character. Each whole
   * number gives an unrelated layout. Defaults to 0.
   */
  seed?: number;
  /** Color space the bands are interpolated in. Defaults to `'oklab'`. */
  colorSpace?: ColorSpace;
  /**
   * Hue arc for cylindrical color spaces (oklch/lch/hsl/hsv); inert
   * otherwise. Defaults to `'shorter'`.
   */
  hueInterpolation?: HueInterpolation;
}

// Blue -> violet -> purple: 55 degrees of hue, with lightness climbing 0.157
// and then 0.26 between stops. The mirrored passes run it back down again,
// so the darkest blue and the lightest purple each meet only themselves.
const DEFAULT_STOPS: ColorStop[] = [
  { color: 'oklch(0.303 0.152 265.847)' }, // paletteOklch.blue[3]
  { color: 'oklch(0.460 0.248 293.328)' }, // paletteOklch.violet[6]
  { color: 'oklch(0.720 0.250 320)' }, // paletteOklch.purple[9]
];

export function LiquidGradient({
  stops = DEFAULT_STOPS,
  angle = 0,
  repeat = 2,
  softness = 1,
  swirl = 0.9,
  scale = 1.5,
  speed = 0.15,
  seed = 0,
  colorSpace = 'oklab',
  hueInterpolation = 'shorter',
}: LiquidGradientProps) {
  return (
    <LiquidGradientShader
      angle={angle}
      colorSpace={colorSpace}
      hueInterpolation={hueInterpolation}
      repeat={repeat}
      scale={scale}
      seed={seed}
      softness={softness}
      speed={speed}
      stops={stops}
      swirl={swirl}
    />
  );
}

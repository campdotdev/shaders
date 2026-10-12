'use client';

// Public face of the swirl gradient: owns the props, their JSDoc, and their
// defaults, then delegates to SwirlGradientShader (./shader.tsx), which
// folds LinearGradient's repeating bands along a flow, like paint swirled
// on water. Render it inside a <ShaderScene>.
import type { ColorSpace, HueInterpolation } from '../../engine.js';
import type { AnimatableProp } from '../../react/hooks/animatable-signal/animatable-signal.js';
import type { ColorStop } from '../shared/color.js';
import { SwirlGradientShader, type SwirlGradientTuning } from './shader.js';

export type { ColorStop } from '../shared/color.js';
export type { SwirlGradientTuning } from './shader.js';

export interface SwirlGradientProps {
  /**
   * Colors of the bands. Accepts hex, `oklch()`, or `oklab()`; positions
   * auto-space when omitted.
   */
  stops?: ColorStop[];
  /**
   * Direction the bands run across, in degrees. 0 runs left to right, 90
   * runs bottom to top. Defaults to 0. Accepts a static value or an
   * animation signal.
   */
  angle?: AnimatableProp<number>;
  /**
   * How many times the stops run across the canvas. Each pass runs the stops
   * in the same direction and snaps back to the first, so unless the first
   * and last stop match there is a crisp seam at every band boundary, which
   * the flow draws out into threads. Values at or below 1 render as a single
   * pass. Defaults to 2. Accepts a static value or an animation signal.
   */
  repeat?: AnimatableProp<number>;
  /**
   * How the colors meet. 0 gives hard bands, one flat band per stop; 1 eases
   * each stop into the next across the whole space between them. Seams stay
   * crisp at any softness. Defaults to 1. Accepts a static value or an
   * animation signal.
   */
  softness?: AnimatableProp<number>;
  /**
   * How far the flow carries the colors. 0 leaves the bands straight; higher
   * values stretch and fold them further. Defaults to 0.9. Accepts a static
   * value or an animation signal.
   */
  swirl?: AnimatableProp<number>;
  /**
   * Roughly how many eddies span the canvas's height. Defaults to 1.5. Accepts
   * a static value or an animation signal.
   */
  scale?: AnimatableProp<number>;
  /**
   * How fast the flow drifts: its eddies form, merge, and dissolve, and the
   * bands fold along with them. 0 holds the flow still. Defaults to 0.15.
   * Accepts a static value or an animation signal.
   */
  speed?: AnimatableProp<number>;
  /**
   * Picks a different flow with the same character. Each whole number gives
   * an unrelated flow. Defaults to 0.
   */
  seed?: number;
  /** Color space the bands are interpolated in. Defaults to `'oklab'`. */
  colorSpace?: ColorSpace;
  /**
   * Hue arc for cylindrical color spaces (oklch/lch/hsl/hsv); inert
   * otherwise. Defaults to `'shorter'`.
   */
  hueInterpolation?: HueInterpolation;
  /**
   * TEMPORARY (build-phase tuning only): dev overrides for the flow's feel
   * constants. Stripped at the defaults gate. Do not use.
   */
  tuning?: SwirlGradientTuning;
}

// Provisional palette until the defaults gate: blue -> violet -> purple,
// 55 degrees of hue, climbing about 0.15 to 0.26 in lightness per stop. The
// first and last stops differ, so each band ends in a crisp seam for the
// flow to draw out.
const DEFAULT_STOPS: ColorStop[] = [
  { color: 'oklch(0.303 0.152 265.847)' }, // paletteOklch.blue[3]
  { color: 'oklch(0.460 0.248 293.328)' }, // paletteOklch.violet[6]
  { color: 'oklch(0.720 0.250 320)' }, // paletteOklch.purple[9]
];

export function SwirlGradient({
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
  tuning,
}: SwirlGradientProps) {
  return (
    <SwirlGradientShader
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
      tuning={tuning}
    />
  );
}

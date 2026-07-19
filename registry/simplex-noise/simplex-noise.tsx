'use client';

import type { ColorSpace, HueInterpolation } from '@lovo/matter';
import type { AnimatableProp } from '@lovo/matter-react';

import type { ColorStop } from '../utils/color';
import { SimplexNoiseShader } from './shader';

export type { ColorStop } from '../utils/color';

export interface SimplexNoiseProps {
  /**
   * Colors of the ramp the noise field maps onto. Accepts hex, `oklch()`,
   * or `oklab()`; positions auto-space when omitted.
   */
  stops?: ColorStop[];
  /**
   * Zoom of the noise field — roughly how many noise features span the
   * canvas. Higher values give a finer, denser pattern. Defaults to 10.
   * Accepts a static value or an animation signal.
   */
  scale?: AnimatableProp<number>;
  /**
   * How fast the pattern morphs over time. 0 freezes the pattern. Defaults
   * to 0.2. Accepts a static value or an animation signal.
   */
  speed?: AnimatableProp<number>;
  /**
   * Pushes noise values toward the ramp extremes. 1 is neutral; above 1
   * leans into the first and last colors, below 1 pulls everything toward
   * the middle stops. Defaults to 2.5. Accepts a static value or an
   * animation signal.
   */
  contrast?: AnimatableProp<number>;
  /**
   * Shifts the whole pattern through the color ramp. 0.5 is neutral; below
   * leans toward the first colors, above leans toward the last. In 2-color
   * mode this reads as a dark/light balance. Defaults to 0.5. Accepts a
   * static value or an animation signal.
   */
  balance?: AnimatableProp<number>;
  /**
   * Blends between posterized contour bands and a smooth gradient. 0 = hard
   * bands (one per color stop); 1 = fully smooth. Defaults to 0. Accepts a
   * static value or an animation signal.
   */
  softness?: AnimatableProp<number>;
  /**
   * Static offset of the noise pattern. Change it for a different layout of
   * the same character. Defaults to 0.
   */
  seed?: number;
  /** Color space the ramp is interpolated in. Defaults to `'oklab'`. */
  colorSpace?: ColorSpace;
  /**
   * Hue arc for cylindrical color spaces (oklch/lch/hsl/hsv); inert
   * otherwise. Defaults to `'shorter'`.
   */
  hueInterpolation?: HueInterpolation;
}

const DEFAULT_STOPS: ColorStop[] = [
  { color: '#1837e6' }, // palette.blue.base
  { color: '#661acc' }, // palette.violet.base
  { color: '#9e00ba' }, // palette.purple.base
  { color: '#cc1a99' }, // palette.magenta.base
  { color: '#00cda6' }, // palette.teal.base
];

export function SimplexNoise({
  stops = DEFAULT_STOPS,
  scale = 10,
  speed = 0.2,
  contrast = 2.5,
  balance = 0.5,
  softness = 0,
  seed = 0,
  colorSpace = 'oklab',
  hueInterpolation = 'shorter',
}: SimplexNoiseProps) {
  return (
    <SimplexNoiseShader
      balance={balance}
      colorSpace={colorSpace}
      contrast={contrast}
      hueInterpolation={hueInterpolation}
      scale={scale}
      seed={seed}
      softness={softness}
      speed={speed}
      stops={stops}
    />
  );
}

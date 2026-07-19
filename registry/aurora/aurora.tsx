'use client';

import type { ColorSpace, HueInterpolation } from '@lovo/matter';
import type { AnimatableProp } from '@lovo/matter-react';

import type { ColorStop } from '../utils/color';
import { AuroraShader } from './shader';

export type { ColorStop } from '../utils/color';

// Depth ramp, near → far: oxygen green up close, teal mid, ionized blue and
// pink fringe in the distance.
export const DEFAULT_STOPS: ColorStop[] = [
  { color: '#0ae24b', position: 0 },
  { color: '#00cda6', position: 0.35 },
  { color: '#1b9fda', position: 0.7 },
  { color: '#e765b8', position: 1 },
];

export interface AuroraProps {
  /**
   * Curtain colors; nearer ribbons lean on earlier stops, farther ribbons on
   * later ones. Accepts hex, `oklch()`, or `oklab()`.
   */
  stops?: ColorStop[];
  /**
   * Overall brightness. Feeds a soft-clip curve, so values past 1 saturate
   * gracefully instead of clipping. 0 hides the curtains. Defaults to 1.
   * Accepts a static value or an animation signal.
   */
  intensity?: AnimatableProp<number>;
  /**
   * Animation rate of the curtain shimmer and drift. 0 freezes the motion.
   * Defaults to 1. Accepts a static value or an animation signal.
   */
  speed?: AnimatableProp<number>;
  /**
   * How much the curtain filaments bend and billow. 0 gives straight,
   * unwarped ribbons; higher values make them wavier and more chaotic.
   * Defaults to 1. Accepts a static value or an animation signal.
   */
  waviness?: AnimatableProp<number>;
  /**
   * How much of the canvas the aurora fills, revealed from the bottom up
   * along a soft fade line. 0 hides the aurora, 1 fills the canvas.
   * Defaults to 1. Accepts a static value or an animation signal.
   */
  fill?: AnimatableProp<number>;
  /**
   * Color space the curtain colors are interpolated in. Defaults to
   * `'oklab'`.
   */
  colorSpace?: ColorSpace;
  /**
   * Hue arc for cylindrical color spaces (oklch/lch/hsl/hsv); inert
   * otherwise. Defaults to `'shorter'`.
   */
  hueInterpolation?: HueInterpolation;
}

// Defaults approved by eye at the MAT-48 gates.
export function Aurora({
  stops = DEFAULT_STOPS,
  intensity = 1,
  speed = 1,
  waviness = 1,
  fill = 1,
  colorSpace = 'oklab',
  hueInterpolation = 'shorter',
}: AuroraProps) {
  return (
    <AuroraShader
      colorSpace={colorSpace}
      fill={fill}
      hueInterpolation={hueInterpolation}
      intensity={intensity}
      speed={speed}
      stops={stops}
      waviness={waviness}
    />
  );
}

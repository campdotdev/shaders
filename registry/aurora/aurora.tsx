'use client';

// Public face of the aurora: owns the props, their JSDoc, and their
// defaults, then delegates to AuroraShader (./shader.tsx), which draws
// glowing curtain ribbons by marching a virtual view ray through a noise
// field. The aurora emits light over a transparent background — stack it
// above a dark layer inside a <ShaderScene>.
import type { ColorSpace, HueInterpolation } from '@lovo/matter';
import type { AnimatableProp } from '@lovo/matter-react';

import type { ColorStop } from '../utils/color';
import { AuroraShader } from './shader';

export type { ColorStop } from '../utils/color';

// Depth ramp, near → far: oxygen green up close, teal mid, sky and magenta in
// the distance. Each stop is at least 0.10 darker than the one before it,
// making distance read as distance in a shader that adds light rather than
// covering what is behind it.
export const DEFAULT_STOPS: ColorStop[] = [
  { color: '#00fc53', position: 0 }, // palette.green[10]
  { color: '#00c0a0', position: 0.35 }, // palette.teal[9]
  { color: '#007bab', position: 0.7 }, // palette.sky[7]
  { color: '#79125a', position: 1 }, // palette.magenta[5]
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
   * How much of the canvas the aurora covers, revealed from the bottom up
   * along a soft fade line. 0 hides the aurora, 1 covers the canvas.
   * Defaults to 1. Accepts a static value or an animation signal.
   */
  coverage?: AnimatableProp<number>;
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
  coverage = 1,
  colorSpace = 'oklab',
  hueInterpolation = 'shorter',
}: AuroraProps) {
  return (
    <AuroraShader
      colorSpace={colorSpace}
      coverage={coverage}
      hueInterpolation={hueInterpolation}
      intensity={intensity}
      speed={speed}
      stops={stops}
      waviness={waviness}
    />
  );
}

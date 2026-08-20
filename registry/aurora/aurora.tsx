'use client';

// Public face of the aurora: owns the props, their JSDoc, and their
// defaults, then delegates to AuroraShader (./shader.tsx), which draws
// glowing curtain ribbons by marching a virtual view ray through a noise
// field. The aurora emits light over a transparent background — stack it
// above a dark layer inside a <ShaderScene>.
import type { ColorSpace, HueInterpolation } from '@mattermix/shaders';
import type { AnimatableProp } from '@mattermix/shaders-react';

import type { ColorStop } from '../utils/color';
import { AuroraShader } from './shader';

export type { ColorStop } from '../utils/color';

// Depth ramp, near → far: oxygen green up close, teal mid, sky and magenta in
// the distance. The stops stay bright because the shader's atmospheric
// extinction makes the far colours dim with distance, not the source values
// themselves.
export const DEFAULT_STOPS: ColorStop[] = [
  { color: 'oklch(0.863 0.320 145.897)', position: 0 }, // paletteOklch.green[10]
  { color: 'oklch(0.720 0.178 175)', position: 0.35 }, // paletteOklch.teal[9]
  { color: 'oklch(0.720 0.184 235)', position: 0.7 }, // paletteOklch.sky[9]
  { color: 'oklch(0.650 0.309 343.895)', position: 1 }, // paletteOklch.magenta[8]
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

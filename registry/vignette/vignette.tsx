'use client';

import type { ColorSpace, HueInterpolation } from '@lovo/matter';
import type { AnimatableProp } from '@lovo/matter-react';

import { VignetteShader } from './shader';

export interface VignetteProps {
  /** Overlay strength toward the edges. 0 = no vignette, 1 = full `color` at the edge. */
  intensity?: AnimatableProp<number>;
  /**
   * How gradually the vignette ramps in, as a fraction of `falloff`.
   * 0 = a hard ring at `falloff`; 1 = feathers all the way from the center.
   */
  feather?: AnimatableProp<number>;
  /** Vignette center in normalized UV; `[0.5, 0.5]` is centered. */
  center?: [number, number];
  /** Normalized distance from `center` at which the vignette reaches full strength. */
  falloff?: AnimatableProp<number>;
  /** Color blended in toward the edges (hex, `oklch()`, or `oklab()`). */
  color?: string;
  /** Color space the overlay blend is computed in. Defaults to `'oklab'`. */
  colorSpace?: ColorSpace;
  /** Hue arc for cylindrical color spaces (oklch/lch/hsl/hsv); inert otherwise. Defaults to `'shorter'`. */
  hueInterpolation?: HueInterpolation;
}

export function Vignette({
  intensity = 0.3,
  feather = 0.6,
  center = [0.5, 0.5],
  falloff = 0.7,
  color = 'oklch(0.05 0.023 0)',
  colorSpace = 'oklab',
  hueInterpolation = 'shorter',
}: VignetteProps) {
  return (
    <VignetteShader
      center={center}
      color={color}
      colorSpace={colorSpace}
      falloff={falloff}
      feather={feather}
      hueInterpolation={hueInterpolation}
      intensity={intensity}
    />
  );
}

'use client';

import type { AnimatableProp } from '@lovo/matter-react';

import { VignetteShader } from './shader';

export interface VignetteProps {
  /** Overlay strength toward the edges. 0 = no vignette, 1 = full `color` at the edge. */
  intensity?: AnimatableProp<number>;
  /**
   * How gradually the vignette ramps in, as a fraction of `extent`.
   * 0 = a hard ring at `extent`; 1 = feathers all the way from the center.
   */
  feather?: AnimatableProp<number>;
  /** Vignette center in normalized UV; `[0.5, 0.5]` is centered. */
  center?: [number, number];
  /** Normalized distance from `center` at which the vignette reaches full strength. */
  extent?: AnimatableProp<number>;
  /** Color blended in toward the edges (hex). */
  color?: string;
}

export function Vignette({
  intensity = 0.4,
  feather = 0.5,
  center = [0.5, 0.5],
  extent = 0.7,
  color = '#0B0F0D',
}: VignetteProps) {
  return (
    <VignetteShader
      center={center}
      color={color}
      extent={extent}
      feather={feather}
      intensity={intensity}
    />
  );
}

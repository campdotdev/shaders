'use client';

// Public face of the god rays: owns the props, their JSDoc, and their
// defaults, then delegates to GodRaysShader (./shader.tsx), which draws soft
// light rays radiating from an origin point. The rays emit light over a
// transparent background — stack them above a dark layer inside a
// <ShaderScene>.
import type { AnimatableProp } from '@lovo/matter-react';

import { GodRaysShader } from './shader';

export interface GodRaysProps {
  /**
   * Ray origin, 0..1 across the canvas; `[0.5, 0.5]` is centered and
   * `[0, 0]` is the top-left corner. Values outside 0..1 park the source
   * off-canvas. Defaults to `[0.5, -0.05]`, just above the top edge.
   * Accepts a static value or an animation signal.
   */
  center?: AnimatableProp<readonly [number, number]>;
  /**
   * Roughly how many rays fit around a full revolution. Higher packs more,
   * thinner rays; lower gives a few broad ones. Defaults to 12.
   * Accepts a static value or an animation signal.
   */
  density?: AnimatableProp<number>;
  /**
   * Overall brightness. 0 hides the rays. Defaults to 1.
   * Accepts a static value or an animation signal.
   */
  intensity?: AnimatableProp<number>;
  /**
   * Shimmer rate — how fast rays swell, fade, and hand brightness to their
   * neighbors. 0 freezes the motion. Defaults to 1.
   * Accepts a static value or an animation signal.
   */
  speed?: AnimatableProp<number>;
}

export function GodRays({
  center = [0.5, -0.05],
  density = 12,
  intensity = 1,
  speed = 1,
}: GodRaysProps) {
  return <GodRaysShader center={center} density={density} intensity={intensity} speed={speed} />;
}

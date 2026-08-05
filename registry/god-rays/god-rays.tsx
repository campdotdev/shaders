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
   * How defined the rays are. 0 is a soft overlapping haze; 1 sharpens the
   * noise creases into crisp, readable beams. Defaults to 0.5.
   * Accepts a static value or an animation signal.
   */
  definition?: AnimatableProp<number>;
  /**
   * Overall brightness. 0 hides the rays. Defaults to 1.
   * Accepts a static value or an animation signal.
   */
  intensity?: AnimatableProp<number>;
  /**
   * How much rays bend and billow along their length. 0 gives straight,
   * unwarped spokes; higher values make them wavier and more chaotic.
   * Defaults to 1. Accepts a static value or an animation signal.
   */
  waviness?: AnimatableProp<number>;
  /**
   * Shimmer rate — how fast rays swell, fade, and hand brightness to their
   * neighbors. 0 freezes the motion. Defaults to 1.
   * Accepts a static value or an animation signal.
   */
  speed?: AnimatableProp<number>;
  /**
   * TEMPORARY (build-phase tuning only): dev overrides for the bend/dapple
   * character constants. Stripped — with the constants baked back in — at
   * the defaults-tuning gate.
   */
  tuning?: { bendAmount?: number; bendFrequency?: number; dappleAmount?: number };
}

export function GodRays({
  center = [0.5, -0.05],
  density = 12,
  definition = 0.5,
  intensity = 1,
  waviness = 1,
  speed = 1,
  tuning,
}: GodRaysProps) {
  return (
    <GodRaysShader
      center={center}
      definition={definition}
      density={density}
      intensity={intensity}
      speed={speed}
      tuning={tuning}
      waviness={waviness}
    />
  );
}

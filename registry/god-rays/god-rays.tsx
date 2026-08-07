'use client';

// Public face of the god rays: owns the props, their JSDoc, and their
// defaults, then delegates to GodRaysShader (./shader.tsx), which draws soft
// light rays radiating from an origin point as the product of two flowing
// noise fields — one decorrelated layer of rays per entry in `colors`. The
// rays emit light over a transparent background — stack them above a dark
// layer inside a <ShaderScene>.
import type { AnimatableProp } from '@lovo/matter-react';

import { GodRaysShader } from './shader';

// Cool analogous palette, near to far — sky blue in front, purple behind
// it, pink at the back. Layer light is additive, so overlaps bloom toward
// pale lavender-white; chroma stays high on every stop so partial-strength
// rays keep their hue instead of graying out.
export const DEFAULT_COLORS = [
  'oklch(0.80 0.12 250)',
  'oklch(0.70 0.16 300)',
  'oklch(0.75 0.14 345)',
];

export interface GodRaysProps {
  /**
   * Ray colors, near to far — each color spawns its own decorrelated layer
   * of rays, later colors progressively finer-textured so they read as
   * deeper planes. Overlapping layers add their light. 2–5 colors as hex,
   * `oklch()`, or `oklab()` strings. Defaults to a cool blue-to-pink
   * palette.
   */
  colors?: string[];
  /**
   * Ray origin, 0..1 across the canvas; `[0.5, 0.5]` is centered and
   * `[0, 0]` is the top-left corner. Values outside 0..1 park the source
   * off-canvas. Defaults to `[0.5, -0.05]`, just above the top edge.
   * Accepts a static value or an animation signal.
   */
  center?: AnimatableProp<readonly [number, number]>;
  /**
   * Roughly how many rays fit around a full revolution before the two-field
   * product thins them. Higher packs more, thinner rays; lower gives a few
   * broad ones. Defaults to 12. Accepts a static value or an animation
   * signal.
   */
  density?: AnimatableProp<number>;
  /**
   * How defined the rays are. 0 is a soft overlapping haze of wide lobes;
   * 1 narrows them into distinct, separated beams. Defaults to 0.5.
   * Accepts a static value or an animation signal.
   */
  definition?: AnimatableProp<number>;
  /**
   * How broken the rays are along their length. 0 gives long continuous
   * streaks; 1 chops them into short drifting dashes. Defaults to 0.5.
   * Accepts a static value or an animation signal.
   */
  patchiness?: AnimatableProp<number>;
  /**
   * Overall brightness. 0 hides the rays. Defaults to 1.
   * Accepts a static value or an animation signal.
   */
  intensity?: AnimatableProp<number>;
  /**
   * Flow tempo — how fast light streams outward and the ray pattern
   * flickers. 0 freezes the motion. Defaults to 1.
   * Accepts a static value or an animation signal.
   */
  speed?: AnimatableProp<number>;
  /**
   * TEMPORARY (build-phase tuning only): dev overrides for the field
   * character constants. Stripped — with the constants baked back in — at
   * the defaults-tuning gate.
   */
  tuning?: {
    patchScale?: number;
    flowA?: number;
    flowB?: number;
    fieldARadial?: number;
    fieldBRadial?: number;
  };
}

export function GodRays({
  colors = DEFAULT_COLORS,
  center = [0.5, -0.05],
  density = 12,
  definition = 0.5,
  patchiness = 0.5,
  intensity = 1,
  speed = 1,
  tuning,
}: GodRaysProps) {
  return (
    <GodRaysShader
      center={center}
      colors={colors}
      definition={definition}
      density={density}
      intensity={intensity}
      patchiness={patchiness}
      speed={speed}
      tuning={tuning}
    />
  );
}

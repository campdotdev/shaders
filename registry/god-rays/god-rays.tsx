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
   * Cone aim in degrees; 0 points right, 90 points up. Inert while `spread`
   * is 360. Defaults to 270, straight down. Accepts a static value or an
   * animation signal.
   */
  angle?: AnimatableProp<number>;
  /**
   * Cone width in degrees; rays outside it fade across a soft feathered
   * edge. 360 opens the full circle and disables the cone. Defaults to 360
   * — the hero fan comes from an off-canvas `center` cropped by the frame,
   * not the cone. Accepts a static value or an animation signal.
   */
  spread?: AnimatableProp<number>;
  /**
   * Normalized reach at which rays have fully faded: 1 means a centered
   * origin's rays just touch the canvas corners. Defaults to 2, letting the
   * rays wash past the frame instead of fading inside it.
   * Accepts a static value or an animation signal.
   */
  radius?: AnimatableProp<number>;
  /**
   * Roughly how many rays fit around a full revolution before the two-field
   * product thins them. Higher packs more, thinner rays; lower gives a few
   * broad ones. Defaults to 32. Accepts a static value or an animation
   * signal.
   */
  density?: AnimatableProp<number>;
  /**
   * How diffuse the light is. 0 keeps the rays distinct, separated beams;
   * 1 melts them into a soft, bright wash of overlapping lobes. Defaults
   * to 0.9. Accepts a static value or an animation signal.
   */
  diffusion?: AnimatableProp<number>;
  /**
   * How broken the rays are along their length. 0 gives long continuous
   * streaks; 1 chops them into short drifting dashes. Defaults to 0.4.
   * Accepts a static value or an animation signal.
   */
  patchiness?: AnimatableProp<number>;
  /**
   * Radius of the glow disc at the ray source. 0 disables it. Defaults to
   * 0.6. Accepts a static value or an animation signal.
   */
  glowRadius?: AnimatableProp<number>;
  /**
   * Brightness of the source glow. Defaults to 0.7. Accepts a static value
   * or an animation signal.
   */
  glowIntensity?: AnimatableProp<number>;
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
}

export function GodRays({
  colors = DEFAULT_COLORS,
  center = [0.5, -0.05],
  angle = 270,
  spread = 360,
  radius = 2,
  density = 32,
  diffusion = 0.9,
  patchiness = 0.4,
  glowRadius = 0.6,
  glowIntensity = 0.7,
  intensity = 1,
  speed = 1,
}: GodRaysProps) {
  return (
    <GodRaysShader
      angle={angle}
      center={center}
      colors={colors}
      density={density}
      diffusion={diffusion}
      glowIntensity={glowIntensity}
      glowRadius={glowRadius}
      intensity={intensity}
      patchiness={patchiness}
      radius={radius}
      speed={speed}
      spread={spread}
    />
  );
}

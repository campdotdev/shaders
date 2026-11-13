'use client';

// Public face of Swells: owns the props, their JSDoc, and their defaults,
// then delegates to SwellsShader (./shader.tsx), which draws a surface through
// a camera of its own by marching each pixel's ray over a height map. Swells
// draws only the surface and is transparent where the ray misses it, so the
// page shows through as the sky, or a sky Source mounted beneath it does.
import type { ColorSpace, HueInterpolation } from '../../engine.js';
import type { AnimatableProp } from '../../react/hooks/animatable-signal/animatable-signal.js';
import { SwellsShader, type SwellsTuning } from './shader.js';

export type { SwellsTuning } from './shader.js';

export interface SwellsProps {
  /**
   * How high the camera sits above the ground, in terrain units. The
   * tallest crests reach `relief` units, so a camera below that can end up
   * inside a swell. Defaults to 1.5. Accepts a static value or an animation
   * signal.
   */
  altitude?: AnimatableProp<number>;
  /**
   * How far the camera looks down from the horizon, in degrees. 0 puts the
   * horizon across the middle of the canvas, and higher values lower the
   * camera's gaze, so the ground fills more of the frame and the sky less.
   * Defaults to 12. Accepts a static value or an animation signal.
   */
  tilt?: AnimatableProp<number>;
  /**
   * How much the camera sees from the bottom of the canvas to the top, in
   * degrees. Lower values zoom in and flatten the terrain's depth; higher
   * values widen the view and stretch near ground toward the viewer.
   * Defaults to 50. Accepts a static value or an animation signal.
   */
  fieldOfView?: AnimatableProp<number>;
  /**
   * How many swells, crest to crest, fit in 10 terrain units. Higher packs
   * in more, smaller swells; lower spreads out fewer, bigger ones. The
   * ripples keep their size. Defaults to 4, so a swell is 2.5 units long.
   * Accepts a static value or an animation signal.
   */
  scale?: AnimatableProp<number>;
  /**
   * How tall the swells are, in terrain units: the height of the tallest
   * crests. 0 flattens the swells into level ground, which still carries
   * ripples unless `ripples` is 0 too. Short swells, at a high `scale`, stop
   * growing taller once their steepest faces climb at about 72 degrees, so
   * the ray can't skip over their crests. Defaults to 0.8. Accepts a static
   * value or an animation signal.
   */
  relief?: AnimatableProp<number>;
  /**
   * The swells' shape, from 0 to 1. 0 gives round swells that ease over
   * their crests, like silk or open water, with both faces alike. 1 gives
   * sharp dune crests, with a long, gentle face and a short, steep one that
   * looks downwind. Defaults to 1. Accepts a static value or an animation
   * signal.
   */
  sharpness?: AnimatableProp<number>;
  /**
   * How strong the fine ripples on the surface are, from 0 to 1, where 0 is
   * a smooth surface and 1 is the deepest ripples. They show up close and fade
   * out with distance. Defaults to 0.5. Accepts a static value or an
   * animation signal.
   */
  ripples?: AnimatableProp<number>;
  /**
   * Where the sun sits around the scene, in compass degrees clockwise from
   * the way the camera faces: 0 straight ahead, so the camera looks into
   * the sun and sees mostly shaded faces; 90 to the right; 180 behind the
   * camera, lighting the faces turned toward it; and 270 to the left.
   * Defaults to 300, ahead and to the left. Accepts a static value or an
   * animation signal.
   */
  sunAngle?: AnimatableProp<number>;
  /**
   * How high the sun sits, in degrees above the horizon, from 0 on the
   * horizon to 90 overhead. A low sun rakes across the swells, so every
   * crest splits into a lit face and a shaded one; a high sun lights both
   * faces alike and flattens them. Defaults to 15. Accepts a static value or
   * an animation signal.
   */
  sunHeight?: AnimatableProp<number>;
  /**
   * The surface's color where it faces the sun: hex, `oklch()`, or `oklab()`.
   * Faces turned from the sun take `shadowColor`, and the slopes between
   * blend the two. Defaults to a warm sand, `'oklch(0.82 0.08 75)'`.
   */
  color?: string;
  /**
   * The surface's color on faces turned from the sun: hex, `oklch()`, or
   * `oklab()`. Defaults to a rose brown, `'oklch(0.45 0.06 15)'`.
   */
  shadowColor?: string;
  /**
   * How strong the soft highlight is where the surface mirrors the sun
   * toward the camera, from 0 to 1. 0 gives a matte surface, like dry sand;
   * higher values add a satin glow in `sheenColor` that slides over the
   * swells as the camera or the sun moves. Defaults to 0.3. Accepts a static
   * value or an animation signal.
   */
  sheen?: AnimatableProp<number>;
  /**
   * The highlight's color: hex, `oklch()`, or `oklab()`. At full `sheen`,
   * the brightest point of the highlight is exactly this color. Defaults to
   * a warm white, `'oklch(0.97 0.03 85)'`.
   */
  sheenColor?: string;
  /**
   * How thick the haze is, per terrain unit. With distance, the surface
   * first turns to `hazeColor`, then fades out into whatever is beneath
   * Swells, so the far field glows in the haze's color. 0 is clear air,
   * with the surface in its own colors until it fades out at the edge of
   * the camera's view. At `1 / haze` terrain units, about a third of the
   * surface's own color shows, and the near ground stays clear. Defaults to
   * 0.04. Accepts a static value or an animation signal.
   */
  haze?: AnimatableProp<number>;
  /**
   * The haze's color, which the far surface turns to before it fades out:
   * hex, `oklch()`, or `oklab()`. Defaults to a dusty rose,
   * `'oklch(0.78 0.07 45)'`.
   */
  hazeColor?: string;
  /**
   * How strongly the far surface shimmers, from 0 to 1, like heat haze over
   * sand: the far crests waver, and the sky beneath shows through in
   * patches. 0 is still air. Swells keeps the scene drawing every frame
   * while the mirage is above 0, and the shimmer slows under reduced
   * motion. Defaults to 0.3. Accepts a static value or an animation signal.
   */
  mirage?: AnimatableProp<number>;
  /**
   * The color space the slopes between `shadowColor` and `color`, the
   * sheen over them, and the haze blend in. Defaults to `'oklab'`.
   */
  colorSpace?: ColorSpace;
  /**
   * Hue arc for cylindrical color spaces (oklch/lch/hsl/hsv); inert
   * otherwise. Defaults to `'shorter'`.
   */
  hueInterpolation?: HueInterpolation;
  /**
   * TEMPORARY (build-phase tuning only): dev overrides for the feel
   * constants. Stripped at the defaults gate, so don't use it.
   */
  tuning?: SwellsTuning;
}

// Provisional until the defaults gate (SHA-327) tunes them by eye.
export function Swells({
  altitude = 1.5,
  tilt = 12,
  fieldOfView = 50,
  scale = 4,
  relief = 0.8,
  sharpness = 1,
  ripples = 0.5,
  sunAngle = 300,
  sunHeight = 15,
  color = 'oklch(0.82 0.08 75)',
  shadowColor = 'oklch(0.45 0.06 15)',
  sheen = 0.3,
  sheenColor = 'oklch(0.97 0.03 85)',
  haze = 0.04,
  hazeColor = 'oklch(0.78 0.07 45)',
  mirage = 0.3,
  colorSpace = 'oklab',
  hueInterpolation = 'shorter',
  tuning,
}: SwellsProps) {
  return (
    <SwellsShader
      altitude={altitude}
      color={color}
      colorSpace={colorSpace}
      fieldOfView={fieldOfView}
      haze={haze}
      hazeColor={hazeColor}
      hueInterpolation={hueInterpolation}
      mirage={mirage}
      relief={relief}
      ripples={ripples}
      scale={scale}
      shadowColor={shadowColor}
      sharpness={sharpness}
      sheen={sheen}
      sheenColor={sheenColor}
      sunAngle={sunAngle}
      sunHeight={sunHeight}
      tilt={tilt}
      tuning={tuning}
    />
  );
}

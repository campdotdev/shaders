'use client';

// Public face of Swells: owns the props, their JSDoc, and their defaults,
// then delegates to SwellsShader (./shader.tsx), which draws terrain through
// a camera of its own by marching each pixel's ray over a height map. Swells
// draws only the ground and is transparent where the ray misses it, so
// mount a sky Source beneath it inside a <ShaderScene>.
import type { ColorSpace, HueInterpolation } from '../../engine.js';
import type { AnimatableProp } from '../../react/hooks/animatable-signal/animatable-signal.js';
import { SwellsShader, type SwellsTuning } from './shader.js';

export type { SwellsTuning } from './shader.js';

export interface SwellsProps {
  /**
   * How high the camera sits above the ground, in terrain units. The
   * tallest crests reach `relief` units, so a camera below that can end up
   * inside a dune. Defaults to 1.5. Accepts a static value or an animation
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
   * How many dunes, crest to crest, fit in 10 terrain units. Higher packs
   * in more, smaller dunes; lower spreads out fewer, bigger ones. The
   * ripples keep their size. Defaults to 4, so a dune is 2.5 units long.
   * Accepts a static value or an animation signal.
   */
  scale?: AnimatableProp<number>;
  /**
   * How tall the dunes are, in terrain units: the height of the tallest
   * crests. 0 flattens the dunes into level ground, which still carries
   * ripples unless `ripples` is 0 too. Defaults to 0.8. Accepts a static
   * value or an animation signal.
   */
  relief?: AnimatableProp<number>;
  /**
   * How strong the wind ripples on the sand are, from 0 to 1, where 0 is
   * smooth sand and 1 is the deepest ripples. They show up close and fade
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
   * horizon to 90 overhead. A low sun rakes across the dunes, so every
   * crest splits into a lit face and a shaded one; a high sun lights both
   * faces alike and flattens them. Defaults to 15. Accepts a static value or
   * an animation signal.
   */
  sunHeight?: AnimatableProp<number>;
  /**
   * The sand's color where it faces the sun: hex, `oklch()`, or `oklab()`.
   * Faces turned from the sun take `shadowColor`, and the slopes between
   * blend the two. Defaults to a warm sand, `'oklch(0.82 0.08 75)'`.
   */
  color?: string;
  /**
   * The sand's color on faces turned from the sun: hex, `oklch()`, or
   * `oklab()`. Defaults to a rose brown, `'oklch(0.45 0.06 15)'`.
   */
  shadowColor?: string;
  /**
   * The color space the slopes between `shadowColor` and `color` blend in.
   * Defaults to `'oklab'`.
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
  ripples = 0.5,
  sunAngle = 300,
  sunHeight = 15,
  color = 'oklch(0.82 0.08 75)',
  shadowColor = 'oklch(0.45 0.06 15)',
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
      hueInterpolation={hueInterpolation}
      relief={relief}
      ripples={ripples}
      scale={scale}
      shadowColor={shadowColor}
      sunAngle={sunAngle}
      sunHeight={sunHeight}
      tilt={tilt}
      tuning={tuning}
    />
  );
}

// The surface of fluted glass: rows of identical flutes laid side by side,
// each a strip of glass that bends what is under it. For a point, this works
// out how steep the glass is there and how far it moves the image. Both come
// from one call, so anything that reads the slope agrees with the bend on
// where the glass curves. FlutedGlass (components/fluted-glass) bends the
// scene with it, and Mode 2 users call it on their own texture coordinates.
import type { ShaderNodeObject } from 'three/tsl';
import { cos, dot, float, fract, max, sin, vec2 } from 'three/tsl';
import type { Node } from 'three/webgpu';

import type { TSLNode } from '../color-ramp/color-ramp.js';

export interface FluteSurfaceOptions {
  /**
   * The width of one flute, in the units of `position`. Values near 0 clamp
   * to a tiny width rather than dividing by zero. Default 40.
   */
  fluteWidth?: TSLNode | number;
  /**
   * The direction the flutes run, in degrees counterclockwise from the
   * position's +x axis with y up: 0 runs them left to right and 90 runs them
   * bottom to top, the degrees LinearGradient's angle uses. Default 90,
   * vertical flutes.
   */
  angle?: TSLNode | number;
  /**
   * How far the glass moves the image, in half flute widths per unit of
   * slope. 0 leaves it in place. At 1, a groove shows the image half a flute
   * width away, so each flute shows a copy of twice its own width, squeezed.
   * Default 1.
   */
  refraction?: TSLNode | number;
}

export interface FluteSurfaceResult {
  /**
   * How far to move the point before you sample the image under the glass,
   * as a vector in the units and frame of `position`. Add it to `position`.
   */
  bend: ShaderNodeObject<Node>;
  /**
   * How steep the glass is, as a vector in the frame of `position`. It
   * points across the flute, away from the flute's center, and its length
   * runs from 0 at the center to 1 at a groove.
   */
  slope: ShaderNodeObject<Node>;
}

/**
 * The bend and slope of fluted glass at `position`. A flute's center sits on
 * the position's origin, so center the position where the middle flute
 * should go.
 *
 * @param position — Vec2 TSL node in any units with y up, such as `uv()`
 *   scaled to pixels. `fluteWidth` and the returned bend share its units.
 */
export function fluteSurface(
  position: TSLNode,
  options: FluteSurfaceOptions = {},
): FluteSurfaceResult {
  const fluteWidth = max(float(options.fluteWidth ?? 40), 1e-4);
  const angle = float(options.angle ?? 90);
  const refraction = float(options.refraction ?? 1);

  // ---------------------------------------------
  // The direction across the flutes
  // ---------------------------------------------
  // The flutes run along (cos, sin) of the angle. Across is that direction
  // turned a quarter turn clockwise, (sin, -cos), so at the default 90
  // degrees it is (1, 0): across runs left to right over vertical flutes.
  const angleRadians = angle.mul(Math.PI / 180);
  const across = vec2(sin(angleRadians), cos(angleRadians).negate());

  // ---------------------------------------------
  // Repeating space: which part of which flute
  // ---------------------------------------------
  // dot() projects the position onto the across direction: its signed
  // distance across the flutes, in the position's units. Dividing by the
  // width counts that distance in flutes. The +0.5 below centers a flute on
  // every whole number, so 2.25 lies a quarter flute right of the center of
  // flute 2, halfway to its groove.
  //
  // fract() keeps only the part after the decimal point, which is how a
  // shader repeats space: every flute gets the same 0-to-1 ramp, whatever
  // its number. The +0.5 shifts the ramp so its middle, not its start, lands
  // on the origin, which puts a flute's center there. Then *2-1 stretches the
  // ramp to run from -1 at one groove, through 0 at the center, to 1 at the
  // other groove. At each groove the ramp jumps from 1 back to -1, and that
  // jump is what breaks the image into strips.
  const flutePhase = dot(position, across).div(fluteWidth);
  const fluteOffset = fract(flutePhase.add(0.5)).mul(2).sub(1);

  // ---------------------------------------------
  // The slope: how steep the glass is
  // ---------------------------------------------
  // A round flute's slope grows in step with the distance from its center:
  // flat on top, steepest at the grooves. Strictly, a slope that grows in
  // step draws a parabola, a shallow stand-in for a circular lens, whose
  // slope would shoot up near the grooves. Pointing it along `across` turns
  // that amount into a vector. The sign comes from the offset, so on either
  // side of the center the slope points toward the nearer groove.
  const slope = across.mul(fluteOffset);

  // ---------------------------------------------
  // The bend: refraction as a sample offset
  // ---------------------------------------------
  // Glass doesn't move pixels. It changes which point of the image behind it
  // reaches the eye, so a shader bends an image by sampling it somewhere
  // else. The bend is the slope times the dial, in half flute widths. At a
  // refraction of 1, a point at offset x from the center samples at 2x, so
  // the flute's own width shows twice that width of image: a squeezed copy
  // of what lies right under it. The bend points away from the center on
  // both sides, which is what squeezes rather than stretches.
  const bend = slope.mul(refraction).mul(fluteWidth.mul(0.5));

  return { bend, slope };
}

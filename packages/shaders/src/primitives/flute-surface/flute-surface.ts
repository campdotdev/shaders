// The surface of fluted glass: identical flutes side by side, each a strip
// of glass that bends what is under it. For a point, this works out how
// steep the glass is and how far it moves the image, in one call, so light
// read from the slope lands where the image bends. FlutedGlass bends and
// lights the scene with it, and Mode 2 users call it on their own coordinates.
import type { ShaderNodeObject } from 'three/tsl';
import {
  abs,
  clamp,
  cos,
  dot,
  float,
  fract,
  fwidth,
  max,
  mix,
  pow,
  select,
  sign,
  sin,
  smoothstep,
  vec2,
} from 'three/tsl';
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
  /**
   * The shape of each flute seen from its end, from 0 to 1. 0 is a pointed
   * prism, two flat faces meeting at a ridge. 0.5 is a round lens. 1 is a
   * flat top with steep walls. Values between give the shapes between, and
   * values outside 0 to 1 clamp. Default 0.5.
   */
  crossSection?: TSLNode | number;
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
  /**
   * How far the point sits from its flute's center, from 0 at the center to
   * 1 at a groove, whatever the cross-section. Unlike the slope it skips the
   * groove smoothing, so it reaches 1 at a groove from both sides with no
   * dip. Shading meant to be darkest on the groove reads this.
   */
  fromCenter: ShaderNodeObject<Node>;
  /**
   * How steep the glass is, from 0 where it is flat to 1 at a groove. It is
   * the slope's length without the groove smoothing, so like `fromCenter` it
   * reaches 1 at a groove from both sides, where the slope dips to 0.
   * Shading meant to follow the shape of the glass reads this.
   */
  steepness: ShaderNodeObject<Node>;
}

// ---------------------------------------------
// Feel constants (tuned by eye at the build's visual gates)
// ---------------------------------------------
// The slope's exponent at each end of the cross-section dial. A cross-section
// of 0.5 always has an exponent of 1. Lower PRISM_EXPONENT sharpens the
// prism's faces toward perfectly flat, and higher FLAT_EXPONENT flattens the
// top and steepens the walls.
const PRISM_EXPONENT = 1 / 16;
const FLAT_EXPONENT = 16;
// How many screen pixels each groove and the prism's ridge smooth over on
// either side. 0 brings back the stair steps; above about 2 the grooves read
// as soft blurs rather than sharp breaks.
const GROOVE_SMOOTHING = 1;

/**
 * The bend and slope of fluted glass at `position`. A flute's center sits on
 * the position's origin, so center the position where the middle flute
 * should go. Call it from a fragment shader: it smooths each groove over the
 * screen-space rate of change of `position`, which only a fragment shader
 * can measure.
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
  const crossSection = clamp(float(options.crossSection ?? 0.5), 0, 1);

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
  // on the origin, which puts a flute's center there. At each groove the
  // ramp jumps from 1 back to 0, and that jump is what breaks the image into
  // strips.
  const flutePhase = dot(position, across).div(fluteWidth);
  const ramp = fract(flutePhase.add(0.5));

  // The distance from the center, before any smoothing. ramp*2-1 runs from
  // -1 at one groove to 1 at the other, and abs() folds it to run 0 to 1
  // from the center out on both sides. Where the ramp jumps from 1 to 0 at a
  // groove, this goes from 1 to 1, so it has no jump to smooth.
  const fromCenter = abs(ramp.mul(2).sub(1));

  // ---------------------------------------------
  // Clean grooves: antialiasing from the screen-space rate of change
  // ---------------------------------------------
  // The scene has no MSAA, the GPU's own edge smoothing, so a jump in the
  // ramp lands on whole pixels and a slanted groove draws a staircase. The
  // fix is to replace the jump with a slope exactly one pixel wide, and to
  // know how wide a pixel is in flutes, the shader asks the GPU.
  //
  // The GPU shades pixels in 2x2 blocks, so each pixel can read how much a
  // value changes to its neighbor. fwidth() adds that change across and
  // down, so fwidth(flutePhase) is how many flutes one pixel spans: 0.025 for
  // a 40-pixel flute, and 0.125 for an 8-pixel one. It is taken of the phase
  // before fract(), which has no jump in it to throw the measure off. The max
  // keeps the band from shrinking to nothing, which would divide by zero in
  // smoothstep() when a flute is very wide.
  const rampPerPixel = max(fwidth(flutePhase).mul(GROOVE_SMOOTHING), 1e-5);

  // Paper's smoothFract. distanceToGroove is 0 at a groove and falls to -0.5
  // at the flute's center. smoothstep() turns the last pixel before a groove
  // into a blend that climbs from 0 to 0.5, so mix() eases the ramp toward
  // its mirror image, 1 - ramp, and the two meet at 0.5. Both sides of a
  // groove now arrive at 0.5, the flute's center, where the glass is flat, so
  // the groove pixel shows the image right at the groove instead of either
  // flute's bent copy. Away from the grooves the blend is 0 and the ramp is
  // unchanged.
  const distanceToGroove = abs(ramp.sub(0.5)).sub(0.5);
  const grooveBlend = smoothstep(rampPerPixel.negate(), rampPerPixel, distanceToGroove);
  const smoothRamp = mix(ramp, ramp.oneMinus(), grooveBlend);

  // *2-1 stretches the ramp to run from -1 at one groove, through 0 at the
  // center, to 1 at the other groove.
  const fluteOffset = smoothRamp.mul(2).sub(1);

  // ---------------------------------------------
  // The cross-section: picking an exponent from the dial
  // ---------------------------------------------
  // The dial picks the exponent that shapes the slope below, on a doubling
  // scale. dialFromRound runs from -1 at a prism, through 0 at round, to 1 at
  // flat. The prism half raises PRISM_EXPONENT to its distance from round,
  // and the flat half raises FLAT_EXPONENT the same way. At round both give
  // 1, since anything to the power 0 is 1, so 0.5 is exactly round whatever
  // the ends are. Each equal step of the dial multiplies the exponent by the
  // same factor, so a sweep morphs the shape evenly. With ends of 1/16 and
  // 16, the exponent doubles every eighth of the dial.
  const dialFromRound = crossSection.mul(2).sub(1);
  const exponentEnd = select(
    dialFromRound.lessThan(0),
    float(PRISM_EXPONENT),
    float(FLAT_EXPONENT),
  );
  const exponent = pow(exponentEnd, abs(dialFromRound));

  // ---------------------------------------------
  // The slope: shaping a curve with an exponent
  // ---------------------------------------------
  // The slope's size is the distance from the flute's center, |offset|,
  // raised to the exponent. Because that distance runs from 0 to 1, a power
  // bends the curve between without moving its ends: the center stays flat
  // and the groove stays steepest.
  //
  // - An exponent of 1 leaves a straight line, so the slope grows in step
  //   with the distance: a round lens. Strictly that draws a parabola, a
  //   shallow stand-in for a circular arc, whose slope would shoot up near
  //   the grooves.
  // - Below 1 the power lifts small values toward 1. x^(1/16) is already
  //   0.65 at x = 0.001 and 0.96 at 0.5, so the slope jumps to nearly full
  //   just off the center and stays there: two flat faces meeting at a
  //   ridge, a prism.
  // - Above 1 the power presses small values toward 0. x^16 is 0.00002 at
  //   0.5 and reaches 0.5 only at 0.96, so the glass stays flat across the
  //   top and turns steep right at each groove.
  //
  // pow() needs a base of 0 or more, so it takes the distance, and sign()
  // puts the offset's sign back afterward, -1 left of the center and 1
  // right of it. Pointing the result along `across` turns it into a vector,
  // so on either side of the center the slope points toward the nearer
  // groove.
  const shapedSlope = sign(fluteOffset).mul(pow(abs(fluteOffset), exponent));

  // A prism's ridge jumps too. Just off the center x^(1/16) leaps from 0 to
  // about 0.65 inside a sliver much thinner than a pixel, so the two faces
  // meet in a staircase of their own. The same pixel width, doubled because
  // the offset runs twice as fast as the ramp, fades the slope in over the
  // first pixel either side of the center. On a round or flat flute the
  // slope there is already close to 0, so the fade changes nothing you can
  // see. It also softens the groove pixel, where the smoothed offset passes
  // through 0 on its way between flutes.
  const ridgeBlend = smoothstep(0, rampPerPixel.mul(2), abs(fluteOffset));
  const slopeAmount = shapedSlope.mul(ridgeBlend);
  const slope = across.mul(slopeAmount);

  // The steepness takes the same power of fromCenter rather than of the
  // smoothed offset. Away from the grooves the two are equal, so it is the
  // slope's length there. On a groove's own pixel, where the smoothing pulls
  // the slope through 0, it keeps climbing toward 1. The ridge fade reads
  // fromCenter too, so it fades only at the center and never at a groove.
  const steepness = pow(fromCenter, exponent).mul(smoothstep(0, rampPerPixel.mul(2), fromCenter));

  // ---------------------------------------------
  // The bend: refraction as a sample offset
  // ---------------------------------------------
  // Glass doesn't move pixels. It changes which point of the image behind it
  // reaches the eye, so a shader bends an image by sampling it somewhere
  // else. The bend is the slope times the dial, in half flute widths. On a
  // round flute at a refraction of 1, a point at offset x from the center
  // samples at 2x, so the flute's own width shows twice that width of image:
  // a squeezed copy of what lies right under it. The bend points away from
  // the center on both sides, which is what squeezes rather than stretches.
  // Other cross-sections spread the same span unevenly. A prism shifts each
  // face's half of the copy outward whole, and a flat top barely moves its
  // middle and crams the rest against the walls.
  const bend = slope.mul(refraction).mul(fluteWidth.mul(0.5));

  return { bend, slope, fromCenter, steepness };
}

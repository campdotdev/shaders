// The brightness across one strand: brightest on its center line and fading
// to nothing at its edges. Plain TSL math, so it runs in any shader stage
// and needs no strand geometry. extrudeStrand supplies the distance when
// the strand is a mesh.
import { clamp, exp, float, max, type ShaderNodeObject } from 'three/tsl';
import type { Node } from 'three/webgpu';

import type { TSLNode } from '../color-ramp/color-ramp.js';

/**
 * The narrowest half-width a strand is drawn at, in CSS pixels. A strand
 * asked to be thinner keeps this width and dims instead. Lower lets strands
 * get finer before they dim, and below about 1 a strand starts to break into
 * dots where it runs at a slant, because it slips between pixel centers.
 */
export const MIN_STRAND_HALF_WIDTH = 1.5;

// How many standard deviations of the bell curve fit between the center line
// and the strand's edge. At 3 the curve has fallen to about 1% at the edge,
// so the strip's hard edge is invisible. Lower makes a strand look fatter
// for the same width and its edge easier to see.
const DEVIATIONS_TO_EDGE = 3;

/**
 * The brightness across a strand, from 1 on its center line to about 0 at
 * its edges, as a float node.
 *
 * `distance` is how far the pixel is from the center line, and `strandWidth`
 * is how thick the strand is from edge to edge, both in the same pixels.
 * Pass the distance extrudeStrand returns and the strandWidth you gave it,
 * which are both in CSS pixels.
 *
 * A strand thinner than a few pixels can't be drawn thinner still: a curve
 * narrower than a pixel lights some pixels and misses others, and it
 * flickers as it moves. So below a half-width of MIN_STRAND_HALF_WIDTH the
 * strand keeps that width and loses brightness in proportion. A strand half
 * as wide as the minimum draws at the minimum, half as bright.
 */
export function strandProfile(
  distance: TSLNode | number,
  strandWidth: TSLNode | number,
): ShaderNodeObject<Node> {
  const halfWidth = float(strandWidth).mul(0.5);
  const drawnHalfWidth = max(halfWidth, MIN_STRAND_HALF_WIDTH);

  // A Gaussian, the bell curve: exp(-x^2 / 2), where x is the distance in
  // standard deviations. It is 1 at x = 0, about 0.61 at x = 1, and about
  // 0.011 at x = 3, the strand's edge. The sign of the distance drops out
  // in the square, so either side of the center line reads the same.
  const deviation = drawnHalfWidth.div(DEVIATIONS_TO_EDGE);
  const offset = float(distance).div(deviation);
  const bell = exp(offset.mul(offset).mul(-0.5));

  // 1 for any strand at least the minimum wide. Below it, the share of the
  // minimum the strand asked for: 0.5 at half the minimum, 0 at no width.
  const dim = clamp(halfWidth.div(MIN_STRAND_HALF_WIDTH), 0, 1);

  return bell.mul(dim);
}

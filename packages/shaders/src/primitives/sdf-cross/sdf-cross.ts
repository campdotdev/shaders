// An x mark as a signed distance field: two rectangles, one along each
// diagonal, unioned. The arms end square, the way a rectangle does, so a
// mark matches an x drawn as two overlapping strokes with flat caps. Lives
// next to sdf-circle, which shows the same contract: negative inside, zero
// on the edge, positive outside, so the caller's smoothstep across zero is
// the anti-aliasing.
import { abs, length, max, min, vec2 } from 'three/tsl';
import type { ShaderNodeObject } from 'three/tsl';
import type { Node } from 'three/webgpu';

import type { TSLNode } from '../color-ramp/color-ramp.js';

// Rotating a point 45 degrees swings the two diagonals onto the axes. The
// rotation is (x + y, x - y) scaled by 1 / sqrt(2), which keeps lengths.
const HALF_SQRT_2 = Math.SQRT1_2;

/**
 * Signed distance to a rectangle centered at the origin with half-extents
 * `halfSize`, the standard construction: `abs(q) - halfSize` is the offset
 * past each edge, positive outside, so the length of its positive part is
 * the distance from outside and the larger (least negative) component is
 * the distance from inside.
 */
function signedDistanceFieldBox(
  q: ShaderNodeObject<Node>,
  halfSize: ShaderNodeObject<Node>,
): ShaderNodeObject<Node> {
  const edgeOffset = abs(q).sub(halfSize);
  const outside = length(max(edgeOffset, 0));
  const inside = min(max(edgeOffset.x, edgeOffset.y), 0);

  return outside.add(inside);
}

/**
 * Signed distance field for an x centered at the origin.
 *
 * The x is the union of two rectangles rotated 45 degrees, each running
 * `armHalfLength` from the center along a diagonal and `armHalfThickness`
 * either side of it. The union of two fields is their minimum: a point is
 * inside the x when it is inside either arm. The mark's bounding box, tip to
 * tip, is `(armHalfLength + armHalfThickness) * sqrt(2)` on a side, because
 * the tip's outer corner sits `armHalfThickness` past the arm's end.
 *
 * @param p — Vec2 TSL node, an offset from the mark's center.
 * @param armHalfLength — Half the arm's length, from the center to a flat
 *   tip. JS-side scalar or a scalar TSL node.
 * @param armHalfThickness — Half the arm's thickness. JS-side scalar or a
 *   scalar TSL node.
 */
export function signedDistanceFieldCross(
  p: TSLNode,
  armHalfLength: TSLNode | number,
  armHalfThickness: TSLNode | number,
): ShaderNodeObject<Node> {
  // vec2(0).add(p) lifts p into a chainable receiver, so a bare vec uniform
  // passed as p stays in argument position (the vec-uniform gotcha). Then
  // the 45 degree turn puts each arm on an axis.
  const point = vec2(0, 0).add(p);
  const rotated = vec2(point.x.add(point.y), point.x.sub(point.y)).mul(HALF_SQRT_2);

  // One arm lies along x (long in x, thin in y), the other along y.
  const armAlongX = signedDistanceFieldBox(rotated, vec2(armHalfLength, armHalfThickness));
  const armAlongY = signedDistanceFieldBox(rotated, vec2(armHalfThickness, armHalfLength));

  return min(armAlongX, armAlongY);
}

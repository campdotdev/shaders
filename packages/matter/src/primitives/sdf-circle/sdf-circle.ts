import { length } from 'three/tsl';
import type { ShaderNodeObject } from 'three/tsl';
import type { Node } from 'three/webgpu';

import type { TSLNode } from '../color-ramp/color-ramp.js';

/**
 * Signed distance field for a circle centered at the origin.
 *
 *   sdfCircle(p, r) = length(p) - r
 *
 * Negative inside the circle, zero on the boundary, positive outside.
 * Combine with `smoothstep(-edge, +edge, sdf)` to render a soft-edged disk.
 *
 * @param p — Vec2 TSL node (typically a UV-space offset from the center).
 * @param radius — JS-side scalar OR a scalar TSL node.
 */
export function signedDistanceFieldCircle(
  p: TSLNode,
  radius: TSLNode | number,
): ShaderNodeObject<Node> {
  return length(p).sub(radius);
}

import { length } from 'three/tsl'
import type { TSLNode } from './colorRamp.js'
import type { ShaderNodeObject } from 'three/tsl'
import type { Node } from 'three/webgpu'

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
export function sdfCircle(p: TSLNode, radius: TSLNode | number): TSLNode {
  const lp = length(p) as ShaderNodeObject<Node>
  if (typeof radius === 'number') {
    return lp.sub(radius)
  }
  return lp.sub(radius as ShaderNodeObject<Node>)
}

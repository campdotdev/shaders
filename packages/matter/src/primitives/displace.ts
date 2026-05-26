import { add } from 'three/tsl'
import type { TSLNode } from './colorRamp.js'
import type { ShaderNodeObject } from 'three/tsl'
import type { Node } from 'three/webgpu'

/**
 * Naive vector addition: returns `p + by`.
 *
 *   displace(p, by) = p + by
 *
 * Thin wrapper that names the spatial intent of shifting a sample point.
 *
 * **SDF caveat:** when using this to translate an SDF render, pass the
 * NEGATED translation — `sdfCircle(displace(p, v.mul(-1)), r)` renders the
 * disk at position `+v` because SDF translation evaluates as
 * `length(p - center) - r`. Adding `+v` to the sample point shifts the
 * rendered shape in the OPPOSITE direction.
 *
 * @param p — Vec2 TSL node (the position being displaced).
 * @param by — Vec2 TSL node (the displacement vector).
 */
export function displace(p: TSLNode, by: TSLNode): ShaderNodeObject<Node> {
  return add(p, by)
}

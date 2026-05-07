import type { TSLNode } from './colorRamp.js'
import type { ShaderNodeObject } from 'three/tsl'
import type { Node } from 'three/webgpu'

/**
 * Displace a Vec2 point by another Vec2.
 *
 *   displace(p, by) = p + by
 *
 * Thin wrapper that exists so consumer code reads as the spatial intent
 * ("displace the cell center by the cursor pull") instead of arithmetic.
 *
 * @param p — Vec2 TSL node (the position being displaced).
 * @param by — Vec2 TSL node (the displacement vector).
 */
export function displace(p: TSLNode, by: TSLNode): TSLNode {
  return (p as ShaderNodeObject<Node>).add(by as ShaderNodeObject<Node>)
}

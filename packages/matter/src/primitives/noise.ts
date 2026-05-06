// packages/matter/src/primitives/noise.ts
import { mx_noise_float } from 'three/tsl'
import type { TSLNode } from './colorRamp.js'

/**
 * 2D simplex noise sampled at a point. Returns a scalar TSL node in
 * approximately [-1, 1] (MaterialX's mx_noise_float is roughly that range).
 *
 * @param p — Vec2 TSL node (typically `uv()` or a scaled/offset uv).
 *
 * Built on top of three's `mx_noise_float`; we wrap it so consumers have a
 * stable import path through `@lovo/matter` and we can swap the
 * implementation if a different noise primitive proves better in practice.
 */
export function noise(p: TSLNode): TSLNode {
  return mx_noise_float(p) as unknown as TSLNode
}

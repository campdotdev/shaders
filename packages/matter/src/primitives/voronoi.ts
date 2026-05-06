// packages/matter/src/primitives/voronoi.ts
import { mx_worley_noise_float } from 'three/tsl'
import type { TSLNode } from './colorRamp.js'

/**
 * 2D voronoi (Worley) noise — distance to the nearest jittered cell point,
 * normalized roughly to [0, 1]. Higher values = farther from any cell point
 * (cell interiors); lower values = near a cell boundary.
 *
 * Built on three's `mx_worley_noise_float`. Combine with `colorRamp` for
 * a multi-color cellular pattern; threshold via `step`/`smoothstep` for
 * hard cell shapes.
 *
 * @param p — Vec2 TSL node, typically `uv() * scale`.
 */
export function voronoi(p: TSLNode): TSLNode {
  return mx_worley_noise_float(p) as unknown as TSLNode
}

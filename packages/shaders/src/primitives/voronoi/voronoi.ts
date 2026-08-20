import { mx_worley_noise_float } from 'three/tsl';
import type { ShaderNodeObject } from 'three/tsl';
import type { Node } from 'three/webgpu';

import type { TSLNode } from '../color-ramp/color-ramp.js';

/**
 * 2D voronoi (Worley) noise — distance to the nearest jittered seed point,
 * normalized roughly to [0, 1]. Lower values = near a seed (the dark spot
 * at each cell's core); higher values = far from every seed, which happens
 * along the ridges where neighboring cells meet.
 *
 * Built on three's `mx_worley_noise_float`. Combine with `colorRamp` for
 * a multi-color cellular pattern; threshold via `step`/`smoothstep` for
 * hard cell shapes.
 *
 * Returns `ShaderNodeObject<Node>` (chainable) for cast-free call sites.
 *
 * @param p — Vec2 TSL node, typically `uv() * scale`.
 */
export function voronoi(p: TSLNode): ShaderNodeObject<Node> {
  return mx_worley_noise_float(p);
}

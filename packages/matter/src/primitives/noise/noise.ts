import { mx_noise_float } from 'three/tsl';
import type { ShaderNodeObject } from 'three/tsl';
import type { Node } from 'three/webgpu';

import type { TSLNode } from '../color-ramp/color-ramp.js';

/**
 * 2D simplex noise sampled at a point. Returns a scalar TSL node in
 * approximately [-1, 1] (MaterialX's mx_noise_float is roughly that range).
 *
 * @param p — Vec2 TSL node (typically `uv()` or a scaled/offset uv).
 *
 * Built on top of three's `mx_noise_float`; we wrap it so consumers have a
 * stable import path through `@lovo/matter` and we can swap the
 * implementation if a different noise primitive proves better in practice.
 *
 * Returns `ShaderNodeObject<Node>` (chainable) rather than the broader
 * `TSLNode` union, so callers can `.add(...)`/`.mul(...)` without casting.
 */
export function noise(p: TSLNode): ShaderNodeObject<Node> {
  return mx_noise_float(p);
}

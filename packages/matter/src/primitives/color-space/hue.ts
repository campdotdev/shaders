import type { ShaderNodeObject } from 'three/tsl';
import { mod } from 'three/tsl';
import type { Node } from 'three/webgpu';

import type { TSLNode } from '../color-ramp/color-ramp.js';

/**
 * Interpolate a hue from `h1` to `h2` along the SHORTER arc (CSS Color 4 default).
 * `period` is the hue's full range (2π for radians, 1 for turns). The delta is
 * wrapped into [-period/2, period/2) so the lerp never travels the long way.
 */
export function shortestArcHue(
  h1: ShaderNodeObject<Node>,
  h2: ShaderNodeObject<Node>,
  t: TSLNode,
  period: number,
): ShaderNodeObject<Node> {
  const half = period / 2;
  const delta = mod(h2.sub(h1).add(half), period).sub(half);

  return h1.add(delta.mul(t));
}

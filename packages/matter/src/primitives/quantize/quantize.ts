import type { ShaderNodeObject } from 'three/tsl';
import { max, sub } from 'three/tsl';
import type { Node } from 'three/webgpu';

import type { TSLNode } from '../color-ramp/color-ramp.js';

/**
 * Quantize a TSL node to `steps` discrete levels (component-wise for vecs).
 *
 *   quantize(t, 4) → values in {0, 0.25, 0.5, 0.75, 1.0}
 *
 * `steps` is either a JS number (baked into the shader at build time) or a
 * float node (e.g. a uniform — animatable level counts; fractional values
 * are well-defined, the spacing just animates continuously). Node steps are
 * clamped so the divisor never reaches zero.
 *
 * `threshold` replaces the 0.5 rounding constant, which is exactly what
 * ordered dithering is: a per-cell threshold in [0, 1) decides whether a
 * value between two levels rounds up or down. Omitted, plain rounding.
 */
export function quantize(
  t: ShaderNodeObject<Node>,
  steps: number | TSLNode,
  threshold: number | TSLNode = 0.5,
): ShaderNodeObject<Node> {
  if (typeof steps === 'number' && steps <= 1) {
    // Edge case: single step → constant 0. Return as-is wrapped in mul(0).
    return t.mul(0);
  }
  // Functional-form ops for the node case: `steps` is TSLNode (the union),
  // which has no chain-method receiver (see colorRamp's localT for the same
  // trick).
  const denominator = typeof steps === 'number' ? steps - 1 : max(sub(steps, 1), 1);

  // floor(t * (steps-1) + threshold) / (steps-1)
  // Using floor(x + threshold) instead of round() for TSL portability.
  return t.mul(denominator).add(threshold).floor().div(denominator);
}

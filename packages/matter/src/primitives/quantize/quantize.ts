import type { ShaderNodeObject } from 'three/tsl';
import { greaterThan, max, select, sub } from 'three/tsl';
import type { Node } from 'three/webgpu';

import type { TSLNode } from '../color-ramp/color-ramp.js';

/**
 * Quantize a TSL node to `steps` discrete levels (component-wise for vecs).
 *
 *   quantize(t, 4) → values in {0, 0.25, 0.5, 0.75, 1.0}
 *
 * `steps` is either a JS number (baked into the shader at build time) or a
 * float node (e.g. a uniform — animatable level counts; fractional values
 * are well-defined, the spacing just animates continuously). Either way,
 * steps <= 1 leaves a single level: constant 0.
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
  const quantized = t.mul(denominator).add(threshold).floor().div(denominator);
  if (typeof steps === 'number') {
    return quantized;
  }

  // Node steps can't take the early return above — the value only exists on
  // the GPU — so the same edge case gates at runtime: at steps <= 1 the
  // max() clamp would otherwise turn the formula into a binary threshold
  // instead of the single level 0 the numeric path produces.
  return select(greaterThan(steps, 1), quantized, t.mul(0));
}

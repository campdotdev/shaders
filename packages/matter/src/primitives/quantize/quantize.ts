import type { ShaderNodeObject } from 'three/tsl';
import type { Node } from 'three/webgpu';

/**
 * Quantize a scalar TSL node to `steps` discrete levels.
 *
 *   quantize(t, 4) → values in {0, 0.25, 0.5, 0.75, 1.0}
 *
 * `steps` is a JS-side number (loop-equivalent at TSL build time, baked in).
 * If you need an animatable step count, rebuild the TSL fragment.
 */
export function quantize(t: ShaderNodeObject<Node>, steps: number): ShaderNodeObject<Node> {
  if (steps <= 1) {
    // Edge case: single step → constant 0. Return as-is wrapped in mul(0).
    return t.mul(0);
  }
  const denominator = steps - 1;

  // floor(t * (steps-1) + 0.5) / (steps-1)
  // Using floor(x + 0.5) instead of round() for TSL portability.
  return t.mul(denominator).add(0.5).floor().div(denominator);
}

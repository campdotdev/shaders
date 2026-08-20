// The TSL half of sRGB gamma conversion — the same two curves as
// cpu-transfer.ts, built as shader nodes instead of scalar functions. These
// avoid if/else by computing both segments of the piecewise curve and picking
// one with step/mix, which GPUs prefer: a branch makes every lane wait for
// both sides anyway, so the arithmetic is free by comparison.
import type { ShaderNodeObject } from 'three/tsl';
import { mix, pow, step } from 'three/tsl';
import type { Node } from 'three/webgpu';

import type { TSLNode } from '../color-ramp/color-ramp.js';

/** TSL: vec3 sRGB-encoded -> linear-sRGB (branchless via step/mix). */
export function srgbToLinear(srgb: TSLNode): ShaderNodeObject<Node> {
  // pow(srgb, 1) normalizes the TSLNode union into a chainable node (no-op).
  const value = pow(srgb, 1);
  const lowSegment = value.div(12.92);
  const highSegment = pow(value.add(0.055).div(1.055), 2.4);

  // step(0.04045, value) == 1 where value >= 0.04045 -> pick the high segment.
  return mix(lowSegment, highSegment, step(0.04045, value));
}

/** TSL: vec3 linear-sRGB -> sRGB-encoded (branchless via step/mix). Inverse OETF. */
export function linearToSrgb(linear: TSLNode): ShaderNodeObject<Node> {
  const value = pow(linear, 1);
  const lowSegment = value.mul(12.92);
  const highSegment = pow(value, 1 / 2.4)
    .mul(1.055)
    .sub(0.055);

  return mix(lowSegment, highSegment, step(0.0031308, value));
}

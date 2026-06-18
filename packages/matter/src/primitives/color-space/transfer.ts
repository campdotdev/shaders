import type { ShaderNodeObject } from 'three/tsl';
import { mix, pow, step } from 'three/tsl';
import type { Node } from 'three/webgpu';

import type { TSLNode } from '../color-ramp/color-ramp.js';

/**
 * sRGB-encoded channel in [0,1] -> linear-sRGB. Standard sRGB EOTF.
 * Mirrors three's `convertSRGBToLinear` (e.g. 0.5 -> 0.21404114).
 */
export function srgbChannelToLinear(channel: number): number {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

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

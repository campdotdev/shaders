import type { ShaderNodeObject } from 'three/tsl';
import { dot, fract, sin, vec2, vec3 } from 'three/tsl';
import type { Node } from 'three/webgpu';

import type { TSLNode } from '../color-ramp/color-ramp.js';

/** Cheap per-pixel hash -> pseudo-random value in [0,1) from a 2D coordinate. */
function hash21(coord: ShaderNodeObject<Node>): ShaderNodeObject<Node> {
  return fract(sin(dot(coord, vec2(12.9898, 78.233))).mul(43758.5453));
}

/**
 * Add sub-LSB dither to break up 8-bit quantization banding (most visible on
 * wide-gamut/P3 output, where the same 256 levels span a wider gamut).
 *
 * `coord` is a per-pixel coordinate (pass `uv()`); `amount` is the noise
 * magnitude in the color's units (default ~1/255, roughly one 8-bit step). Uses a
 * triangular PDF (difference of two hashes) for flatter, less "gritty" noise than
 * uniform white noise.
 *
 * SPIKE NOTE: applied here in linear-sRGB working space (before the renderer's
 * output transfer), so the effective dither is uneven across tones (over-dithers
 * shadows, under-dithers highlights). The correct home is a final output pass
 * after color-space conversion; this is good enough to evaluate the banding fix.
 */
export function dither(color: TSLNode, coord: TSLNode, amount = 1 / 255): ShaderNodeObject<Node> {
  const pixelCoord = vec2(coord);
  const firstHash = hash21(pixelCoord);
  const secondHash = hash21(pixelCoord.add(vec2(0.5, 0.5)));
  // (r1 - r2) is triangular on [-1, 1]; halve to [-0.5, 0.5] then scale to amount.
  const triangularNoise = firstHash.sub(secondHash).mul(0.5);

  return vec3(color).add(triangularNoise.mul(amount));
}

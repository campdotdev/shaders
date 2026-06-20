import type { ShaderNodeObject } from 'three/tsl';
import { floor, fract, screenCoordinate, vec2, vec3 } from 'three/tsl';
import type { Node } from 'three/webgpu';

import type { TSLNode } from '../color-ramp/color-ramp.js';

/**
 * Ordered Bayer dithering, built recursively from the 2x2 base pattern.
 *
 * `bayer2` is the canonical 2x2 ordered-dither cell in closed form
 * (`fract(x/2 + y·y·0.75)`); `bayer4`/`bayer8` refine it by adding a quarter of
 * the next-finer cell sampled at half the frequency. `bayer8` yields a value in
 * `[0, 1)` that tiles an 8x8 threshold map across the pixel grid.
 */
function bayer2(coord: ShaderNodeObject<Node>): ShaderNodeObject<Node> {
  const cell = floor(coord);

  return fract(cell.x.mul(0.5).add(cell.y.mul(cell.y).mul(0.75)));
}

function bayer4(coord: ShaderNodeObject<Node>): ShaderNodeObject<Node> {
  return bayer2(coord.mul(0.5)).mul(0.25).add(bayer2(coord));
}

function bayer8(coord: ShaderNodeObject<Node>): ShaderNodeObject<Node> {
  return bayer4(coord.mul(0.5)).mul(0.25).add(bayer2(coord));
}

/**
 * Add a sub-LSB ordered dither to break up 8-bit quantization banding (most
 * visible on smooth gradients and on wide-gamut/P3 output, where the same 256
 * levels span a wider gamut so each step is a coarser perceptual jump).
 *
 * `amount` is the noise magnitude in the color's units (default ~1/255, roughly
 * one 8-bit step). The dither is an ordered Bayer 8x8 pattern keyed on the
 * per-pixel `screenCoordinate`, so the grain is a crisp one device-pixel cell
 * regardless of geometry or zoom, and is deterministic (no temporal shimmer —
 * important for static scenes).
 *
 * For correctness the dither belongs in display-encoded space, immediately
 * before 8-bit quantization. In a Matter-managed scene that placement is handled
 * for you (`ShaderScene` applies it as a final output stage after the color
 * transfer). This primitive is the entry point for Mode 2 (your own r3f canvas),
 * where you apply it to your shader's output yourself.
 */
export function dither(color: TSLNode, amount = 1 / 255): ShaderNodeObject<Node> {
  // Bayer cell in [0, 1); center to [-0.5, 0.5) so the dither is unbiased.
  const threshold = bayer8(vec2(screenCoordinate.xy)).sub(0.5);

  return vec3(color).add(threshold.mul(amount));
}

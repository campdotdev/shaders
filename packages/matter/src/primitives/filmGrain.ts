import { vec2, sin, fract, length } from 'three/tsl'
import type { ShaderNodeObject } from 'three/tsl'
import type { Node } from 'three/webgpu'

/**
 * Hash-based film grain — chaotic, uncorrelated per-pixel noise sampled
 * from `uvNode`. The output is *centered* around zero so it acts as a
 * brightness-preserving texture overlay (half the pixels brighten by up
 * to `intensity`, half darken, mean unchanged). ADD the result to a color.
 *
 *   filmGrain(uv, k)        → static grain
 *   filmGrain(uv, k, time)  → twinkling grain. Pass a quantized time node
 *                             (e.g. `time.mul(speed).mul(60).floor()`) so
 *                             the grain re-randomizes at a controllable
 *                             "shutter rate" instead of every frame.
 *
 * Recipe:
 *
 *   base = vec2(uv·c1, uv·c2) + timeOffset
 *   hash = fract(sin(base) * 43758.5453)
 *   out  = (length(hash) - 0.765) * intensity
 *
 * `c1 = (2127.1, 81.17)` and `c2 = (1269.5, 283.37)` are arbitrary
 * near-prime constants that produce visually-uncorrelated noise. `0.765`
 * is the empirical mean of `length(vec2(u, v))` for uniform u, v ∈ [0, 1),
 * computed once so we don't have to subtract it at runtime per pixel.
 *
 * For a film-stock look (darkens as grain rises — silver-emulsion
 * physics) subtract the result from the color instead of adding.
 *
 * @param uvNode      vec2 TSL node, typically `uv()`.
 * @param intensity   number or TSL node in [0, 1]; scales the grain.
 * @param timeOffset  optional number or TSL node added to each sample
 *                    before hashing. `0` (default) → static grain.
 */
export function filmGrain(
  uvNode: ShaderNodeObject<Node>,
  intensity: ShaderNodeObject<Node> | number,
  timeOffset: ShaderNodeObject<Node> | number = 0,
): ShaderNodeObject<Node> {
  const HASH_C1 = vec2(2127.1, 81.17)
  const HASH_C2 = vec2(1269.5, 283.37)
  const base = vec2(uvNode.dot(HASH_C1).add(timeOffset), uvNode.dot(HASH_C2).add(timeOffset))

  const hash = fract(sin(base).mul(43758.5453))

  return length(hash).sub(0.765).mul(intensity)
}

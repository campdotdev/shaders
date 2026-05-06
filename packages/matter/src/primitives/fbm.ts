// packages/matter/src/primitives/fbm.ts
import { noise } from './noise.js'
import type { TSLNode } from './colorRamp.js'
import type { ShaderNodeObject } from 'three/tsl'
import type { Node } from 'three/webgpu'

export interface FBMOptions {
  /** Number of octaves to sum. JS-side number — fixed at TSL build time, not a uniform. Default: 4. */
  octaves?: number
  /** Per-octave frequency multiplier. JS-side number. Default: 2. */
  lacunarity?: number
  /** Per-octave amplitude multiplier. JS-side number. Default: 0.5. */
  gain?: number
}

/**
 * Fractal Brownian Motion — sum of N octaves of 2D simplex noise.
 *
 * `octaves`, `lacunarity`, and `gain` are JavaScript numbers (NOT TSL
 * uniforms) because the loop must be unrolled at TSL-build time — TSL has
 * no dynamic-length loop primitive that maps cleanly to all backends.
 * Animatable parameters that *do* survive on the GPU are the input UV
 * (which the caller can scale/translate per frame) and `time`.
 *
 * @param p — Vec2 TSL node (UV-space position).
 * @returns scalar TSL node, roughly [-1..1] but normalized closer to
 *          [-0.5..0.5] when amplitude sums approach 1 with the default gain.
 */
export function fbm(p: TSLNode, opts: FBMOptions = {}): TSLNode {
  const octaves = opts.octaves ?? 4
  const lacunarity = opts.lacunarity ?? 2
  const gain = opts.gain ?? 0.5

  let sum: TSLNode = noise(p)
  let amp = 1
  let freq = 1
  let total = amp
  for (let i = 1; i < octaves; i++) {
    freq *= lacunarity
    amp *= gain
    total += amp
    // Multiply UV by the per-octave frequency before sampling.
    // (`p as ShaderNodeObject` so we can call `.mul`; #12 doesn't apply
    //  here because `p` is built from `uv()`/`vec2()`, not from a uniform.)
    const pAtFreq = (p as ShaderNodeObject<Node>).mul(freq)
    const layer = (noise(pAtFreq) as ShaderNodeObject<Node>).mul(amp)
    sum = (sum as ShaderNodeObject<Node>).add(layer)
  }
  // Normalize to approximate [-1..1] regardless of octave count / gain.
  return (sum as ShaderNodeObject<Node>).div(total)
}

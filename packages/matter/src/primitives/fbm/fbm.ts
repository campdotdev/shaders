// packages/matter/src/primitives/fbm/fbm.ts
import { add, mul } from 'three/tsl'
import type { ShaderNodeObject } from 'three/tsl'
import type { Node } from 'three/webgpu'

import type { TSLNode } from '../color-ramp/color-ramp.js'
import { noise } from '../noise/noise.js'

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
 * Each octave samples noise at a higher frequency (× `lacunarity`) and lower
 * amplitude (× `gain`) than the previous one, AND at a translated coordinate
 * so the octaves sample uncorrelated regions of noise space. Without the
 * per-octave translation, octaves at related frequencies tend to pile up
 * peaks and troughs at the same input coordinates, producing visibly muddy
 * "spotty" output. With it, the octaves look like independent noise patterns
 * layered together — Inigo Quilez's classic FBM technique.
 *
 * `octaves`, `lacunarity`, and `gain` are JavaScript numbers (NOT TSL
 * uniforms) because the loop must be unrolled at TSL-build time — TSL has
 * no dynamic-length loop primitive that maps cleanly to all backends.
 * Animatable parameters that *do* survive on the GPU are the input UV
 * (which the caller can scale/translate per frame) and `time`.
 *
 * Returns `ShaderNodeObject<Node>` (chainable) for cast-free call sites.
 *
 * @param p — Vec2 or Vec3 TSL node (UV-space position).
 * @returns scalar TSL node, normalized to roughly [-1..1] regardless of
 *          octave count thanks to the amplitude-sum division at the end.
 */
export function fbm(p: TSLNode, opts: FBMOptions = {}): ShaderNodeObject<Node> {
  const octaves = opts.octaves ?? 4
  const lacunarity = opts.lacunarity ?? 2
  const gain = opts.gain ?? 0.5

  let sum: ShaderNodeObject<Node> = noise(p)
  let amp = 1
  let freq = 1
  let total = amp

  for (let i = 1; i < octaves; i += 1) {
    freq *= lacunarity
    amp *= gain
    total += amp
    // Per-octave decorrelation: translate the sample point by a growing
    // offset so this octave reads from a totally different region of noise
    // space than the previous one. Magnitude 100 is well past simplex
    // noise's ~1-unit feature size, so adjacent octaves are fully
    // decorrelated. The scalar broadcasts across all components of `p`
    // (works for vec2 and vec3 inputs alike).
    //
    // Build the chain functionally from `p`: gotcha #12 doesn't apply
    // because `p` is uv-rooted, but the TSLNode union still requires
    // functional form on this hop.
    const pAtFreq = add(mul(p, freq), i * 100)
    const layer = noise(pAtFreq).mul(amp)

    sum = sum.add(layer)
  }

  // Normalize to approximate [-1..1] regardless of octave count / gain.
  return sum.div(total)
}

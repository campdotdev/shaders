import { abs, add, float, max, mul, pow, sqrt } from 'three/tsl';
import type { ShaderNodeObject } from 'three/tsl';
import type { Node } from 'three/webgpu';

import type { TSLNode } from '../color-ramp/color-ramp.js';
import { simplexNoise } from '../noise/noise.js';

/**
 * Per-octave turbulence fold, applied before summing.
 * - `'none'`   — raw signed simplex, range ≈ -1..1.
 * - `'smooth'` — abs(n)², soft rounded billows, range ≈ 0..1.
 * - `'sharp'`  — sqrt(abs(n)), crisp bright creases, range ≈ 0..1.
 */
export type FractalFold = 'none' | 'smooth' | 'sharp';

export interface FractalNoiseOptions {
  /** Number of octaves to sum, an integer >= 1. JS-side number — fixed at TSL build time, not a uniform. Default: 4. */
  octaves?: number;
  /** Per-octave frequency multiplier. JS-side number. Default: 2. */
  lacunarity?: number;
  /**
   * Per-octave amplitude multiplier, non-negative. A plain number bakes into
   * the shader; a TSL node (e.g. a uniform) keeps it live on the GPU so it
   * can glide without a rebuild — amplitude becomes pow(gain, octaveIndex).
   * Numbers below 0 throw; node values are clamped at 0 on the GPU.
   * Default: 0.5.
   */
  gain?: number | TSLNode;
  /**
   * Turbulence fold applied to each octave before summing. Changes the
   * output range — see {@link FractalFold}. Default: 'none'.
   */
  fold?: FractalFold;
}

/**
 * Applies the turbulence fold to one octave of signed noise. `abs()`
 * reflects the negative half of the noise upward, creating a crease along
 * every zero crossing; squaring rounds those creases into soft billows,
 * while `sqrt()` steepens values near zero so the creases read as thin
 * bright veins — the classic "turbulence" look.
 */
function foldOctave(n: ShaderNodeObject<Node>, fold: FractalFold): ShaderNodeObject<Node> {
  if (fold === 'smooth') {
    const magnitude = abs(n);

    return magnitude.mul(magnitude);
  }
  if (fold === 'sharp') {
    return sqrt(abs(n));
  }

  return n;
}

/**
 * Fractal Brownian Motion — sum of N octaves of simplex noise.
 *
 * Each octave samples noise at a higher frequency (× `lacunarity`) and lower
 * amplitude (× `gain`) than the previous one, AND at a translated coordinate
 * so the octaves sample uncorrelated regions of noise space. Without the
 * per-octave translation, octaves at related frequencies tend to pile up
 * peaks and troughs at the same input coordinates, producing visibly muddy
 * "spotty" output. With it, the octaves look like independent noise patterns
 * layered together — Inigo Quilez's classic FBM technique.
 *
 * `octaves` and `lacunarity` are JavaScript numbers (NOT TSL uniforms)
 * because the loop must be unrolled at TSL-build time — TSL has no
 * dynamic-length loop primitive that maps cleanly to all backends. `gain`
 * may be either: a number bakes amplitudes into the shader, while a node
 * (e.g. a uniform) computes them on the GPU as pow(gain, i) so it can
 * change per frame. The input UV (which the caller can scale/translate per
 * frame) and `time` stay live on the GPU as well.
 *
 * Returns `ShaderNodeObject<Node>` (chainable) for cast-free call sites.
 *
 * @param p — Vec2 or Vec3 TSL node (UV-space position).
 * @returns scalar TSL node, normalized by the amplitude sum regardless of
 *          octave count: roughly [-1..1] with `fold: 'none'`, roughly
 *          [0..1] with the folded modes (folding runs each octave through
 *          `abs()`, so nothing negative survives).
 */
export function fractalNoise(p: TSLNode, opts: FractalNoiseOptions = {}): ShaderNodeObject<Node> {
  const octaves = opts.octaves ?? 4;
  const lacunarity = opts.lacunarity ?? 2;
  const gain = opts.gain ?? 0.5;
  const fold = opts.fold ?? 'none';

  // The octave loops below unroll in JavaScript at shader-build time, so a
  // bad count fails in ways TypeScript can't catch: Infinity spins the loop
  // forever (tab hang), NaN and fractions mis-build silently. Fail loudly
  // instead. Number.isInteger rejects all three in one check.
  if (!Number.isInteger(octaves) || octaves < 1) {
    throw new Error(`fractalNoise: octaves must be an integer >= 1, got ${String(octaves)}.`);
  }

  // Gain must be non-negative: amplitudes are gain^i, and a negative gain
  // alternates their signs, letting the normalizing sum cancel to zero
  // (gain -1 over 2 octaves: 1 + (-1) = 0) and the final divide go NaN.
  if (typeof gain === 'number' && (!Number.isFinite(gain) || gain < 0)) {
    throw new Error(`fractalNoise: gain must be a finite number >= 0, got ${String(gain)}.`);
  }

  if (typeof gain !== 'number') {
    // Node gain: the amplitude of octave i is gain^i, computed in TSL so a
    // uniform gain can change per frame without recompiling the shader.
    // Both `sum` and `total` are additive chains — each step references the
    // accumulator exactly once, so this stays clear of the exponential
    // getNodeType recursion that bans select-chain accumulators (see
    // AGENTS.md, the running-minimum gotcha).
    let sum = foldOctave(simplexNoise(p), fold);
    // gain^0 = 1: the base octave's amplitude, starting the normalizing total.
    let total: ShaderNodeObject<Node> = float(1);
    let frequency = 1;

    // A node gain can't be validated at build time, so clamp it on the GPU:
    // pow() of a negative base is NaN in WGSL/GLSL, and clamping keeps every
    // amplitude >= 0 so the normalizing total stays >= 1 (never a zero divide).
    const safeGain = max(gain, 0);

    for (let i = 1; i < octaves; i += 1) {
      frequency *= lacunarity;
      // pow(gain, i): gain rides in as an argument, not a chained receiver —
      // safe for any node (and scalar uniforms are safe either way).
      const amplitude = pow(safeGain, i);

      total = total.add(amplitude);

      // Same per-octave decorrelation as the number path below.
      const pAtFreq = add(mul(p, frequency), i * 100);

      sum = sum.add(foldOctave(simplexNoise(pAtFreq), fold).mul(amplitude));
    }

    return sum.div(total);
  }

  let sum: ShaderNodeObject<Node> = foldOctave(simplexNoise(p), fold);
  let amplitude = 1;
  let frequency = 1;
  let total = amplitude;

  for (let i = 1; i < octaves; i += 1) {
    frequency *= lacunarity;
    amplitude *= gain;
    total += amplitude;
    // Per-octave decorrelation: translate the sample point by a growing
    // offset so this octave reads from a totally different region of noise
    // space than the previous one. Magnitude 100 is well past simplex
    // noise's ~1-unit feature size, so adjacent octaves are fully
    // decorrelated. The scalar broadcasts across all components of `p`
    // (works for vec2 and vec3 inputs alike).
    //
    // Build the chain functionally from `p`: the vec-uniform-as-receiver
    // gotcha doesn't apply because `p` is uv-rooted, but the TSLNode union
    // still requires functional form on this hop.
    const pAtFreq = add(mul(p, frequency), i * 100);
    const layer = foldOctave(simplexNoise(pAtFreq), fold).mul(amplitude);

    sum = sum.add(layer);
  }

  // Dividing by the summed amplitudes keeps the output range independent of
  // octave count and gain. The range itself depends on the fold: roughly
  // [-1..1] for 'none', roughly [0..1] for the folded modes (abs() leaves
  // nothing negative to sum).
  return sum.div(total);
}

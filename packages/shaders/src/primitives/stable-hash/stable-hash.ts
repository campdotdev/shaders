// Backend-stable integer hash: the same PCG hash three's TSL hash() uses,
// rebuilt so both GPU backends run it with the same constants. Every
// primitive that needs per-cell or per-frame randomness (voronoi, grain,
// metaballs, dither-pattern) draws from this instead of three's hash().
import type { ShaderNodeObject } from 'three/tsl';
import { Fn, min, uint } from 'three/tsl';
import type { Node } from 'three/webgpu';

// The shape three's Fn returns at runtime once it has a layout. @types/three
// 0.170 declares Fn as a plain function and omits setLayout, which
// three.webgpu.js defines on every Fn (grep `fn.setLayout`), so the cast
// below is the typings lagging the runtime. Remove it, and this interface,
// when a three types bump adds setLayout.
interface LayoutFn<Args extends unknown[], Result> {
  (...args: Args): Result;
  setLayout(layout: {
    name: string;
    type: string;
    inputs: Array<{ name: string; type: string }>;
  }): LayoutFn<Args, Result>;
}

// ---------------------------------------------------------------
// Why this exists (MAT-92)
// ---------------------------------------------------------------
// three's hash() writes its PCG constants as bare JS numbers. TSL types a
// bare number as float, so both code generators emit the constant as a
// float literal wrapped in a uint conversion — u32(747796405.0) in WGSL,
// uint(747796405.0) in GLSL. The same text means different numbers in the
// two languages:
//
//   - WGSL evaluates unsuffixed literals at 64-bit precision during
//     constant folding, so the conversion recovers the exact integer.
//   - GLSL float literals ARE 32-bit floats. A float's 24-bit mantissa
//     cannot hold these 30-32 bit constants, so GLSL rounds them first:
//     747796405 -> 747796416, 2891336453 -> 2891336448,
//     277803737 -> 277803744.
//
// The WebGL2 fallback therefore ran a structurally identical PCG with
// wrong constants — a perfectly valid hash, just not the same one — and
// every seeded layout diverged between backends (MAT-92).
//
// The fix is to declare each constant with uint(), which makes a
// uint-typed constant node. Both builders emit those as integer literals
// (747796405u), exact in both languages. Output is bit-identical to what
// the WebGPU backend always produced, so the canonical pattern is the one
// posters were already captured on; only WebGL2 output changes.

// The PCG body as one emitted shader function. A laid-out Fn matters for
// build time, not for the GPU: three resolves a node's type by walking its
// subgraph, with no memoization across references, so an INLINE hash body
// referenced several times per level costs multiplicatively per level of
// nesting. LedWall nests six levels and took 19 seconds to type. With the
// layout, a call site's type is read from the layout and the walk stops
// there. Measured 2026-09-09: first frame went from about 20 seconds to
// about 2.
const pcgHashFn = Fn(([seed]: [ShaderNodeObject<Node>]) => {
  // PCG (permuted congruential generator), from pcg-random.org via
  // shadertoy XlGcRh — the exact algorithm three's hash() implements.
  //
  // Step 1, the LCG scramble: state = seed * 747796405 + 2891336453. Runs
  // in u32, where multiplication wraps modulo 2^32 by definition on both
  // backends — the wrap IS the mixing.
  const state = seed.toUint().mul(uint(747796405)).add(uint(2891336453));

  // Step 2, the permutation: xorshift by a data-dependent amount (the top
  // bits of state pick how far to shift), then one more multiply. This is
  // what breaks up the LCG's lattice structure.
  const word = state
    .shiftRight(state.shiftRight(uint(28)).add(uint(4)))
    .bitXor(state)
    .mul(uint(277803737));

  // Step 3, fold: xor the halves together so every output bit depends on
  // every input bit.
  return word.shiftRight(uint(22)).bitXor(word);
});

const pcgHash =
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- @types/three 0.170 omits setLayout, which three.webgpu.js defines on every Fn; the cast papers over that typings gap, not our own code, and should go once a types bump adds it
  (pcgHashFn as unknown as LayoutFn<[ShaderNodeObject<Node>], ShaderNodeObject<Node>>).setLayout({
    name: 'stableHashUint',
    type: 'uint',
    inputs: [{ name: 'seed', type: 'uint' }],
  });

/**
 * Hash an integer-valued seed to a raw 32-bit word, identical on the WebGPU
 * and WebGL2 backends.
 *
 * Use THIS, never a float round-trip, when the result seeds another hash.
 * The old pattern — `hash(x).mul(0xffffff).toUint()` — crossed through
 * float twice: u32 -> f32 rounds a 32-bit word into a 24-bit mantissa, and
 * the two backends' compilers take different liberties with the conversion
 * and the multiplies (measured on MAT-92: ANGLE's GLSL-to-Metal path and
 * Tint's WGSL path disagree by an ULP often enough that the truncation
 * back to u32 flipped an integer for roughly a quarter of inputs). One
 * flipped integer re-rolls every value derived from it. Integer-to-integer
 * chaining has no rounding step, so there is nothing to disagree about.
 *
 * The seed is converted to u32 first, so only the integer part
 * participates, and negative seeds are backend-defined — shift them
 * positive before hashing (see HASH_DOMAIN_OFFSET in voronoi-cells).
 * MAT-106 tracks folding negatives safely inside this function.
 */
export function stableHashUint(seed: ShaderNodeObject<Node>): ShaderNodeObject<Node> {
  // The call site converts to u32 so a float seed is truncated exactly once,
  // here, before the layout's uint input sees it.
  return pcgHash(seed.toUint());
}

/**
 * Hash an integer-valued seed to a pseudo-random float in [0, 1), identical
 * on the WebGPU and WebGL2 backends up to one unit in the last place.
 *
 * The float is for CONSUMING randomness — a ramp position, a coordinate, a
 * phase — where an ULP is invisible (~1e-8 of the range). To seed another
 * hash, take stableHashUint instead; converting this float back to an
 * integer re-amplifies that ULP into a completely different hash stream.
 * Same conversion contract as stableHashUint.
 */
export function stableHash(seed: ShaderNodeObject<Node>): ShaderNodeObject<Node> {
  // 2^-32 is a power of two, so the scale constant is exact everywhere. The
  // cap keeps the documented [0, 1) contract at the top of the range:
  // toFloat() rounds any word at or above 0xFFFFFF80 up to 2^32 (f32 spacing
  // there is 256), and 2^32 * 2^-32 would leak an exact 1.0 roughly once per
  // 33 million draws. 1 - 2^-24 is the largest float below 1, so the cap
  // moves only those out-of-contract draws and no others.
  return min(
    stableHashUint(seed)
      .toFloat()
      .mul(1 / 2 ** 32),
    1 - 2 ** -24,
  );
}

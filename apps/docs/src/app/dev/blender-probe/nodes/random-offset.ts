// SPDX-License-Identifier: GPL-2.0-or-later
//
// The Noise texture's channel offsets, from Blender 5.2.3's random_vec3_offset
// and the lookup3 hash_uint2 it calls. The seeds are constants, so the probe
// hashes them once here, with Math.fround standing in for 32-bit floats, and
// hands the shader the results. Nothing here imports three, so the test runs
// in plain Node.

function rotateJs(x: number, k: number): number {
  return ((x << k) | (x >>> (32 - k))) >>> 0;
}

function hashUint2Js(kx: number, ky: number): number {
  const seed = (0xdeadbeef + (2 << 2) + 13) >>> 0;
  let a = (seed + kx) >>> 0;
  let b = (seed + ky) >>> 0;
  let c = seed;

  c = (c ^ b) >>> 0;
  c = (c - rotateJs(b, 14)) >>> 0;
  a = (a ^ c) >>> 0;
  a = (a - rotateJs(c, 11)) >>> 0;
  b = (b ^ a) >>> 0;
  b = (b - rotateJs(a, 25)) >>> 0;
  c = (c ^ b) >>> 0;
  c = (c - rotateJs(b, 16)) >>> 0;
  a = (a ^ c) >>> 0;
  a = (a - rotateJs(c, 4)) >>> 0;
  b = (b ^ a) >>> 0;
  b = (b - rotateJs(a, 14)) >>> 0;
  c = (c ^ b) >>> 0;
  c = (c - rotateJs(b, 24)) >>> 0;

  return c;
}

function floatBits(value: number): number {
  const view = new DataView(new ArrayBuffer(4));

  view.setFloat32(0, value);

  return view.getUint32(0);
}

/** Blender's hash_vec2_to_float on a constant pair. */
function hashVec2ToFloatJs(x: number, y: number): number {
  // float(0xFFFFFFFFu) rounds to 2^32, so the division is exact.
  return Math.fround(Math.fround(hashUint2Js(floatBits(x), floatBits(y))) / 2 ** 32);
}

/**
 * Blender's random_vec3_offset: three offsets in [100, 200] for a seed.
 *
 * `100 + h * 100` rounds once here, as one fused multiply-add, not twice.
 * Clang fuses that expression in Cycles' CPU kernels on Apple Silicon, where
 * the reference renders, and the two roundings differ in the last bit for
 * seed 3's z offset. The last bit matters: fBM scales the offset point by
 * up to 2^15, which turns one bit at 193 into half a lattice cell. Rounding
 * twice put more than half the marble's pixels over a level off.
 */
export function randomVec3Offset(seed: number): [number, number, number] {
  // h * 100 is exact in a JS double, so one Math.fround is one rounding.
  const offset = (axis: number) => Math.fround(100 + hashVec2ToFloatJs(seed, axis) * 100);

  return [offset(0), offset(1), offset(2)];
}

// SPDX-License-Identifier: GPL-2.0-or-later
//
// Blender's hash functions, ported to TSL from Blender 5.2.3's
// source/blender/gpu/shaders/common/gpu_shader_common_hash.glsl. Perlin noise
// hashes each lattice corner with Bob Jenkins' lookup3, and Voronoi places
// each cell's point with a PCG hash. Matching Blender's patterns exactly
// starts with matching these bit for bit.
import { int, ivec3, uint, uvec3, vec3 } from 'three/tsl';

import { gpuFunction, type TSLNode } from './gpu-function';

// ----------------------------------------------------------------------------
// Jenkins lookup3
// ----------------------------------------------------------------------------
// lookup3 mixes three 32-bit words with adds, xors, and rotations. GPU uint
// arithmetic wraps modulo 2^32 on both backends, as the C original assumes.

// Rotate left by k bits: the bits shifted out the top come back in the bottom.
function rotate(x: TSLNode, k: number): TSLNode {
  return x.shiftLeft(uint(k)).bitOr(x.shiftRight(uint(32 - k)));
}

// lookup3's final() mix, in place on three uint variables.
function finalMix(a: TSLNode, b: TSLNode, c: TSLNode) {
  c.assign(c.bitXor(b));
  c.assign(c.sub(rotate(b, 14)));
  a.assign(a.bitXor(c));
  a.assign(a.sub(rotate(c, 11)));
  b.assign(b.bitXor(a));
  b.assign(b.sub(rotate(a, 25)));
  c.assign(c.bitXor(b));
  c.assign(c.sub(rotate(b, 16)));
  a.assign(a.bitXor(c));
  a.assign(a.sub(rotate(c, 4)));
  b.assign(b.bitXor(a));
  b.assign(b.sub(rotate(a, 14)));
  c.assign(c.bitXor(b));
  c.assign(c.sub(rotate(b, 24)));
}

// lookup3 seeds its state with 0xdeadbeef plus the key length in bytes plus
// 13. The sum is a uint constant, not a bare number, per the
// seeded-randomness gotcha in docs/agents/tsl.md.
function seedFor(wordCount: number): TSLNode {
  return uint((0xdeadbeef + (wordCount << 2) + 13) >>> 0);
}

/** Blender's hash_uint3: three uint words to one. */
export const hashUint3 = gpuFunction(
  'blenderHashUint3',
  'uint',
  [
    ['kx', 'uint'],
    ['ky', 'uint'],
    ['kz', 'uint'],
  ],
  ([kx, ky, kz]) => {
    const a = seedFor(3).add(kx).toVar();
    const b = seedFor(3).add(ky).toVar();
    const c = seedFor(3).add(kz).toVar();

    finalMix(a, b, c);

    return c;
  },
);

// ----------------------------------------------------------------------------
// PCG 3D
// ----------------------------------------------------------------------------
// Blender's hash_pcg3d_i runs in signed ints. The adds, multiplies, and xors
// give the same bits as uint math, but `v >> 16` is an arithmetic shift that
// copies the sign bit down, so the port keeps the int type for it.

/** Blender's hash_int3_to_vec3: an integer cell to a point in [0, 1]^3. */
export const hashInt3ToVec3 = gpuFunction(
  'blenderHashInt3ToVec3',
  'vec3',
  [['k', 'ivec3']],
  ([k]) => {
    const multiplier = int(1664525);
    const v = k.mul(multiplier).add(int(1013904223)).toVar();

    v.x.addAssign(v.y.mul(v.z));
    v.y.addAssign(v.z.mul(v.x));
    v.z.addAssign(v.x.mul(v.y));
    v.assign(v.bitXor(v.shiftRight(uvec3(16))));
    v.x.addAssign(v.y.mul(v.z));
    v.y.addAssign(v.z.mul(v.x));
    v.z.addAssign(v.x.mul(v.y));

    // Keep the low 31 bits, a non-negative int, and scale to [0, 1].
    // float(0x7fffffff) rounds to 2^31, so the scale is exactly 2^-31.
    return vec3(v.bitAnd(ivec3(int(0x7fffffff)))).mul(2 ** -31);
  },
);

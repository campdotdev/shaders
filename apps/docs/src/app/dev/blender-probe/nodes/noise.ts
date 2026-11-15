// SPDX-License-Identifier: GPL-2.0-or-later
//
// Blender's Perlin noise and its fBM fractal, ported to TSL from Blender
// 5.2.3's gpu_shader_material_noise.glsl, gpu_shader_material_fractal_noise.glsl,
// and gpu_shader_material_tex_noise.glsl. Blender writes its own Perlin rather
// than using a library one, so three's mx_noise gives a different pattern
// from the same settings. The Noise and Wave texture nodes both call fbm3.
import { abs, float, floor, ivec3, Loop, mix, select, step, uint, vec3, vec4 } from 'three/tsl';

import { gpuFunction, type TSLNode } from './gpu-function';
import { hashUint3 } from './hash';
import { randomVec3Offset } from './random-offset';

// ----------------------------------------------------------------------------
// Perlin noise on the integer lattice
// ----------------------------------------------------------------------------

// Perlin's quintic fade, 6t^5 - 15t^4 + 10t^3: an S-curve from 0 to 1 with
// zero slope and curvature at both ends, so cell borders leave no crease.
function fade(t: TSLNode): TSLNode {
  return t
    .mul(t)
    .mul(t)
    .mul(t.mul(t.mul(6).sub(15)).add(10));
}

function negateIf(value: TSLNode, condition: TSLNode): TSLNode {
  return select(condition.notEqual(uint(0)), value.negate(), value);
}

// The dot product of the offset (x, y, z) with one of 12 edge gradients of a
// cube, picked by the low 4 bits of the corner's hash.
const noiseGrad3 = gpuFunction(
  'blenderNoiseGrad3',
  'float',
  [
    ['hash', 'uint'],
    ['x', 'float'],
    ['y', 'float'],
    ['z', 'float'],
  ],
  ([hash, x, y, z]) => {
    const h = hash.bitAnd(uint(15)).toVar();
    const u = select(h.lessThan(uint(8)), x, y);
    const vt = select(h.equal(uint(12)).or(h.equal(uint(14))), x, z);
    const v = select(h.lessThan(uint(4)), y, vt);

    return negateIf(u, h.bitAnd(uint(1))).add(negateIf(v, h.bitAnd(uint(2))));
  },
);

// Blender's tri_mix: trilinear interpolation of the 8 corner values, written
// out in the same order as the GLSL so the float rounding matches.
type Corners = [TSLNode, TSLNode, TSLNode, TSLNode, TSLNode, TSLNode, TSLNode, TSLNode];

function triMix(corners: Corners, x: TSLNode, y: TSLNode, z: TSLNode): TSLNode {
  const [v0, v1, v2, v3, v4, v5, v6, v7] = corners;
  const x1 = float(1).sub(x);
  const y1 = float(1).sub(y);
  const z1 = float(1).sub(z);

  return z1
    .mul(y1.mul(v0.mul(x1).add(v1.mul(x))).add(y.mul(v2.mul(x1).add(v3.mul(x)))))
    .add(z.mul(y1.mul(v4.mul(x1).add(v5.mul(x))).add(y.mul(v6.mul(x1).add(v7.mul(x))))));
}

const perlin3 = gpuFunction('blenderNoisePerlin3', 'float', [['p', 'vec3']], ([p]) => {
  // Split the point into its lattice cell and its offset inside the cell.
  const cell = floor(p).toVar();
  const local = p.sub(cell).toVar();
  // int() then uint() keeps a negative cell's two's-complement bits, which
  // is what Blender's uint(int) cast hashes.
  const ix = cell.x.toInt().toUint().toVar();
  const iy = cell.y.toInt().toUint().toVar();
  const iz = cell.z.toInt().toUint().toVar();
  const corner = (dx: number, dy: number, dz: number) =>
    noiseGrad3(
      hashUint3(ix.add(uint(dx)), iy.add(uint(dy)), iz.add(uint(dz))),
      local.x.sub(dx),
      local.y.sub(dy),
      local.z.sub(dz),
    );

  return triMix(
    [
      corner(0, 0, 0),
      corner(1, 0, 0),
      corner(0, 1, 0),
      corner(1, 1, 0),
      corner(0, 0, 1),
      corner(1, 0, 1),
      corner(0, 1, 1),
      corner(1, 1, 1),
    ],
    fade(local.x),
    fade(local.y),
    fade(local.z),
  );
});

// ----------------------------------------------------------------------------
// Signed noise with Blender's range and precision guard
// ----------------------------------------------------------------------------

// Blender's compatible_mod: a - trunc(a / b) * b, the C fmod, per component.
function compatibleMod(a: TSLNode, b: number): TSLNode {
  return a.sub(vec3(ivec3(a.div(b))).mul(b));
}

/** Blender's snoise(float3): Perlin noise scaled to roughly [-1, 1]. */
export const snoise3 = gpuFunction('blenderSnoise3', 'float', [['p', 'vec3']], ([p]) => {
  // Past a million, a float's spacing is coarser than a lattice cell. Blender
  // repeats the noise every 100000 on each axis and nudges such coordinates
  // half a cell, and the port does the same so its far octaves match.
  // step(edge, x) is 1 where x >= edge, the float(bool) Blender writes.
  const precisionCorrection = step(vec3(1000000), abs(p)).mul(0.5);
  const wrapped = compatibleMod(p, 100000).add(precisionCorrection);

  // 0.982 is the scale the OSL developers measured to map 3D Perlin to [-1, 1].
  return perlin3(wrapped).mul(0.982);
});

// ----------------------------------------------------------------------------
// fBM
// ----------------------------------------------------------------------------
// Fractal Brownian motion sums octaves of noise, each at `lacunarity` times
// the frequency and `roughness` times the amplitude of the last. Detail sets
// the octave count, and the probe needs it as a number when it builds the
// shader, so each detail value gets its own GPU function with a fixed loop.

const fbmFunctions = new Map<string, (...args: TSLNode[]) => TSLNode>();

/**
 * Blender's noise_fbm(float3). `detail` and `normalize` must be constants;
 * roughness and lacunarity can be any float node.
 *
 * `maxOctave` drops every octave above it, counting the first as 0, for
 * real-time drawing. A dropped octave still adds its amplitude to the
 * normalization, as if its noise were there and averaged to zero, so the
 * octaves that stay keep their Blender weights. Infinity keeps them all.
 */
export function fbm3(
  p: TSLNode,
  detail: number,
  roughness: TSLNode,
  lacunarity: TSLNode,
  normalize: boolean,
  maxOctave = Infinity,
): TSLNode {
  const key = `${detail}|${normalize}|${maxOctave}`;
  let fn = fbmFunctions.get(key);

  if (!fn) {
    const cap = Number.isFinite(maxOctave) ? `_max${maxOctave}` : '';
    const name = `blenderFbm3_${String(detail).replace('.', '_')}_${normalize ? 'n' : 'r'}${cap}`;

    fn = gpuFunction(
      name,
      'float',
      [
        ['p', 'vec3'],
        ['roughness', 'float'],
        ['lacunarity', 'float'],
      ],
      ([point, octaveRoughness, octaveLacunarity]) =>
        buildFbm(point, { detail, maxOctave, normalize }, octaveRoughness, octaveLacunarity),
    );
    fbmFunctions.set(key, fn);
  }

  return fn(p, roughness, lacunarity);
}

interface FbmShape {
  detail: number;
  maxOctave: number;
  normalize: boolean;
}

function buildFbm(
  p: TSLNode,
  { detail, maxOctave, normalize }: FbmShape,
  roughness: TSLNode,
  lacunarity: TSLNode,
): TSLNode {
  const frequency = float(1).toVar();
  const amplitude = float(1).toVar();
  const maxAmplitude = float(0).toVar();
  const sum = float(0).toVar();
  const lastOctave = Math.floor(detail);
  const lastSampled = Math.min(lastOctave, maxOctave);

  if (lastSampled >= 0) {
    Loop({ start: 0, end: lastSampled, condition: '<=' }, () => {
      const t = snoise3(frequency.mul(p));

      sum.addAssign(t.mul(amplitude));
      maxAmplitude.addAssign(amplitude);
      amplitude.mulAssign(roughness);
      frequency.mulAssign(lacunarity);
    });
  }

  // Dropped octaves: their weight only, no noise.
  if (lastSampled < lastOctave) {
    Loop({ start: lastSampled + 1, end: lastOctave, condition: '<=' }, () => {
      maxAmplitude.addAssign(amplitude);
      amplitude.mulAssign(roughness);
      frequency.mulAssign(lacunarity);
    });
  }

  // A fractional detail blends in one more octave by its fraction.
  const remainder = detail - Math.floor(detail);
  const normalized = (total: TSLNode, totalAmplitude: TSLNode) =>
    float(0.5).mul(total).div(totalAmplitude).add(0.5);

  if (remainder === 0) {
    return normalize ? normalized(sum, maxAmplitude) : sum;
  }

  const extraOctave = lastOctave + 1 <= maxOctave ? snoise3(frequency.mul(p)) : float(0);
  const sum2 = sum.add(extraOctave.mul(amplitude));

  return normalize
    ? mix(normalized(sum, maxAmplitude), normalized(sum2, maxAmplitude.add(amplitude)), remainder)
    : mix(sum, sum2, remainder);
}

// ----------------------------------------------------------------------------
// The Noise Texture node, fBM type, 3D
// ----------------------------------------------------------------------------

export interface NoiseTexture3DInputs {
  vector: TSLNode;
  scale: TSLNode;
  detail: number;
  roughness: TSLNode;
  lacunarity: TSLNode;
  distortion: TSLNode;
  // True when distortion is a constant 0, which skips the distortion noise.
  distortionIsZero: boolean;
  normalize: boolean;
  // The highest fBM octave to draw, as fbm3's maxOctave. Infinity draws all.
  maxOctave: number;
}

/** Blender's node_noise_tex_fbm_3d. Returns Fac and Color. */
export function noiseTexture3D(inputs: NoiseTexture3DInputs): { fac: TSLNode; color: TSLNode } {
  const detail = Math.min(Math.max(inputs.detail, 0), 15);
  const roughness = inputs.roughness.max(0);
  const p = inputs.vector.mul(inputs.scale).toVar();

  if (!inputs.distortionIsZero) {
    const offsetNoise = (seed: number) =>
      snoise3(p.add(vec3(...randomVec3Offset(seed)))).mul(inputs.distortion);

    p.addAssign(vec3(offsetNoise(0), offsetNoise(1), offsetNoise(2)));
  }

  const fractal = (point: TSLNode) =>
    fbm3(point, detail, roughness, inputs.lacunarity, inputs.normalize, inputs.maxOctave);
  const fac = fractal(p).toVar();
  // The color channels are two more fBM fields at seeded offsets.
  const color = vec4(
    fac,
    fractal(p.add(vec3(...randomVec3Offset(3)))),
    fractal(p.add(vec3(...randomVec3Offset(4)))),
    1,
  );

  return { fac, color };
}

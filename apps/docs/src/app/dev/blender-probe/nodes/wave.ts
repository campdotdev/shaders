// SPDX-License-Identifier: GPL-2.0-or-later
//
// Blender's Wave texture, ported to TSL from Blender 5.2.3's
// gpu_shader_material_tex_wave.glsl. A wave is a ramp along one axis (bands)
// or out from one (rings), pushed around by fBM noise, then run through a
// sine, saw, or triangle profile.
import { abs, float, floor, length, sin, vec3, vec4 } from 'three/tsl';

import type { TSLNode } from './gpu-function';
import { fbm3 } from './noise';

export interface WaveTextureInputs {
  vector: TSLNode;
  scale: TSLNode;
  distortion: TSLNode;
  distortionIsZero: boolean;
  detail: number;
  detailScale: TSLNode;
  detailRoughness: TSLNode;
  phase: TSLNode;
  // Blender's enum values: BANDS or RINGS; X, Y, Z, DIAGONAL, or
  // SPHERICAL; and SIN, SAW, or TRI.
  waveType: string;
  bandsDirection: string;
  ringsDirection: string;
  profile: string;
}

// The position along the wave, before the profile. 20 is Blender's fixed
// frequency, so a scale of 1 gives about three waves per unit.
const BANDS: Record<string, (p: TSLNode) => TSLNode> = {
  X: (p) => p.x.mul(20),
  Y: (p) => p.y.mul(20),
  Z: (p) => p.z.mul(20),
  DIAGONAL: (p) => p.x.add(p.y).add(p.z).mul(10),
};

// Rings measure distance from an axis by dropping that axis's component, or
// from the origin when spherical.
const RINGS: Record<string, (p: TSLNode) => TSLNode> = {
  X: (p) => length(p.mul(vec3(0, 1, 1))).mul(20),
  Y: (p) => length(p.mul(vec3(1, 0, 1))).mul(20),
  Z: (p) => length(p.mul(vec3(1, 1, 0))).mul(20),
  SPHERICAL: (p) => length(p).mul(20),
};

const WAVE_TYPES: Record<string, Record<string, (p: TSLNode) => TSLNode>> = { BANDS, RINGS };

// The profile turns the position into the output: a sine, or the fraction
// of the current wave as a rising saw or a triangle.
const PROFILES: Record<string, (n: TSLNode) => TSLNode> = {
  SIN: (n) =>
    sin(n.sub(Math.PI / 2))
      .mul(0.5)
      .add(0.5),
  SAW: (n) => {
    const cycles = n.div(2 * Math.PI).toVar();

    return cycles.sub(floor(cycles));
  },
  TRI: (n) => {
    const cycles = n.div(2 * Math.PI).toVar();

    return abs(cycles.sub(floor(cycles.add(0.5)))).mul(2);
  },
};

function wavePosition(p: TSLNode, inputs: WaveTextureInputs): TSLNode {
  const direction = inputs.waveType === 'BANDS' ? inputs.bandsDirection : inputs.ringsDirection;
  const position = WAVE_TYPES[inputs.waveType]?.[direction];

  if (!position) throw new Error(`Wave ${inputs.waveType} ${direction} is not ported`);

  return position(p);
}

/** Blender's node_tex_wave. Returns Fac and Color. */
export function waveTexture(inputs: WaveTextureInputs): { fac: TSLNode; color: TSLNode } {
  // Blender nudges the coordinate off exact unit values, which would land on
  // a band edge and flicker between its two sides.
  const p = inputs.vector.mul(inputs.scale).add(0.000001).mul(0.999999).toVar();
  const n = wavePosition(p, inputs).add(inputs.phase).toVar();

  if (!inputs.distortionIsZero) {
    // Normalized fBM is in [0, 1]; * 2 - 1 centers it on zero.
    const noise = fbm3(
      p.mul(inputs.detailScale),
      inputs.detail,
      inputs.detailRoughness,
      float(2),
      true,
    );

    n.addAssign(inputs.distortion.mul(noise.mul(2).sub(1)));
  }

  const profile = PROFILES[inputs.profile];

  if (!profile) throw new Error(`Wave profile ${inputs.profile} is not ported`);

  const result = profile(n).toVar();

  return { fac: result, color: vec4(result, result, result, 1) };
}

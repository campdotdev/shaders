// SPDX-License-Identifier: GPL-2.0-or-later
//
// Blender's Voronoi texture in its 3D Distance to Edge mode, ported to TSL
// from Blender 5.2.3's gpu_shader_material_*voronoi.glsl files. Every cell
// holds one point, placed by Blender's PCG hash, and the output is how far
// the sample sits from the nearest border between two cells.
import { dot, float, floor, If, int, ivec3, Loop, min, mix, normalize, vec3 } from 'three/tsl';

import { gpuFunction, type TSLNode } from './gpu-function';
import { hashInt3ToVec3 } from './hash';

// FLT_MAX, the starting distance for a running minimum.
const FLT_MAX = 3.402823466e38;

// Runs body for every cell offset in the 3x3x3 block around the sample's
// cell, k outermost, as Blender's nested loops do. Loop, not a JS-unrolled
// chain: a running minimum built from select() hangs three's type
// resolution (the running-minimum gotcha in docs/agents/tsl.md).
function forEachNeighbor(body: (offset: TSLNode) => void) {
  Loop({ start: int(-1), end: int(1), condition: '<=', name: 'k' }, ({ k }: { k: TSLNode }) => {
    Loop({ start: int(-1), end: int(1), condition: '<=', name: 'j' }, ({ j }: { j: TSLNode }) => {
      Loop({ start: int(-1), end: int(1), condition: '<=', name: 'i' }, ({ i }: { i: TSLNode }) => {
        body(ivec3(i, j, k));
      });
    });
  });
}

// ----------------------------------------------------------------------------
// One octave: distance to the nearest edge
// ----------------------------------------------------------------------------

const distanceToEdge3 = gpuFunction(
  'blenderVoronoiDistanceToEdge3',
  'float',
  [
    ['coord', 'vec3'],
    ['randomness', 'float'],
  ],
  ([coord, randomness]) => {
    const cellFloat = floor(coord).toVar();
    const local = coord.sub(cellFloat).toVar();
    const cell = ivec3(cellFloat).toVar();
    // The vector from the sample to a neighbor cell's point: the cell offset,
    // plus the point's hashed position in its cell (pulled toward the cell
    // corner as randomness drops), minus the sample's own position.
    const toPoint = (offset: TSLNode) =>
      vec3(offset)
        .add(hashInt3ToVec3(cell.add(offset)).mul(randomness))
        .sub(local);

    // Pass 1: the nearest point.
    const toClosest = vec3(0).toVar();
    const minDistance = float(FLT_MAX).toVar();

    forEachNeighbor((offset) => {
      const vectorToPoint = toPoint(offset).toVar();
      const distanceToPoint = dot(vectorToPoint, vectorToPoint).toVar();

      If(distanceToPoint.lessThan(minDistance), () => {
        minDistance.assign(distanceToPoint);
        toClosest.assign(vectorToPoint);
      });
    });

    // Pass 2: the border between the nearest point and each other point is
    // their perpendicular bisector. The sample sits at the origin here, so
    // its distance to that plane is the midpoint projected on the normal.
    minDistance.assign(FLT_MAX);
    forEachNeighbor((offset) => {
      const vectorToPoint = toPoint(offset).toVar();
      const perpendicular = vectorToPoint.sub(toClosest).toVar();

      // Skip the nearest point itself, whose offset from itself is zero.
      If(dot(perpendicular, perpendicular).greaterThan(0.0001), () => {
        const distanceToEdge = dot(toClosest.add(vectorToPoint).div(2), normalize(perpendicular));

        minDistance.assign(min(minDistance, distanceToEdge));
      });
    });

    return minDistance;
  },
);

// ----------------------------------------------------------------------------
// The Voronoi Texture node, Distance to Edge, 3D
// ----------------------------------------------------------------------------

export interface VoronoiEdge3DInputs {
  vector: TSLNode;
  scale: TSLNode;
  detail: number;
  roughness: TSLNode;
  lacunarity: TSLNode;
  randomness: TSLNode;
  // True when roughness is a constant 0, which Blender treats like detail 0.
  roughnessIsZero: boolean;
  normalize: boolean;
}

/** Blender's node_tex_voronoi_distance_to_edge_3d. Returns Distance. */
export function voronoiDistanceToEdge3D(inputs: VoronoiEdge3DInputs): TSLNode {
  const detail = Math.min(Math.max(inputs.detail, 0), 15);
  const roughness = inputs.roughness.clamp(0, 1).toVar();
  const randomness = inputs.randomness.clamp(0, 1).toVar();
  const maxDistance = float(0.5).add(randomness.mul(0.5)).toVar();
  const coord = inputs.vector.mul(inputs.scale).toVar();

  // Detail 0 or roughness 0 is a single octave, unnormalized by octaves.
  if (detail === 0 || inputs.roughnessIsZero) {
    const distance = distanceToEdge3(coord, randomness);

    return inputs.normalize ? distance.div(maxDistance) : distance;
  }

  // Fractal Voronoi: each octave at `lacunarity` times the frequency keeps
  // the nearer edge, blended in by the octave's amplitude.
  const amplitude = float(1).toVar();
  const maxAmplitude = maxDistance.toVar();
  const scale = float(1).toVar();
  const distance = float(8).toVar();

  Loop({ start: 0, end: Math.floor(detail), condition: '<=' }, () => {
    const octave = distanceToEdge3(coord.mul(scale), randomness);

    maxAmplitude.assign(mix(maxAmplitude, maxDistance.div(scale), amplitude));
    distance.assign(mix(distance, min(distance, octave.div(scale)), amplitude));
    scale.mulAssign(inputs.lacunarity);
    amplitude.mulAssign(roughness);
  });

  const remainder = detail - Math.floor(detail);

  if (remainder !== 0) {
    const octave = distanceToEdge3(coord.mul(scale), randomness);
    const lerpAmplitude = mix(maxAmplitude, maxDistance.div(scale), amplitude);
    const lerpDistance = mix(distance, min(distance, octave.div(scale)), amplitude);

    maxAmplitude.assign(mix(maxAmplitude, lerpAmplitude, remainder));
    distance.assign(mix(distance, min(distance, lerpDistance), remainder));
  }

  return inputs.normalize ? distance.div(maxAmplitude) : distance;
}

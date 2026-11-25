// Reads each vertex's place on its strand, as TSL nodes: the four vertex
// attributes that createStrandGeometry writes. extrudeStrand calls this to
// place the vertex, and a shader can call it too, for example to color each
// strand by its seed.
import { attribute, type ShaderNodeObject } from 'three/tsl';
import type { Node } from 'three/webgpu';

import { STRAND_ACROSS, STRAND_ALONG, STRAND_SEED, STRAND_SIDE } from './create-strand-geometry.js';

type TSLValue = ShaderNodeObject<Node>;

export interface StrandAttributes {
  /** The strand's place among the others, a float from 0 at the first strand to 1 at the last. */
  across: TSLValue;
  /** A random float from 0 to 1, the same for every vertex of a strand. */
  seed: TSLValue;
  /** How far along the strand the vertex is, a float from 0 to 1. */
  along: TSLValue;
  /** Which edge of the strip the vertex is on, a float: -1 or 1. */
  side: TSLValue;
}

/**
 * The four strand attributes as float nodes. In a color node, the GPU blends
 * each one between the triangle's three vertices, so `along` runs smoothly
 * down the strand and `side` runs from -1 to 1 across it.
 */
export function strandAttributes(): StrandAttributes {
  return {
    across: attribute(STRAND_ACROSS, 'float'),
    seed: attribute(STRAND_SEED, 'float'),
    along: attribute(STRAND_ALONG, 'float'),
    side: attribute(STRAND_SIDE, 'float'),
  };
}

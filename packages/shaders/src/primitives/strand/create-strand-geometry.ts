// Builds the mesh that strands are drawn with: one long strip of triangles
// per strand. The mesh holds no positions. Each vertex only records where it
// sits on its strand, and a vertex shader built with extrudeStrand turns
// that into a place on screen. strandAttributes reads the records back as
// TSL nodes. ADR 0008 says why a primitive can be geometry.
import { BufferAttribute, BufferGeometry, Sphere, Vector3 } from 'three/webgpu';

export interface StrandGeometryOptions {
  /** How many strands the mesh holds, a whole number above 0. */
  strands: number;
  /**
   * How many points along each strand the mesh holds, a whole number above
   * 1. The strand is drawn as straight segments between them, so more
   * samples follow a tight curve more smoothly and cost more vertices.
   */
  samples: number;
}

// The four vertex attributes. A vertex attribute is a number stored on every
// vertex of a mesh, which the vertex shader reads when it places that vertex.
export const STRAND_ACROSS = 'strandAcross';
export const STRAND_SEED = 'strandSeed';
export const STRAND_ALONG = 'strandAlong';
export const STRAND_SIDE = 'strandSide';

/**
 * A random-looking number from 0 up to, but not including, 1 for a strand,
 * the same on every call. The multiply-and-shift steps scramble the strand's
 * number so that neighboring strands get unrelated seeds (the "lowbias32"
 * integer hash). Math.imul multiplies as a 32-bit integer, and `>>> 0` reads
 * the result as unsigned before the divide by 2^32.
 */
function strandSeed(strand: number): number {
  let hash = strand + 1;

  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x7feb352d);
  hash ^= hash >>> 15;
  hash = Math.imul(hash, 0x846ca68b);
  hash ^= hash >>> 16;

  return (hash >>> 0) / 4294967296;
}

/** Throws unless `value` is a whole number of at least `minimum`. */
function requireWholeNumber(name: string, value: number, minimum: number): void {
  if (!Number.isInteger(value) || value < minimum) {
    throw new RangeError(
      `createStrandGeometry: ${name} must be a whole number above ${minimum - 1}, got ${value}`,
    );
  }
}

/**
 * Allocate a mesh of strips, one per strand. Each sample along a strand is a
 * pair of vertices, one for each edge of the strip, and each pair is joined
 * to the next by two triangles. Every vertex carries four floats:
 *
 * - `strandAcross`: the strand's place among the others, from 0 at the first
 *   strand to 1 at the last. A lone strand sits at 0.5.
 * - `strandSeed`: a random number from 0 to 1, the same for every vertex of
 *   a strand and the same on every call.
 * - `strandAlong`: how far along the strand the vertex is, from 0 to 1.
 * - `strandSide`: -1 on one edge of the strip and 1 on the other.
 *
 * Dispose the geometry when you are done with it, as with any three
 * geometry.
 */
export function createStrandGeometry(options: StrandGeometryOptions): BufferGeometry {
  const { strands, samples } = options;

  requireWholeNumber('strands', strands, 1);
  requireWholeNumber('samples', samples, 2);

  const vertexCount = strands * samples * 2;
  const across = new Float32Array(vertexCount);
  const seed = new Float32Array(vertexCount);
  const along = new Float32Array(vertexCount);
  const side = new Float32Array(vertexCount);
  const index: number[] = [];

  // ---------------------------------------------
  // Fill the vertices, strand by strand
  // ---------------------------------------------
  for (let strand = 0; strand < strands; strand += 1) {
    const strandAcross = strands === 1 ? 0.5 : strand / (strands - 1);
    const seedOfStrand = strandSeed(strand);

    for (let sample = 0; sample < samples; sample += 1) {
      // The two vertices of this sample: `vertex` on the -1 edge and
      // `vertex + 1` on the +1 edge.
      const vertex = (strand * samples + sample) * 2;

      across.fill(strandAcross, vertex, vertex + 2);
      seed.fill(seedOfStrand, vertex, vertex + 2);
      along.fill(sample / (samples - 1), vertex, vertex + 2);
      side[vertex] = -1;
      side[vertex + 1] = 1;

      // Join this sample's pair to the next one's with two triangles. The
      // last sample of a strand has no next pair, so strands stay separate.
      // The corner order matters: three draws only triangles whose corners
      // run counter-clockwise on screen, and skips the rest as facing away.
      // extrudeStrand always puts the +1 edge a quarter turn
      // counter-clockwise from the strand's direction, so this order faces
      // the viewer whichever way the strand runs.
      if (sample < samples - 1) {
        index.push(vertex, vertex + 2, vertex + 1, vertex + 2, vertex + 3, vertex + 1);
      }
    }
  }

  const geometry = new BufferGeometry();

  geometry.setAttribute(STRAND_ACROSS, new BufferAttribute(across, 1));
  geometry.setAttribute(STRAND_SEED, new BufferAttribute(seed, 1));
  geometry.setAttribute(STRAND_ALONG, new BufferAttribute(along, 1));
  geometry.setAttribute(STRAND_SIDE, new BufferAttribute(side, 1));
  // setIndex picks 16-bit or 32-bit indices from the largest value.
  geometry.setIndex(index);

  // three skips a mesh whose bounding sphere lies outside the camera's view,
  // and works that sphere out from a position attribute. This mesh has none,
  // and the shader decides where every vertex goes, so three cannot know
  // where the strands are. An endless sphere is always in view.
  geometry.boundingSphere = new Sphere(new Vector3(), Number.POSITIVE_INFINITY);

  return geometry;
}

// Two-pass cell Voronoi: the engine-side algorithm behind the <Voronoi>
// registry component. Where the sibling `voronoi` (Worley) primitive answers
// "how far is the nearest seed", this one answers "which cell am I in, where
// is its seed, and how far is the nearest border" — the three fields a cell
// mosaic needs for per-cell color, glow, and constant-width border lines.
import type { ShaderNodeObject } from 'three/tsl';
import {
  add,
  float,
  floor,
  Fn,
  fract,
  hash,
  If,
  int,
  Loop,
  min,
  mul,
  normalize,
  sin,
  sub,
  vec2,
  vec4,
} from 'three/tsl';
import type { Node } from 'three/webgpu';

import type { TSLNode } from '../color-ramp/color-ramp.js';

type TSLScalar = TSLNode | number;

// three's Loop callback receives its iterator variables untyped; this names
// the shape once for both nested loops.
type LoopVars = Record<string, ShaderNodeObject<Node>>;

export interface VoronoiCellsOptions {
  /**
   * Pre-integrated animation phase (speed × elapsed time, summed CPU-side).
   * Default 0 (static).
   */
  time?: TSLScalar;
  /**
   * 0..1 seed scatter: 0 pins every seed to its cell center (a perfect
   * square grid), 1 lets seeds sit anywhere in their cell. Default 1.
   */
  jitter?: TSLScalar;
  /**
   * 0..1 orbit radius, as a fraction of a half-cell: 0 is no motion, 1
   * swings every seed through the full room its cell offers. Anchors
   * scatter only within the room the orbit leaves free, so seeds provably
   * never leave their cell and the 3x3 neighbor search stays valid at any
   * drift. Default 0.
   */
  drift?: TSLScalar;
}

export interface VoronoiCellsResult {
  /**
   * Distance from this pixel to the nearest border between two cells, in
   * pattern units — 0 exactly on a border, growing toward cell interiors.
   */
  edgeDistance: ShaderNodeObject<Node>;
  /** Vector from this pixel to its own cell's seed point. */
  seedOffset: ShaderNodeObject<Node>;
  /** Stable per-cell random in [0, 1) — same value for every pixel in a cell. */
  hash: ShaderNodeObject<Node>;
}

// Shifts cell coordinates positive before hashing: three's hash() converts
// its input to u32, and u32(negative float) is backend-defined. 512 covers
// scales up to ~500 cells plus the seed offset window.
const HASH_DOMAIN_OFFSET = 512;

const TWO_PI = Math.PI * 2;

/**
 * Two-pass cell Voronoi (Inigo Quilez, Shadertoy ldl3W8). The plane is cut
 * into cells around jittered seed points — every pixel belongs to the seed
 * it sits closest to. Pass 1 finds that seed; pass 2 measures the exact
 * perpendicular distance to the bisector between it and each neighboring
 * seed. That bisector distance is what makes constant-width, non-bulging
 * borders possible — the naive "second-closest minus closest" shortcut
 * bulges near cell corners.
 *
 * Written with TSL's Fn/Loop/If so the GPU runs real loops. Do NOT unroll
 * this into JS-built select() chains: a running minimum references its
 * accumulator twice per step (comparison + else-branch), and three's
 * getNodeType recursion has no cross-reference memoization, so a 34-step
 * chain hangs the tab in exponential type resolution before the shader
 * ever compiles. (fbm's unrolled JS loop survives because an additive
 * chain references its accumulator once per step.)
 *
 * Known artifact inherited from the algorithm: hairline notches can appear
 * at some cell corners. The reference implementation documents it too; it
 * is not a bug worth chasing.
 *
 * @param p — Vec2 TSL node in pattern space, typically `uv() * scale`.
 */

export function voronoiCells(p: TSLNode, options: VoronoiCellsOptions = {}): VoronoiCellsResult {
  const time = options.time ?? 0;
  const jitter = options.jitter ?? 1;
  const drift = options.drift ?? 0;

  // Per-cell random streams, derived by NESTING hashes (grain's pattern) so
  // no linear seed axis leaks through as diagonal correlation across the
  // field. One stream colors the cell, two anchor its seed, two phase its
  // orbit.
  const cellRandom = (cell: ShaderNodeObject<Node>) => {
    const shifted = add(cell, HASH_DOMAIN_OFFSET);
    const rowHash = hash(shifted.y).mul(0xffffff).toUint();
    const cellHash = hash(shifted.x.toUint().add(rowHash));
    const streamSeed = cellHash.mul(0xffffff).toUint();
    const homeOffset = vec2(hash(streamSeed), hash(streamSeed.add(1)));
    const orbitPhase = vec2(hash(streamSeed.add(2)), hash(streamSeed.add(3)));

    return { cellHash, homeOffset, orbitPhase };
  };

  // Where a cell's seed sits right now, in that cell's 0..1 local space —
  // the sine-orbit ensemble from Hayashi's stained-glass voronoi
  // (shadertoy XdSyzK, itself on iq's ldl3W8): every seed glides through an
  // ellipse around its anchor at ONE shared frequency, desynchronized only
  // by per-cell random phases. A sine orbit's velocity is continuous, so
  // nothing ever stalls (value-noise retargeting was tried here and read
  // as hesitant); the shared frequency makes the whole field churn
  // coherently, and the churn is what hides the formula's periodicity —
  // the eye gets no fixed landmark to notice the ~2π repeat.
  //
  // The orbit radius is uniform (drift × half-cell) and anchors scatter by
  // jitter only within the room the orbit leaves free: anchor ± amplitude
  // stays inside [0, 1] by construction, so seeds never leave their cell
  // and the 3x3 neighbor search stays valid at any drift. At full drift
  // anchors converge to the cell center — exactly the reference's shape —
  // and at drift 0 jitter spans the whole cell as pure static scatter.
  const seedInCell = (cell: ShaderNodeObject<Node>) => {
    const { cellHash, homeOffset, orbitPhase } = cellRandom(cell);
    const amplitude = mul(float(drift), 0.5);
    const anchorRoom = sub(0.5, amplitude);
    const anchor = add(0.5, mul(sub(homeOffset, 0.5).mul(2), mul(anchorRoom, jitter)));
    const orbit = sin(add(float(time), mul(orbitPhase, TWO_PI)));
    const seedPos = add(anchor, mul(orbit, amplitude)).toVar();

    return { cellHash, seedPos };
  };

  // Fn provides the statement context (a "stack") that Loop/If/assign
  // append to — TSL's imperative side, as opposed to the pure expression
  // graphs the other primitives build. The whole computation packs into one
  // vec4 (edge distance, offset.xy, hash) and is unpacked below.
  const compute = Fn(() => {
    // Split the sample point into "which cell" (integer corner) and "where
    // in that cell" (0..1 fractional position).
    const cellCoord = floor(p).toVar();
    const localPos = fract(p).toVar();

    // ---------------------------------------------
    // Pass 1: nearest seed over the 3x3 neighborhood
    // ---------------------------------------------
    const closestDist = float(8).toVar();
    const closestOffset = vec2(0, 0).toVar();
    const closestCell = vec2(0, 0).toVar();
    const closestHash = float(0).toVar();

    Loop({ start: -1, end: int(1), name: 'j', condition: '<=' }, ({ j }: LoopVars) => {
      Loop({ start: -1, end: int(1), name: 'i', condition: '<=' }, ({ i }: LoopVars) => {
        const neighbor = vec2(float(i), float(j)).toVar();
        const { cellHash, seedPos } = seedInCell(add(cellCoord, neighbor));
        // Seed position relative to this pixel: neighbor cell corner + the
        // seed's in-cell position − the pixel's own in-cell position.
        const toSeed = add(neighbor, seedPos).sub(localPos).toVar();
        const dist = toSeed.dot(toSeed).toVar();

        If(dist.lessThan(closestDist), () => {
          closestDist.assign(dist);
          closestOffset.assign(toSeed);
          closestCell.assign(neighbor);
          closestHash.assign(cellHash);
        });
      });
    });

    // ---------------------------------------------
    // Pass 2: exact border distance over 5x5
    // ---------------------------------------------
    // The border between the winning seed and any neighbor is the
    // perpendicular bisector of the segment joining them. In pixel-relative
    // coordinates the pixel sits at the origin, so its distance to that
    // line is dot(midpoint, direction): midpoint = (closestOffset + toSeed)
    // / 2, direction = normalize(toSeed − closestOffset). The guard skips
    // the winning seed itself (zero vector → normalize would blow up).
    const edgeDistance = float(8).toVar();

    Loop({ start: -2, end: int(2), name: 'j', condition: '<=' }, ({ j }: LoopVars) => {
      Loop({ start: -2, end: int(2), name: 'i', condition: '<=' }, ({ i }: LoopVars) => {
        const neighbor = add(closestCell, vec2(float(i), float(j))).toVar();
        const { seedPos } = seedInCell(add(cellCoord, neighbor));
        const toSeed = add(neighbor, seedPos).sub(localPos).toVar();
        const between = sub(toSeed, closestOffset).toVar();

        If(between.dot(between).greaterThan(1e-5), () => {
          const bisectorDist = add(closestOffset, toSeed).mul(0.5).dot(normalize(between));

          edgeDistance.assign(min(edgeDistance, bisectorDist));
        });
      });
    });

    return vec4(edgeDistance, closestOffset, closestHash);
  });

  const cells = compute();

  return { edgeDistance: cells.x, seedOffset: cells.yz, hash: cells.w };
}

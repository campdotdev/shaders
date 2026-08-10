// Two-pass cell Voronoi: the engine-side algorithm behind the <Voronoi>
// registry component. Where the sibling `voronoi` (Worley) primitive answers
// "how far is the nearest seed", this one answers "which cell am I in, where
// is its seed, and how far is the nearest border" — the three fields a cell
// mosaic needs for per-cell color, glow, and constant-width border lines.
import type { ShaderNodeObject } from 'three/tsl';
import {
  abs,
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
  mix,
  mul,
  normalize,
  sub,
  vec2,
  vec3,
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
   * 0..1 fraction of each seed's in-cell headroom the wobble may use: 0 is
   * no motion, 1 sweeps every seed through all the room its cell offers
   * (seeds provably never leave their cell, so the 3x3 neighbor search
   * stays valid at any drift). Default 0.
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

// Shifts the wander timeline positive before its uint conversion (phase can
// dip below zero briefly under signal-driven speeds).
const TIME_DOMAIN_OFFSET = 1024;

// Spreads consecutive timeline steps across the hash space (Knuth's
// multiplicative constant) so step k and k+1 land on unrelated randoms.
const TIME_STEP_STRIDE = 2654435761;

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
  // field. One stream colors the cell, two place its seed, one sets its
  // wander tempo; the wander itself draws fresh streams per timeline step.
  const cellRandom = (cell: ShaderNodeObject<Node>) => {
    const shifted = add(cell, HASH_DOMAIN_OFFSET);
    const rowHash = hash(shifted.y).mul(0xffffff).toUint();
    const cellHash = hash(shifted.x.toUint().add(rowHash));
    const streamSeed = cellHash.mul(0xffffff).toUint();
    const homeOffset = vec2(hash(streamSeed), hash(streamSeed.add(1)));
    // 0.7..1.3: every cell wanders at its own rate, so the field never
    // moves in unison.
    const tempo = hash(streamSeed.add(2)).mul(0.6).add(0.7);

    return { cellHash, streamSeed, homeOffset, tempo };
  };

  // Smooth aperiodic wander in [-1, 1]: 1D value noise over time. The
  // timeline is cut into unit steps; each step hashes to a random target
  // and the fractional position eases between neighbors (f*f*(3-2f), the
  // smoothstep kernel — C1-continuous, so velocity never jumps). Every
  // step draws a fresh hash stream, so the trajectory never cycles back —
  // this is what replaces sine orbits, which always retrace their path.
  //
  // Deliberately NOT gradient/perlin noise: an earlier build sampled
  // mx_noise 68 times inside these loops and the WebGL backend's shader
  // compile took two minutes under software GL (CI's stack) — headless
  // Chromium reads as hung. Integer-hash value noise compiles in
  // milliseconds and feels the same at this amplitude.
  const wander1D = (
    streamSeed: ShaderNodeObject<Node>,
    axisOffset: number,
    timeline: ShaderNodeObject<Node>,
  ) => {
    const step = floor(timeline);
    const eased = fract(timeline)
      .mul(fract(timeline))
      .mul(sub(3, fract(timeline).mul(2)));
    const stepSeed = step.toUint().mul(TIME_STEP_STRIDE);
    const target0 = hash(streamSeed.add(axisOffset).add(stepSeed));
    const target1 = hash(streamSeed.add(axisOffset).add(stepSeed.add(TIME_STEP_STRIDE)));

    return mix(target0, target1, eased).mul(2).sub(1);
  };

  // Where a cell's seed sits right now, in that cell's 0..1 local space.
  // Home: the center pushed toward a hash-picked spot — jitter 0 collapses
  // to 0.5 (grid), jitter 1 spans the whole cell.
  //
  // Wobble: each axis runs two detuned octaves of the time-domain value
  // noise above (rates 1 : 2.7, amplitudes 0.7 + 0.3 = 1) on its own hash
  // streams. Two octaves at unrelated rates erase the per-step easing
  // cadence a single octave would show, and per-cell tempo keeps neighbors
  // from sharing a beat. Nothing here ever revisits a previous pose.
  //
  // The amplitude is the key to organic motion, learned from the Paper
  // Shaders reference: big seed travel makes cell WALLS slide and cells
  // reshape (even swap neighbors), which is what the eye reads as alive —
  // small orbits just jiggle a frozen structure. Scaling by headroom (the
  // per-axis room between home and the cell wall) lets drift 1 use all of
  // it while provably never letting a seed leave its cell, which is what
  // keeps the 3x3 neighbor search valid at any drift. Drift is
  // deliberately NOT scaled by jitter — irregularity and motion are
  // decoupled dials.
  const seedInCell = (cell: ShaderNodeObject<Node>) => {
    const { cellHash, streamSeed, homeOffset, tempo } = cellRandom(cell);
    const home = add(vec2(0.5, 0.5), mul(sub(homeOffset, 0.5), jitter));
    const headroom = sub(0.5, abs(sub(home, 0.5)));
    const timeline = add(mul(float(time), tempo), TIME_DOMAIN_OFFSET).toVar();
    const timelineFast = mul(timeline, 2.7).toVar();
    const axisWander = (axisOffset: number) =>
      wander1D(streamSeed, axisOffset, timeline)
        .mul(0.7)
        .add(wander1D(streamSeed, axisOffset + 7919, timelineFast).mul(0.3));
    const wander = vec2(axisWander(101), axisWander(211)).toVar();
    const wobble = mul(mul(wander, headroom), drift).toVar();

    return { cellHash, seedPos: add(home, wobble) };
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

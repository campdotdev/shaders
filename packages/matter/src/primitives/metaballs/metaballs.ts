// Metaball field: the engine-side algorithm behind the <Blobs> registry
// component. Up to MAX_BLOBS blob centers roam around the origin on
// hash-phased sine paths; each contributes a soft radial falloff bump, the
// bumps sum into one scalar field, and thresholding that sum (done by the
// consumer) is what fuses nearby blobs into gooey shapes — where two
// falloffs overlap, the sum crosses the threshold in the gap between them.
// Alongside the field it returns a field-weighted blend of per-blob random
// values, the consumer's color-ramp input.
import type { ShaderNodeObject } from 'three/tsl';
import {
  add,
  Break,
  ceil,
  clamp,
  float,
  Fn,
  fract,
  hash,
  If,
  int,
  length,
  Loop,
  max,
  mix,
  mul,
  pow,
  select,
  sin,
  sub,
  vec2,
} from 'three/tsl';
import type { Node } from 'three/webgpu';

import type { TSLNode } from '../color-ramp/color-ramp.js';

type TSLScalar = TSLNode | number;

// three's Loop callback receives its iterator variables untyped; this names
// the shape once.
type LoopVars = Record<string, ShaderNodeObject<Node>>;

export interface MetaballsOptions {
  /**
   * Number of blobs, 1 to MAX_BLOBS. Fractional values scale the last
   * blob's contribution by the fraction, so an animated count grows a blob
   * in smoothly instead of popping it. Out-of-range values clamp.
   * Default 8.
   */
  count?: TSLScalar;
  /**
   * 0..1 base blob size, mapped onto the falloff exponent (small size =
   * steep falloff = tight blob). Bigger blobs also merge sooner — their
   * falloffs overlap at greater distances. Out-of-range values clamp.
   * Default 0.5.
   */
  size?: TSLScalar;
  /**
   * 0..1 per-blob size variation: 0 renders every blob at `size`, 1 lets
   * each blob's own random scale it anywhere down to near-zero.
   * Out-of-range values clamp. Default 0.
   */
  sizeVariation?: TSLScalar;
  /**
   * 0..1 roam radius — how far blobs wander from the origin, as a fraction
   * of ROAM_EXTENT pattern units. Out-of-range values clamp. Default 0.5.
   */
  spread?: TSLScalar;
  /**
   * Pre-integrated animation phase (speed × elapsed time, summed CPU-side).
   * Default 0 (static).
   */
  time?: TSLScalar;
  /** Re-rolls every per-blob random stream (paths, sizes, blend values). Default 0. */
  seed?: TSLScalar;
}

export interface MetaballsResult {
  /**
   * Summed field strength — near 0 far from every blob, rising past 1 deep
   * inside overlaps. Threshold it (~0.4) for the goo silhouette; reuse it
   * as depth for shading.
   */
  field: ShaderNodeObject<Node>;
  /**
   * Field-weighted average of per-blob stable randoms in [0, 1) — a solid
   * value inside one blob, sliding between two blobs' values where they
   * merge. Feed it to a color ramp.
   */
  blend: ShaderNodeObject<Node>;
}

/** Hard cap on the GPU loop — `count` clamps to this. */
export const MAX_BLOBS = 20;

// Shifts the seed positive before hashing: three's hash() converts its
// input to u32, and u32(negative float) is backend-defined (same guard as
// voronoiCells).
const HASH_DOMAIN_OFFSET = 512;

const TWO_PI = Math.PI * 2;

// ---------------------------------------------
// Feel constants (tuned by eye at the build's visual gates)
// ---------------------------------------------
// Distance (pattern units) at which a blob's influence reaches zero. Up =
// fatter, softer bumps that merge from further away.
const FIELD_REACH = 2.65;
// Falloff exponent at size 0. Up = size 0 blobs get even tinier.
const EXPONENT_MAX = 45;
// How much of the exponent size 1 removes. Up = size dial covers a wider
// small-to-huge range.
const EXPONENT_SPAN = 40;
// Max roam distance from the origin at spread 1, in pattern units (the
// consumer's centered canvas is ~1 unit tall, so full spread lets blobs
// swing past the edges and back). Up = blobs range wider.
const ROAM_EXTENT = 0.8;
// Floor of the per-blob roam-radius variation: every blob roams at least
// this fraction of the full radius. Up = more uniform coverage.
const MIN_ROAM = 0.4;
// Amplitude share of the double-frequency swing riding on the base swing
// (the base gets 1 − this). Up = jitterier, less orbital paths.
const FAST_WEIGHT = 0.35;

/**
 * Summed metaball field over roaming blob centers.
 *
 * Written with TSL's Fn/Loop/If so the GPU runs a real loop with an early
 * Break at `count`. The accumulators are ADDITIVE — each step references
 * them exactly once — so this stays clear of the exponential getNodeType
 * recursion that bans select-chain argmins (see AGENTS.md's running-minimum
 * gotcha; fbm's additive chain is the safe precedent). In-loop randomness
 * comes only from the integer hash() — never a heavyweight noise primitive
 * (the 128-second-compile gotcha).
 *
 * @param p — Vec2 TSL node in centered pattern space (blobs roam around the
 *   origin); typically `(uv() − center) · aspect`.
 */
export function metaballs(p: TSLNode, options: MetaballsOptions = {}): MetaballsResult {
  // Out-of-range dials fold back into their documented ranges rather than
  // producing out-of-cap loop trips or negative falloff exponents.
  const count = clamp(float(options.count ?? 8), 1, MAX_BLOBS);
  const size = clamp(float(options.size ?? 0.5), 0, 1);
  const sizeVariation = clamp(float(options.sizeVariation ?? 0), 0, 1);
  const spread = clamp(float(options.spread ?? 0.5), 0, 1);
  const time = float(options.time ?? 0);
  const seed = float(options.seed ?? 0);

  // Root of every per-blob stream: hashing the seed first (rather than
  // adding it to the blob index) means consecutive seeds re-roll every
  // stream to unrelated values instead of shifting blobs one index over.
  const seedHash = hash(add(seed, HASH_DOMAIN_OFFSET)).mul(0xffffff).toUint();

  // Fn provides the statement context (a "stack") that Loop/If/assign
  // append to — TSL's imperative side. Both outputs pack into one vec2.
  const compute = Fn(() => {
    const fieldSum = float(0).toVar();
    const blendSum = float(0).toVar();

    Loop({ start: 0, end: int(MAX_BLOBS), name: 'i', condition: '<' }, ({ i }: LoopVars) => {
      // Blobs beyond ceil(count) don't exist this frame; a real GPU break,
      // so count stays a uniform without paying for 20 blobs at count 3.
      If(float(i).greaterThanEqual(ceil(count)), () => {
        Break();
      });

      // Per-blob random streams, derived by NESTING hashes (grain's
      // pattern) so no linear index axis leaks through as correlation
      // between neighboring blobs. One stream colors the blob, one sizes
      // it, two shape its path.
      const blobSeed = hash(float(i).toUint().add(seedHash)).mul(0xffffff).toUint();
      const colorHash = hash(blobSeed);
      const sizeHash = hash(blobSeed.add(1));
      const roamHash = vec2(hash(blobSeed.add(2)), hash(blobSeed.add(3)));
      const slowPhase = vec2(hash(blobSeed.add(4)), hash(blobSeed.add(5))).mul(TWO_PI);
      const fastPhase = vec2(hash(blobSeed.add(6)), hash(blobSeed.add(7))).mul(TWO_PI);

      // Where this blob is right now: per axis, a base-frequency sine plus
      // a double-frequency sine (an integer multiple, so the combined path
      // repeats seamlessly every 2π of `time`). Random phases desynchronize
      // the blobs; the shared frequencies keep the whole ensemble churning
      // coherently. sin() has continuous velocity, so nothing ever stalls.
      const slowSwing = sin(add(time, slowPhase));
      const fastSwing = sin(add(time.mul(2), fastPhase));
      const wander = add(slowSwing.mul(1 - FAST_WEIGHT), fastSwing.mul(FAST_WEIGHT));

      // Each blob roams its own fraction of the full radius (MIN_ROAM
      // floors it so no blob just sits at the origin). roamHash stretches
      // per-axis, so paths are ellipses, not circles.
      const roamRadius = roamHash
        .mul(1 - MIN_ROAM)
        .add(MIN_ROAM)
        .mul(mul(spread, ROAM_EXTENT));
      const blobPos = wander.mul(roamRadius).toVar();

      // The falloff bump: 1 at the blob's center, 0 once the pixel is
      // FIELD_REACH away, shaped by a pow() whose exponent the size dial
      // controls — high exponent hugs the center (tiny blob), low exponent
      // spreads wide (big blob that merges eagerly).
      const nearness = clamp(sub(1, length(sub(p, blobPos)).div(FIELD_REACH)), 0, 1);

      // The last blob (only when count is fractional) contributes only
      // fract(count) of its bump, so an animated count fades it through
      // the threshold instead of popping it.
      const partialFade = select(float(i).greaterThan(count.sub(1)), fract(count), float(1));

      const blobSize = size.mul(mix(float(1), sizeHash, sizeVariation));
      const exponent = sub(EXPONENT_MAX, blobSize.mul(EXPONENT_SPAN));
      const shape = pow(nearness, exponent).mul(partialFade).toVar();

      fieldSum.addAssign(shape);
      blendSum.addAssign(colorHash.mul(shape));
    });

    // Normalize the blend accumulator into a weighted average. The epsilon
    // guards far-from-everything pixels where the field is ~0 (they're
    // transparent anyway, but 0/0 would be NaN).
    const blend = blendSum.div(max(fieldSum, 1e-4));

    return vec2(fieldSum, blend);
  });

  const result = compute();

  return { field: result.x, blend: result.y };
}

// The flow SwirlGradient folds its bands along, and the backward trace
// through it. The flow is the curl of a gradient-noise field: the noise's
// slope turned 90 degrees, so colors slide along the noise's contour lines
// and never pile up. The flow pass draws it into a texture once a frame, and
// the shader (./shader.tsx) traces each pixel back through that texture to
// find where its color started. Lives beside the component, as stroke.ts
// does in cursor-ripple/, until a second component needs it.
import type { ShaderNodeObject } from 'three/tsl';
import {
  cos,
  float,
  floor,
  Fn,
  fract,
  Loop,
  sign,
  sin,
  texture,
  uint,
  uv,
  vec2,
  vec4,
} from 'three/tsl';
import { HalfFloatType, LinearFilter, type Node } from 'three/webgpu';

import { createTexturePass, stableHashUint, type TSLNode } from '../../engine.js';
import type { ShaderContextValue } from '../../react/context/shader-context.js';

// ---------------------------------------------
// Constants
// ---------------------------------------------

// The flow repeats every FLOW_PERIOD lattice cells on both axes, so one
// period drawn into a texture covers every point a trace can reach. A
// lattice cell is about one eddy, so at the scale slider's top, 8 eddies
// per canvas height, a 16:10 canvas spans about 13 cells and no repeat
// shows. Raising it pushes the repeat further out at the cost of texels.
// A power of two, so dividing a cell index by it stays exact in a float.
const FLOW_PERIOD = 16;

// Texels per period on each side. 512 over 16 cells gives 32 texels per
// eddy, and 16 per smaller eddy, which the texture's linear filter blends
// into a smooth flow. Fewer texels draw faster: 256 took 0.09 ms off the
// card's 0.36 at 2x, but the filter's straight runs between texels showed,
// and the crisp seams came out faceted instead of curved.
const FLOW_TEXELS = 512;

// The smaller eddies run at twice the broad flow's frequency, so each one is
// half the size of a broad eddy. 2 divides FLOW_PERIOD, so they repeat with
// the broad flow.
const SMALL_EDDY_FREQUENCY = 2;

// The way the flow slides when the tuning rig's slide is above 0: right and
// a little up, as a unit vector. TEMPORARY with the slide itself.
const SLIDE_DIRECTION = [0.8, 0.6] as const;

const TWO_PI = Math.PI * 2;

// ---------------------------------------------
// Gradient noise with its slope
// ---------------------------------------------

/**
 * The random arrow at one corner of the noise lattice, a unit vector at a
 * hashed angle that turns as `phase` grows. `rowWord` is the hash of the
 * corner's row, so the four corners of a cell share two row hashes instead
 * of hashing a row each.
 *
 * The turning is Perlin and Neyret's "flow noise": every arrow spins at its
 * own rate, so the hills and valleys of the noise swell, shrink, and trade
 * places, and the eddies around them form, merge, and dissolve where they
 * stand instead of sliding across the canvas. Each arrow spins between half
 * and one and a half radians per unit of phase, clockwise or
 * counterclockwise at random. A rate near 0 would leave patches of the flow
 * frozen while the rest moved, and arrows all spinning one way would cycle
 * the whole flow back to its start every turn.
 */
function cornerArrow(
  column: ShaderNodeObject<Node>,
  rowWord: ShaderNodeObject<Node>,
  phase: ShaderNodeObject<Node>,
) {
  // One 32-bit hash word per corner, split in two: the top 16 bits set the
  // starting angle and the bottom 16 the spin. Each half is a random whole
  // number 0..65535, which a float holds exactly on both backends, and
  // dividing by 65536 turns it into 0..1. One hash serves both because the
  // flow pass runs this for four corners, two noise layers, and every texel,
  // each frame the flow moves.
  const cornerWord = stableHashUint(column.toUint().add(rowWord));
  const startAngle = cornerWord
    .shiftRight(uint(16))
    .toFloat()
    .mul(TWO_PI / 65536);

  // A random -1..1, then pushed half a unit away from 0 on its own side:
  // -1.5..-0.5 spins one way, 0.5..1.5 the other.
  const signedSpin = cornerWord
    .bitAnd(uint(0xffff))
    .toFloat()
    .mul(2 / 65536)
    .sub(1);
  const spin = signedSpin.add(sign(signedSpin).mul(0.5));
  const angle = startAngle.add(phase.mul(spin));

  return vec2(cos(angle), sin(angle));
}

/**
 * A lattice index folded into 0..FLOW_PERIOD - 1, so the arrows, and with
 * them the whole flow, repeat every FLOW_PERIOD cells. Written out with
 * floor() rather than mod(), because WGSL's float remainder keeps the sign
 * of a negative index and GLSL's mod() does not. It also keeps the hash's
 * input positive, as stableHash needs.
 */
function wrapCell(index: ShaderNodeObject<Node>) {
  return index.sub(floor(index.div(FLOW_PERIOD)).mul(FLOW_PERIOD));
}

/**
 * 2D gradient noise (Perlin's kind) at `point`, together with its slope: how
 * fast the noise climbs along x and along y. The slope comes from the same
 * reads as the value, by the chain rule, so a caller that needs the slope
 * pays for one noise read, not three. After Inigo Quilez's "gradient noise
 * derivatives" (iquilezles.org/articles/gradientnoise).
 *
 * The value runs roughly -0.7..0.7, and the slope's length stays under about
 * 2 per lattice cell. Only `slope` feeds the flow, and the GPU compiler drops
 * `value` when nothing reads it.
 */
function gradientNoise(
  point: TSLNode,
  seedWord: ShaderNodeObject<Node>,
  phase: ShaderNodeObject<Node>,
) {
  // Split the point into its lattice cell (the integer corner below and to
  // its left) and its place inside that cell, 0..1 on each axis.
  const cell = floor(point);
  const local = fract(point);

  // The quintic fade 6t^5 - 15t^4 + 10t^3: an S-curve from 0 to 1 whose
  // first and second slopes are 0 at both ends, so neighboring cells meet
  // with no visible crease in the noise or in its slope. `fadeSlope` is its
  // derivative, 30t^2(t - 1)^2, which the slope below needs.
  const fade = local
    .mul(local)
    .mul(local)
    .mul(local.mul(local.mul(6).sub(15)).add(10));
  const fadeSlope = local
    .mul(local)
    .mul(30)
    .mul(local.mul(local.sub(2)).add(1));

  // One random arrow per corner. Nested hashing, row then column, as in
  // voronoi-cells.ts, keeps neighboring cells unrelated. The seed joins the
  // row hash, so each seed reshuffles every arrow.
  const lowerRow = stableHashUint(wrapCell(cell.y).toUint().add(seedWord));
  const upperRow = stableHashUint(wrapCell(cell.y.add(1)).toUint().add(seedWord));
  const leftColumn = wrapCell(cell.x);
  const rightColumn = wrapCell(cell.x.add(1));
  const arrowA = cornerArrow(leftColumn, lowerRow, phase); // corner (0, 0)
  const arrowB = cornerArrow(rightColumn, lowerRow, phase); // corner (1, 0)
  const arrowC = cornerArrow(leftColumn, upperRow, phase); // corner (0, 1)
  const arrowD = cornerArrow(rightColumn, upperRow, phase); // corner (1, 1)

  // Each corner's vote: how far the point sits along that corner's arrow.
  // The vote is 0 at the corner itself, so the noise is 0 on every lattice
  // point, and it rises or falls away from the corner as the arrow points.
  const voteA = arrowA.dot(local);
  const voteB = arrowB.dot(local.sub(vec2(1, 0)));
  const voteC = arrowC.dot(local.sub(vec2(0, 1)));
  const voteD = arrowD.dot(local.sub(vec2(1, 1)));

  // Blend the four votes across the cell with the fade as the weight, written
  // out as a bilinear blend: start at A, add the x and y steps, then the
  // cross term that bends the surface between the four corners.
  const cross = voteA.sub(voteB).sub(voteC).add(voteD);
  const value = voteA
    .add(fade.x.mul(voteB.sub(voteA)))
    .add(fade.y.mul(voteC.sub(voteA)))
    .add(fade.x.mul(fade.y).mul(cross));

  // The same blend, differentiated. Two parts: the arrows blended with the
  // same weights (how each vote changes as the point moves), plus the
  // fade's own slope times how much the votes differ across the cell (how
  // the weights change as the point moves).
  const arrowCross = arrowA.sub(arrowB).sub(arrowC).add(arrowD);
  const slope = arrowA
    .add(arrowB.sub(arrowA).mul(fade.x))
    .add(arrowC.sub(arrowA).mul(fade.y))
    .add(arrowCross.mul(fade.x.mul(fade.y)))
    .add(fadeSlope.mul(fade.yx.mul(cross).add(vec2(voteB, voteC)).sub(voteA)));

  return { value, slope };
}

// ---------------------------------------------
// The flow's velocity
// ---------------------------------------------

/** What shapes the flow, shared by the flow pass and the inline fallback. */
export interface FlowInputs {
  /** A whole number 0 or above that picks the flow's random layout. */
  seed: TSLNode;
  /**
   * The smaller eddies' strength: 0 leaves the broad flow alone, 0.5 swirls
   * them as hard as the broad eddies, and 1 twice as hard.
   */
  smallEddies: TSLNode;
  /**
   * How far the flow has moved: the speed prop summed over time. Each lattice
   * arrow turns by about this many radians, more or less by its own spin.
   */
  phase: TSLNode;
  /**
   * TEMPORARY (build-phase tuning only): how far the flow slides per unit
   * of phase, in lattice cells, on top of the arrows' spin. 0 leaves the
   * eddies morphing in place.
   */
  slide: TSLNode;
}

/**
 * The flow's velocity at `point`, in lattice cells per unit of trace time,
 * worked out from the noise. The velocity is the curl of the noise: its
 * slope turned 90 degrees, (slope.y, -slope.x). Turned that way, it runs
 * along the noise's contour lines instead of downhill, so it never gathers
 * into a sink or spreads from a source. Every patch of color keeps its area
 * as it moves: bands stretch into threads and fold rather than bunching
 * into knots.
 *
 * The flow is two layers of noise, broad eddies and smaller ones at twice
 * the frequency, and the curl of a sum is the sum of the curls.
 */
function flowVelocity(point: TSLNode, { seed, smallEddies, phase, slide }: FlowInputs) {
  const broadSeed = stableHashUint(float(seed));
  // A second, unrelated hash stream, so the smaller eddies don't line up
  // with the broad ones.
  const smallSeed = stableHashUint(broadSeed);
  const phaseNode = float(phase);

  // Reading the flow from a point behind this one, against SLIDE_DIRECTION,
  // shifts the whole flow forward along it by phase x slide lattice cells.
  // At a slide of 0 the point is untouched.
  const slideDistance = phaseNode.mul(slide);
  const readPoint = vec2(point).sub(
    vec2(slideDistance.mul(SLIDE_DIRECTION[0]), slideDistance.mul(SLIDE_DIRECTION[1])),
  );

  const broadSlope = gradientNoise(readPoint, broadSeed, phaseNode).slope;
  const smallSlope = gradientNoise(readPoint.mul(SMALL_EDDY_FREQUENCY), smallSeed, phaseNode).slope;

  // The small layer's slope weight. Read at twice the frequency, its slope
  // comes out twice as steep by the chain rule, so at a strength of 0.5 the
  // small eddies swirl as hard as the broad ones. The strength scales the
  // layer's height, as an fBm octave's gain does.
  const slope = broadSlope.add(smallSlope.mul(float(smallEddies).mul(SMALL_EDDY_FREQUENCY)));

  // Curl: the slope turned 90 degrees clockwise.
  return vec2(slope.y, slope.x.negate());
}

/** Reads the flow's velocity at a point, in lattice cells. */
export type VelocityAt = (point: ShaderNodeObject<Node>) => ShaderNodeObject<Node>;

/**
 * The inline fallback: a VelocityAt that works the velocity out from the
 * noise at every read, two noise reads per step. For renderers the flow
 * pass can't draw on.
 */
export function inlineVelocity(inputs: FlowInputs): VelocityAt {
  return (point) => flowVelocity(point, inputs);
}

// ---------------------------------------------
// The flow pass
// ---------------------------------------------

/** The flow pass's handle: how to read the flow, and how to release it. */
export interface FlowPass {
  velocityAt: VelocityAt;
  dispose: () => void;
}

/**
 * Draws one period of the flow's velocity into a texture, so each trace step
 * reads one texel (one pixel of a texture) instead of working out two noise
 * layers. The velocity depends on the point the trace reaches and on the
 * uniforms, never on the pixel, so every pixel's steps read the same field
 * (the texture-pass case in docs/agents/tsl.md). Returns null where the
 * renderer can't draw into a half-float target, and the trace works the
 * velocity out inline.
 *
 * The texture holds FLOW_TEXELS + 1 texels a side. Texel i sits at lattice
 * point i x FLOW_PERIOD / FLOW_TEXELS, so the last row and column land on
 * the period's far edge and, since the flow repeats, repeat the first. A
 * read anywhere in the period falls between two drawn texels and never on
 * the texture's edge, so the linear filter blends across the period's seam
 * as smoothly as anywhere else.
 *
 * The caller creates and disposes the pass in one effect, so a Strict Mode
 * remount builds a fresh one (the Strict Mode gotcha in docs/agents/tsl.md).
 */
export function createFlowPass(
  shaderContext: ShaderContextValue,
  inputs: FlowInputs,
): FlowPass | null {
  const side = FLOW_TEXELS + 1;

  // One texel's value: the velocity at the lattice point under it. uv() is
  // the texel center's 0..1 position, (i + 0.5) / side, so undoing that
  // gives back i, and i x FLOW_PERIOD / FLOW_TEXELS is the lattice point.
  const velocityNode = Fn(() => {
    const point = uv()
      .mul(side)
      .sub(0.5)
      .mul(FLOW_PERIOD / FLOW_TEXELS);

    return vec4(flowVelocity(point, inputs), 0, 1);
  })();

  // A half float holds the velocity to about three significant digits, far
  // finer than a step can show. Half floats are filterable on every backend
  // that draws them, so the linear filter blends the four texels around
  // each read.
  const pass = createTexturePass(shaderContext.renderer.three, velocityNode, {
    width: side,
    height: side,
    type: HalfFloatType,
    filter: LinearFilter,
  });
  const velocityTexture = pass.texture;

  if (velocityTexture === null) return null;

  // The output stage draws pre-passes ahead of the scene pass in the same
  // frame, so the trace always reads this frame's flow (the draw-order
  // gotcha in docs/agents/tsl.md).
  const removePrePass = shaderContext.registerPrePass(pass.render);

  return {
    // Fold the point into the period, then into the texture: f x FLOW_TEXELS
    // is the texel index, and + 0.5 over the side is its center in 0..1.
    // The coordinate goes in when the texture node is built, not chained on
    // with .uv(), so three skips the texture matrix on every step (the
    // texture-matrix gotcha in docs/agents/tsl.md).
    velocityAt: (point) => {
      const periodFraction = fract(point.mul(1 / FLOW_PERIOD));
      const coordinate = periodFraction.mul(FLOW_TEXELS).add(0.5).div(side);

      return texture(velocityTexture, coordinate).xy;
    },
    dispose() {
      removePrePass();
      pass.dispose();
    },
  };
}

// ---------------------------------------------
// The backward trace
// ---------------------------------------------

/** The options for one backward trace through the flow. */
export interface TraceFlowOptions {
  /**
   * How many steps the trace takes. A plain number, because it is the loop's
   * bound and the loop is compiled into the shader.
   */
  steps: number;
  /**
   * How far each step travels where the flow runs at unit speed, in lattice
   * cells. 0 holds the trace in place.
   */
  stepLength: TSLNode;
  /** Where the trace reads the flow's velocity: the flow pass, or inline. */
  velocityAt: VelocityAt;
}

/**
 * Trace a point backward along the flow and return how far it moved, in
 * lattice cells. The pixel at `start` shows whatever color sat at
 * `start + offset` before the flow carried it here. Each step reads the
 * velocity where the trace has reached and steps against it.
 *
 * Written with Fn and Loop, so the GPU runs a real loop instead of `steps`
 * copies of the body.
 */
export function traceFlow(
  start: TSLNode,
  { steps, stepLength, velocityAt }: TraceFlowOptions,
): ShaderNodeObject<Node> {
  return Fn(() => {
    // Pin what is the same on every step before the loop. Without .toVar(),
    // TSL writes each expression where the shader first uses it, which is
    // inside the loop, so every step would redo it (the first-use gotcha in
    // docs/agents/tsl.md).
    const origin = vec2(start).toVar();
    const step = float(stepLength).toVar();

    // The loop's running state: how far the trace has moved from `origin`.
    // Starting at 0 means a step length of 0 returns exactly 0, so straight
    // bands stay exactly straight.
    const offset = vec2(0, 0).toVar();

    Loop(steps, () => {
      // Backward: step against the velocity, toward where the color came from.
      offset.subAssign(velocityAt(origin.add(offset)).mul(step));
    });

    return offset;
  })();
}

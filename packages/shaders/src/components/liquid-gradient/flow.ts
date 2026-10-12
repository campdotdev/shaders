// The flow LiquidGradient carries its colors along, and the backward trace
// through it. The flow is the curl of a gradient-noise field: the noise's
// slope turned 90 degrees, so colors slide along the noise's contour lines
// and never pile up. The flow pass draws it into a texture whenever it
// moves, and the shader (./shader.tsx) traces each pixel back through that
// texture, averaging the colors it passes. Lives beside the component, as stroke.ts
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
  type uniform,
  uv,
  vec2,
  vec3,
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
// lattice cell is about one eddy, so at the scale slider's top, 4 eddies
// per canvas height, a 16:10 canvas spans about 6.4 cells and no repeat
// shows. Doubling it pushes the repeat out past scale 8, but the flow pass
// draws four times the texels whenever the flow moves: a period of 16 read
// 0.45 ms in the Reactive card's window at 2x, against 0.35 ms for 8. A
// power of two, so dividing a cell index by it stays exact in a float.
export const FLOW_PERIOD = 8;

// Texels (pixels of a texture) per period on each side. 256 over 8 cells
// gives 32 texels per eddy, and 16 per smaller eddy, which the texture's
// linear filter blends into a smooth flow. Half that density drew faster but
// showed the filter's straight runs between texels: hard color edges came
// out faceted instead of curved.
const FLOW_TEXELS = 256;

// The smaller eddies run at twice the broad flow's frequency, so each one is
// half the size of a broad eddy. 2 divides FLOW_PERIOD, so they repeat with
// the broad flow.
const SMALL_EDDY_FREQUENCY = 2;

// The smaller eddies' strength. 0 would leave the broad currents alone, and
// at 0.5 the smaller eddies swirl as hard as the broad ones. Higher curls
// more fine billowing into the broad currents.
const SMALL_EDDY_STRENGTH = 0.45;

// How far the flow slides per unit of phase, in lattice cells, on top of
// the eddies morphing in place. With the phase at speed x seconds, the
// default speed of 0.15 carries the currents across a canvas height in
// about ten seconds. 0 would leave the eddies morphing where they stand.
const SLIDE_RATE = 1;

// The way the flow slides: right and a little up, as a unit vector.
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
 * A lattice index folded into 0..period - 1, so whatever it hashes repeats
 * every `period` cells. Written out with floor() rather than mod(), because
 * WGSL's float remainder keeps the sign of a negative index and GLSL's
 * mod() does not. It also keeps the hash's input positive, as stableHash
 * needs. The period is a whole number, and a power of two keeps the divide
 * exact in a float.
 */
export function wrapIndex(index: ShaderNodeObject<Node>, period: number) {
  return index.sub(floor(index.div(period)).mul(period));
}

/** A flow lattice index folded into 0..FLOW_PERIOD - 1, so the flow repeats. */
function wrapCell(index: ShaderNodeObject<Node>) {
  return wrapIndex(index, FLOW_PERIOD);
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
   * How far the flow has moved: the speed prop summed over time. Each lattice
   * arrow turns by about this many radians, more or less by its own spin,
   * and the flow slides SLIDE_RATE lattice cells per unit.
   */
  phase: TSLNode;
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
function flowVelocity(point: TSLNode, { seed, phase }: FlowInputs) {
  const broadSeed = stableHashUint(float(seed));
  // A second, unrelated hash stream, so the smaller eddies don't line up
  // with the broad ones.
  const smallSeed = stableHashUint(broadSeed);
  const phaseNode = float(phase);

  // Reading the flow from a point behind this one, against SLIDE_DIRECTION,
  // shifts the whole flow forward along it by phase x SLIDE_RATE lattice cells.
  const slideDistance = phaseNode.mul(SLIDE_RATE);
  const readPoint = vec2(point).sub(
    vec2(slideDistance.mul(SLIDE_DIRECTION[0]), slideDistance.mul(SLIDE_DIRECTION[1])),
  );

  const broadSlope = gradientNoise(readPoint, broadSeed, phaseNode).slope;
  const smallSlope = gradientNoise(readPoint.mul(SMALL_EDDY_FREQUENCY), smallSeed, phaseNode).slope;

  // The small layer's slope weight. Read at twice the frequency, its slope
  // comes out twice as steep by the chain rule, so at a strength of 0.5 the
  // small eddies swirl as hard as the broad ones. The strength scales the
  // layer's height, as an fBm octave's gain does.
  const slope = broadSlope.add(smallSlope.mul(SMALL_EDDY_STRENGTH * SMALL_EDDY_FREQUENCY));

  // Curl: the slope turned 90 degrees clockwise.
  return vec2(slope.y, slope.x.negate());
}

/**
 * FlowInputs as uniforms, whose current values the flow pass can read on
 * the CPU to tell whether the flow changed since its last draw.
 */
export type FlowUniforms = { [Input in keyof FlowInputs]: ReturnType<typeof uniform<number>> };

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
 * The pass redraws only on a frame where one of its inputs has changed since
 * its last draw. While the flow holds still, other layers can keep the scene
 * drawing, as a cursor effect does, and the texture already holds the flow.
 *
 * The caller creates and disposes the pass in one effect, so a Strict Mode
 * remount builds a fresh one (the Strict Mode gotcha in docs/agents/tsl.md).
 */
export function createFlowPass(
  shaderContext: ShaderContextValue,
  inputs: FlowUniforms,
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
  // gotcha in docs/agents/tsl.md). The CPU compares each input with the
  // value it had at the last draw and skips the draw while all of them
  // match. NaN never equals a number, so the first frame always draws.
  const sources = [inputs.seed, inputs.phase];
  const drawnValues = sources.map(() => Number.NaN);
  const removePrePass = shaderContext.registerPrePass(() => {
    if (sources.every((source, index) => source.value === drawnValues[index])) return;
    sources.forEach((source, index) => {
      drawnValues[index] = source.value;
    });
    pass.render();
  });

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

/** Reads linear RGB at one point of a trace, given its offset from the start. */
export type PathSampler = (offset: ShaderNodeObject<Node>) => ShaderNodeObject<Node>;

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
  /**
   * What color to read at every point of the path. The trace calls this
   * inside its shader function before the loop, so it can pin the values
   * that are the same on every step with .toVar() (the first-use gotcha in
   * docs/agents/tsl.md), and it returns the reader for one point.
   */
  sampleAlongPath: () => PathSampler;
}

/**
 * Trace a point backward along the flow and return the average linear RGB
 * color of every point it passed, from the start through each step to the
 * end. Each step reads the velocity where the trace has reached, steps
 * against it, toward where the color came from, and reads the color there.
 * The average streaks every color along the current, the way a long
 * exposure of moving liquid does.
 *
 * Written with Fn and Loop, so the GPU runs a real loop instead of `steps`
 * copies of the body.
 */
export function traceFlow(
  start: TSLNode,
  { steps, stepLength, velocityAt, sampleAlongPath }: TraceFlowOptions,
): ShaderNodeObject<Node> {
  return Fn(() => {
    // Pin what is the same on every step before the loop. Without .toVar(),
    // TSL writes each expression where the shader first uses it, which is
    // inside the loop, so every step would redo it (the first-use gotcha in
    // docs/agents/tsl.md).
    const origin = vec2(start).toVar();
    const step = float(stepLength).toVar();
    const sampleAt = sampleAlongPath();

    // The loop's running state: how far the trace has moved from `origin`,
    // and the sum of the colors it read. Starting the offset at 0 means a
    // step length of 0 reads the pixel's own point every time, so straight
    // bands stay straight. The sum starts with that point.
    const offset = vec2(0, 0).toVar();
    const colorSum = vec3(sampleAt(offset)).toVar();

    Loop(steps, () => {
      // One velocity read per step. STEP_COUNT in ./shader.tsx says why
      // midpoint integration's second read isn't worth it here.
      offset.subAssign(velocityAt(origin.add(offset)).mul(step));
      colorSum.addAssign(sampleAt(offset));
    });

    return colorSum.div(steps + 1);
  })();
}

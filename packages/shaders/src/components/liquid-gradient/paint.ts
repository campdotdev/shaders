// The paint the flow carries: a field of fractal noise that the shader
// (./shader.tsx) adds to each point's place in the bands. Its broad layers
// break the bands into blotches, and its fine layers are what the path
// average draws out into streaks along the current, the way a long exposure
// streaks a detailed surface. The paint pass draws one period of it into a
// texture when the seed changes, so each trace step reads one texel (one
// pixel of a texture) instead of summing the layers.
import type { ShaderNodeObject } from 'three/tsl';
import { float, floor, Fn, fract, mix, texture, type uniform, uv, vec2, vec4 } from 'three/tsl';
import { HalfFloatType, LinearFilter, type Node, RedFormat } from 'three/webgpu';

import { createTexturePass, stableHash, stableHashUint, type TSLNode } from '../../engine.js';
import type { ShaderContextValue } from '../../react/context/shader-context.js';
import { FLOW_PERIOD, wrapIndex } from './flow.js';

// ---------------------------------------------
// Constants
// ---------------------------------------------

// The paint repeats with the flow, every FLOW_PERIOD lattice cells, so the
// two tile together and no repeat shows below the scale slider's top.
const PAINT_PERIOD = FLOW_PERIOD;

// The noise layers, broadest first, in waves per lattice cell. Each doubles
// the one before, so the broadest makes blotches about an eddy wide and the
// finest makes detail a sixteenth of that, which the path average draws
// out into streaks. Every frequency times PAINT_PERIOD is a whole number,
// so every layer repeats with the period.
const LAYER_FREQUENCIES = [1, 2, 4, 8, 16];

// Texels per period on each side. 1024 over 8 cells gives 128 texels per
// cell, 8 per wave of the finest layer, which the linear filter (a read
// between texel centers blends the four around it) smooths over. The
// texture holds one half float, a 16-bit float, per texel, 2 MB, and draws
// only when the seed changes.
const PAINT_TEXELS = 1024;

// How loudly the finer layers speak: each layer weighs this much times the
// one before. Lower leaves soft blotches; higher adds more of the fine
// detail the path average streaks along the current. At 1 every layer
// would weigh the same.
const LAYER_GAIN = 0.6;

// The inline fallback sums only the broadest layers, because every pixel
// pays for them at every step.
const INLINE_LAYERS = 2;

// ---------------------------------------------
// Value noise
// ---------------------------------------------

/**
 * Smooth value noise at `point`, -1..1, repeating every `period` cells. Each
 * lattice corner gets a random height from stableHash, and the point blends
 * the four corners around it with the quintic fade, so the surface is
 * smooth across cell edges. Cheaper than gradient noise, and fine here,
 * where nothing needs its slope.
 */
function valueNoise(
  point: ShaderNodeObject<Node>,
  seedWord: ShaderNodeObject<Node>,
  period: number,
) {
  const cell = floor(point);
  const local = fract(point);

  // The quintic fade 6t^5 - 15t^4 + 10t^3, as in flow.ts.
  const fade = local
    .mul(local)
    .mul(local)
    .mul(local.mul(local.mul(6).sub(15)).add(10));

  // One random height per corner, from nested row-then-column hashes as in
  // flow.ts, mapped from 0..1 to -1..1.
  const lowerRow = stableHashUint(wrapIndex(cell.y, period).toUint().add(seedWord));
  const upperRow = stableHashUint(wrapIndex(cell.y.add(1), period).toUint().add(seedWord));
  const leftColumn = wrapIndex(cell.x, period).toUint();
  const rightColumn = wrapIndex(cell.x.add(1), period).toUint();
  const heightAt = (column: ShaderNodeObject<Node>, rowWord: ShaderNodeObject<Node>) =>
    stableHash(column.add(rowWord)).mul(2).sub(1);

  const lower = mix(heightAt(leftColumn, lowerRow), heightAt(rightColumn, lowerRow), fade.x);
  const upper = mix(heightAt(leftColumn, upperRow), heightAt(rightColumn, upperRow), fade.x);

  return mix(lower, upper, fade.y);
}

/** What shapes the paint. */
export interface PaintInputs {
  /** A whole number 0 or above that picks the paint's random layout. */
  seed: TSLNode;
}

/**
 * The paint at `point`, summed from the first `layerCount` layers and
 * divided by the total weight, so it stays roughly -1..1.
 */
function paintNoise(point: TSLNode, { seed }: PaintInputs, layerCount: number) {
  // A hash stream of its own, so the paint doesn't line up with the flow,
  // which hashes the seed directly.
  const seedWord = stableHashUint(stableHashUint(float(seed)).add(1));
  let total = float(0);
  let totalWeight = 0;
  let weight = 1;

  LAYER_FREQUENCIES.slice(0, layerCount).forEach((frequency, layer) => {
    // Each layer gets its own stream, seedWord + layer, so the layers
    // don't echo each other.
    const layerNoise = valueNoise(
      vec2(point).mul(frequency),
      seedWord.add(layer),
      PAINT_PERIOD * frequency,
    );

    total = total.add(layerNoise.mul(weight));
    totalWeight += weight;
    weight *= LAYER_GAIN;
  });

  return total.div(totalWeight);
}

// ---------------------------------------------
// The paint pass
// ---------------------------------------------

/** Reads the paint at a point in lattice cells, -1..1. */
export type PaintAt = (point: ShaderNodeObject<Node>) => ShaderNodeObject<Node>;

/** The paint pass's handle: how to read the paint, and how to release it. */
export interface PaintPass {
  paintAt: PaintAt;
  dispose: () => void;
}

/**
 * Draws one period of the paint into a one-channel texture, so a trace step
 * reads one texel instead of summing five layers. Laid out like the flow
 * pass in flow.ts: PAINT_TEXELS + 1 texels a side, the last row and column
 * repeating the first, so the linear filter blends across the period's seam
 * as smoothly as anywhere else. The paint holds still while the flow moves,
 * so the pass draws on the first frame and again only when the seed
 * changes. Where the renderer can't draw half floats, every read sums the
 * broadest layers inline instead.
 *
 * The caller creates and disposes the pass in one effect, so a Strict Mode
 * remount builds a fresh one (the Strict Mode gotcha in docs/agents/tsl.md).
 */
export function createPaintPass(
  shaderContext: ShaderContextValue,
  inputs: { seed: ReturnType<typeof uniform<number>> },
): PaintPass {
  const side = PAINT_TEXELS + 1;

  // One texel's value: the paint at the lattice point under it, worked out
  // from uv() as the flow pass does.
  const paintNode = Fn(() => {
    const point = uv()
      .mul(side)
      .sub(0.5)
      .mul(PAINT_PERIOD / PAINT_TEXELS);

    return vec4(paintNoise(point, inputs, LAYER_FREQUENCIES.length), 0, 0, 1);
  })();

  // A half float keeps the paint's fine steps, which an 8-bit texel would
  // round into visible terraces once the path average smooths them. One
  // channel stores a quarter of the bytes an RGBA texel would.
  const pass = createTexturePass(shaderContext.renderer.three, paintNode, {
    width: side,
    height: side,
    type: HalfFloatType,
    filter: LinearFilter,
    format: RedFormat,
  });
  const paintTexture = pass.texture;

  if (paintTexture === null) {
    return {
      paintAt: (point) => paintNoise(point, inputs, INLINE_LAYERS),
      dispose: () => {
        // Nothing was allocated.
      },
    };
  }

  // A pre-pass is a draw the output stage runs before the scene pass in the
  // same frame (the draw-order gotcha in docs/agents/tsl.md). This one
  // compares the seed with its value at the last draw and skips the draw
  // while it matches. NaN never equals a number, so the first frame always
  // draws.
  let drawnSeed = Number.NaN;
  const removePrePass = shaderContext.registerPrePass(() => {
    if (inputs.seed.value === drawnSeed) return;
    drawnSeed = inputs.seed.value;
    pass.render();
  });

  return {
    // Fold the point into the period, then into the texture, as the flow
    // pass's velocityAt does, with the coordinate passed when the node is
    // built (the texture-matrix gotcha in docs/agents/tsl.md).
    paintAt: (point) => {
      const periodFraction = fract(point.mul(1 / PAINT_PERIOD));
      const coordinate = periodFraction.mul(PAINT_TEXELS).add(0.5).div(side);

      return texture(paintTexture, coordinate).r;
    },
    dispose() {
      removePrePass();
      pass.dispose();
    },
  };
}

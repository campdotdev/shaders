import type { ShaderNodeObject } from 'three/tsl';
import { floor, fract } from 'three/tsl';
import type { Node } from 'three/webgpu';

// Threshold maps for ordered dithering. Every pattern turns a dither-cell
// coordinate into a threshold in [0, 1); the caller compares (or adds) that
// against a color to decide which side of a quantization step a cell lands
// on. Consumed by the anti-banding dither() primitive (subtle, one cell per
// device pixel) and the <Dither> registry component (loud, chunky cells).

/** The threshold maps available to ordered dithering. */
export type DitherPattern = 'bayer-2x2' | 'bayer-4x4' | 'bayer-8x8';

// ---------------------------------------------
// Bayer matrices, built recursively from the 2x2 base
// ---------------------------------------------
// `bayer2` is the canonical 2x2 ordered-dither cell in closed form
// (`fract(x/2 + y·y·0.75)`); `bayer4`/`bayer8` refine it by adding a quarter
// of the next-finer cell sampled at half the frequency. Each yields a value
// in [0, 1) that tiles its NxN threshold map across the cell grid.
function bayer2(coord: ShaderNodeObject<Node>): ShaderNodeObject<Node> {
  const cell = floor(coord);

  return fract(cell.x.mul(0.5).add(cell.y.mul(cell.y).mul(0.75)));
}

function bayer4(coord: ShaderNodeObject<Node>): ShaderNodeObject<Node> {
  return bayer2(coord.mul(0.5)).mul(0.25).add(bayer2(coord));
}

function bayer8(coord: ShaderNodeObject<Node>): ShaderNodeObject<Node> {
  return bayer4(coord.mul(0.5)).mul(0.25).add(bayer2(coord));
}

// ---------------------------------------------
// Pattern dispatch
// ---------------------------------------------

/**
 * Threshold for one dither cell: `pattern` picks the map, `cellCoord` is the
 * cell's position on the cell grid (fractional input is floored by the maps
 * themselves). Returns a scalar node in `[0, 1)`. The branch is plain
 * JavaScript, so the chosen pattern is baked into the compiled shader —
 * changing it means rebuilding the node graph.
 */
export function ditherThreshold(
  pattern: DitherPattern,
  cellCoord: ShaderNodeObject<Node>,
): ShaderNodeObject<Node> {
  switch (pattern) {
    case 'bayer-2x2':
      return bayer2(cellCoord);
    case 'bayer-4x4':
      return bayer4(cellCoord);
    case 'bayer-8x8':
      return bayer8(cellCoord);
    default:
      throw new Error(`Unknown dither pattern: ${String(pattern)}`);
  }
}

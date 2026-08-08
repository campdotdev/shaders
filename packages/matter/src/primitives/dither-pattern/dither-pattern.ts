import type { ShaderNodeObject } from 'three/tsl';
import { cos, floor, fract, hash } from 'three/tsl';
import type { Node } from 'three/webgpu';

// Threshold maps for ordered dithering. Every pattern turns a dither-cell
// coordinate into a threshold in [0, 1); the caller compares (or adds) that
// against a color to decide which side of a quantization step a cell lands
// on. Consumed by the anti-banding dither() primitive (subtle, one cell per
// device pixel) and the <Dither> registry component (loud, chunky cells).

/** The threshold maps available to ordered dithering. */
export type DitherPattern =
  | 'bayer-2x2'
  | 'bayer-4x4'
  | 'bayer-8x8'
  | 'dots'
  | 'lines'
  | 'white-noise'
  | 'gradient-noise';

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
// Halftone screens
// ---------------------------------------------
// Print-style screens: instead of scattering the threshold (Bayer), arrange
// it in smooth waves so dark areas render as isolated shapes that grow and
// merge with brightness. Feel constants, units in dither cells — turning
// HALFTONE_PERIOD up makes bigger dots / wider lines. Screens run at the
// classic 45-degree print angle so the grid reads less mechanical.
const HALFTONE_PERIOD = 6;
const HALFTONE_COS = Math.cos(Math.PI / 4);
const HALFTONE_SIN = Math.sin(Math.PI / 4);
const HALFTONE_FREQUENCY = (Math.PI * 2) / HALFTONE_PERIOD;

function dotScreen(coord: ShaderNodeObject<Node>): ShaderNodeObject<Node> {
  const cell = floor(coord);
  // Rotate the cell grid 45 degrees (standard 2D rotation, constants baked
  // on the CPU), then sum a cosine along each rotated axis. cos+cos lands in
  // -2..2 and makes an egg-crate surface: one rounded peak per period.
  const rotatedX = cell.x.mul(HALFTONE_COS).sub(cell.y.mul(HALFTONE_SIN));
  const rotatedY = cell.x.mul(HALFTONE_SIN).add(cell.y.mul(HALFTONE_COS));
  const wave = cos(rotatedX.mul(HALFTONE_FREQUENCY)).add(cos(rotatedY.mul(HALFTONE_FREQUENCY)));

  // Scale -2..2 into 0..1. Clamp shy of 1: a threshold of exactly 1 would
  // push quantize() a full level up instead of deciding a rounding.
  return wave.mul(0.25).add(0.5).clamp(0, 0.999);
}

function lineScreen(coord: ShaderNodeObject<Node>): ShaderNodeObject<Node> {
  const cell = floor(coord);
  // Distance along the normal of 45-degree lines; a single cosine across it
  // makes parallel ridges — lines thicken with brightness.
  const across = cell.x.mul(HALFTONE_SIN).add(cell.y.mul(HALFTONE_COS));

  return cos(across.mul(HALFTONE_FREQUENCY)).mul(0.5).add(0.5).clamp(0, 0.999);
}

// ---------------------------------------------
// Noise thresholds
// ---------------------------------------------

function whiteNoise(coord: ShaderNodeObject<Node>): ShaderNodeObject<Node> {
  const cell = floor(coord);
  // Deterministic per-cell random in [0, 1) — the same nested-uint-hash
  // recipe as the grain primitive (a single linear seed would leave a
  // visible gradient axis). No time input: the pattern is frozen, so static
  // scenes stay static.
  const column = cell.x.toUint();
  const rowHash = hash(cell.y.toUint()).mul(0xffffff).toUint();

  return hash(column.add(rowHash));
}

function gradientNoise(coord: ShaderNodeObject<Node>): ShaderNodeObject<Node> {
  const cell = floor(coord);

  // Interleaved gradient noise (Jimenez, SIGGRAPH 2014): a closed-form
  // pattern that looks noisier than Bayer but distributes more evenly than
  // white noise. The magic constants are the published ones.
  return fract(fract(cell.x.mul(0.06711056).add(cell.y.mul(0.00583715))).mul(52.9829189));
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
    case 'dots':
      return dotScreen(cellCoord);
    case 'lines':
      return lineScreen(cellCoord);
    case 'white-noise':
      return whiteNoise(cellCoord);
    case 'gradient-noise':
      return gradientNoise(cellCoord);
    default:
      throw new Error(`Unknown dither pattern: ${String(pattern)}`);
  }
}

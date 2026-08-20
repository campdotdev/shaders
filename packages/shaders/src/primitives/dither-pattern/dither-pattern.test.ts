import { vec2 } from 'three/tsl';
import { describe, expect, it } from 'vitest';

import { BLUE_NOISE_SIZE, BLUE_NOISE_TILE } from './blue-noise-tile.js';
import { ditherThreshold } from './dither-pattern.js';

describe('ditherThreshold', () => {
  it('builds a node for each Bayer pattern', () => {
    expect(ditherThreshold('bayer-2x2', vec2(3, 5))).toBeDefined();
    expect(ditherThreshold('bayer-4x4', vec2(3, 5))).toBeDefined();
    expect(ditherThreshold('bayer-8x8', vec2(3, 5))).toBeDefined();
  });

  it('accepts fractional cell coordinates (maps floor internally)', () => {
    expect(ditherThreshold('bayer-8x8', vec2(3.7, 5.2))).toBeDefined();
  });

  it('builds halftone screen nodes', () => {
    expect(ditherThreshold('dots', vec2(3, 5))).toBeDefined();
    expect(ditherThreshold('lines', vec2(3, 5))).toBeDefined();
  });

  it('builds noise threshold nodes', () => {
    expect(ditherThreshold('white-noise', vec2(3, 5))).toBeDefined();
    expect(ditherThreshold('gradient-noise', vec2(3, 5))).toBeDefined();
  });

  it('builds a blue-noise threshold node', () => {
    expect(ditherThreshold('blue-noise', vec2(3, 5))).toBeDefined();
  });
});

describe('blue-noise tile', () => {
  it('is a full 64x64 tile', () => {
    expect(BLUE_NOISE_TILE.length).toBe(BLUE_NOISE_SIZE * BLUE_NOISE_SIZE);
  });

  it('uses every threshold value equally (ranks are a permutation)', () => {
    const counts = new Array<number>(256).fill(0);

    for (const byte of BLUE_NOISE_TILE) counts[byte] = (counts[byte] ?? 0) + 1;
    expect(counts.every((count) => count === 16)).toBe(true);
  });
});

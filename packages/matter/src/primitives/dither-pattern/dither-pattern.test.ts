import { vec2 } from 'three/tsl';
import { describe, expect, it } from 'vitest';

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
});

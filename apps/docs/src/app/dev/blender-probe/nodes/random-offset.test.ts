import { describe, expect, it } from 'vitest';

import { randomVec3Offset } from './random-offset';

describe('randomVec3Offset', () => {
  // The values that made the green marble's Noise, Voronoi, and Wave taps
  // match Cycles on Apple Silicon. Seed 3's z offset is the one a second
  // rounding moves, to 193.40841674804688.
  it('rounds 100 + h * 100 once, as Cycles does', () => {
    expect(randomVec3Offset(3)).toEqual([
      165.44528198242188, 162.76821899414062, 193.4084014892578,
    ]);
    expect(randomVec3Offset(4)).toEqual([
      155.58091735839844, 177.15463256835938, 138.14002990722656,
    ]);
  });
});

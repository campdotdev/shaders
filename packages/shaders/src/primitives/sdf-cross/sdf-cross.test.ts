import { float, uv, vec2 } from 'three/tsl';
import { describe, expect, it } from 'vitest';

import { signedDistanceFieldCross } from './sdf-cross.js';

// The GPU is not available here, so like sdf-circle's test this checks the
// primitive builds a node for every argument form the callers use: numeric
// arm sizes for a fixed mark, float nodes for a uniform-driven one.
describe('sdfCross', () => {
  const p = (uv() as unknown as { sub(v: unknown): unknown }).sub(vec2(0.5, 0.5));

  it('returns a TSL node with numeric arm sizes', () => {
    expect(signedDistanceFieldCross(p as never, 0.25, 0.05)).toBeDefined();
  });

  it('returns a TSL node with node arm sizes', () => {
    expect(signedDistanceFieldCross(p as never, float(0.25), float(0.05))).toBeDefined();
  });
});

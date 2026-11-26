import { describe, expect, it } from 'vitest';

import { strandAttributes } from './strand-attributes.js';

describe('strandAttributes', () => {
  it('returns across, seed, along, and side nodes', () => {
    const { across, seed, along, side } = strandAttributes();

    expect(typeof across.mul).toBe('function');
    expect(typeof seed.mul).toBe('function');
    expect(typeof along.mul).toBe('function');
    expect(typeof side.mul).toBe('function');
  });

  it('reads the attributes createStrandGeometry writes', () => {
    const { across, seed, along, side } = strandAttributes();
    const nameOf = (node: unknown) =>
      (node as { getAttributeName: () => string }).getAttributeName();

    expect(nameOf(across)).toBe('strandAcross');
    expect(nameOf(seed)).toBe('strandSeed');
    expect(nameOf(along)).toBe('strandAlong');
    expect(nameOf(side)).toBe('strandSide');
  });
});

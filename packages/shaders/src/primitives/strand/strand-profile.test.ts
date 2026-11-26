import { float, uniform } from 'three/tsl';
import { describe, expect, it } from 'vitest';

import { strandProfile } from './strand-profile.js';

describe('strandProfile', () => {
  it('returns a chainable node', () => {
    const profile = strandProfile(float(0), 4);

    expect(typeof profile.mul).toBe('function');
  });

  it('accepts numeric and node arguments', () => {
    expect(strandProfile(0, 4)).toBeDefined();
    expect(strandProfile(uniform(0), uniform(4))).toBeDefined();
  });
});

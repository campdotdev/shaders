import { uv } from 'three/tsl';
import { describe, expect, it } from 'vitest';

import { simplexNoise } from './noise.js';

describe('noise', () => {
  it('returns a TSL node when called with uv()', () => {
    const noiseValue = simplexNoise(uv());

    expect(noiseValue).toBeDefined();
    expect(noiseValue).not.toBeNull();
  });
});

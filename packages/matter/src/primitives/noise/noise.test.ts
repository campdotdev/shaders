import { uv } from 'three/tsl';
import { describe, expect, it } from 'vitest';

import { noise } from './noise.js';

describe('noise', () => {
  it('returns a TSL node when called with uv()', () => {
    const noiseValue = noise(uv());

    expect(noiseValue).toBeDefined();
    expect(noiseValue).not.toBeNull();
  });
});

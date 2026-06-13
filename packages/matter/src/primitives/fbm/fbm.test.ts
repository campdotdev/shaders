import { uv } from 'three/tsl';
import { describe, expect, it } from 'vitest';

import { fbm } from './fbm.js';

describe('fbm', () => {
  it('returns a TSL node with default options', () => {
    const fbmValue = fbm(uv());

    expect(fbmValue).toBeDefined();
  });

  it('returns a TSL node when octaves=1', () => {
    const fbmValue = fbm(uv(), { octaves: 1 });

    expect(fbmValue).toBeDefined();
  });

  it('respects custom lacunarity and gain', () => {
    const fbmValue = fbm(uv(), { octaves: 6, lacunarity: 2.5, gain: 0.4 });

    expect(fbmValue).toBeDefined();
  });
});

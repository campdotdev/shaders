import { uv } from 'three/tsl';
import { describe, expect, it } from 'vitest';

import { fractalNoise } from './fbm.js';

describe('fbm', () => {
  it('returns a TSL node with default options', () => {
    const noiseValue = fractalNoise(uv());

    expect(noiseValue).toBeDefined();
  });

  it('returns a TSL node when octaves=1', () => {
    const noiseValue = fractalNoise(uv(), { octaves: 1 });

    expect(noiseValue).toBeDefined();
  });

  it('respects custom lacunarity and gain', () => {
    const noiseValue = fractalNoise(uv(), { octaves: 6, lacunarity: 2.5, gain: 0.4 });

    expect(noiseValue).toBeDefined();
  });
});

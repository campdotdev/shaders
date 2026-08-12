import { uniform, uv } from 'three/tsl';
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

  it.each(['none', 'smooth', 'sharp'] as const)('builds with fold=%s', (fold) => {
    const noiseValue = fractalNoise(uv(), { fold });

    expect(noiseValue).toBeDefined();
    // Chainable — consumers immediately .add()/.mul() the result.
    expect(typeof noiseValue.mul).toBe('function');
  });

  it('builds with fold and a single octave', () => {
    const noiseValue = fractalNoise(uv(), { octaves: 1, fold: 'sharp' });

    expect(noiseValue).toBeDefined();
  });

  it('accepts a uniform node as gain', () => {
    const gainUniform = uniform(0.5);
    const noiseValue = fractalNoise(uv(), { octaves: 4, gain: gainUniform });

    expect(noiseValue).toBeDefined();
    expect(typeof noiseValue.mul).toBe('function');
  });

  it('accepts a node gain combined with a fold', () => {
    const noiseValue = fractalNoise(uv(), { gain: uniform(0.7), fold: 'smooth' });

    expect(noiseValue).toBeDefined();
  });
});

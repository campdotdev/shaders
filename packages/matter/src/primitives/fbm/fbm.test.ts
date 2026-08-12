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

  // The octave loop unrolls in JavaScript at build time, so a bad count must
  // throw instead of silently mis-building — or, for Infinity and huge finite
  // counts (which unroll an enormous shader graph), hanging the tab.
  it.each([0, -1, 2.5, Number.NaN, Number.POSITIVE_INFINITY, 13, 1000])(
    'rejects octaves=%s',
    (octaves) => {
      expect(() => fractalNoise(uv(), { octaves })).toThrow(/octaves/);
    },
  );

  it('accepts octaves at the documented maximum of 12', () => {
    const noiseValue = fractalNoise(uv(), { octaves: 12 });

    expect(noiseValue).toBeDefined();
  });

  // A negative gain can cancel the normalizing amplitude sum to zero
  // (gain -1 over 2 octaves: 1 + (-1) = 0), leaving the final divide
  // non-finite or undefined — so numeric gain must be a finite
  // non-negative number.
  it.each([-1, -0.5, Number.NaN, Number.POSITIVE_INFINITY])('rejects gain=%s', (gain) => {
    expect(() => fractalNoise(uv(), { gain })).toThrow(/gain/);
  });

  it('accepts gain=0 (base octave only)', () => {
    const noiseValue = fractalNoise(uv(), { gain: 0 });

    expect(noiseValue).toBeDefined();
  });
});

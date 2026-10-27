import { uniform, uv } from 'three/tsl';
import { describe, expect, it } from 'vitest';

import { fluteSurface } from './flute-surface.js';

describe('fluteSurface', () => {
  it('returns bend and slope nodes with default options', () => {
    const surface = fluteSurface(uv().mul(400));

    expect(surface.bend).toBeDefined();
    expect(surface.slope).toBeDefined();
  });

  it('accepts numeric options', () => {
    const surface = fluteSurface(uv().mul(400), { fluteWidth: 24, angle: 30, refraction: 0.5 });

    expect(surface.bend).toBeDefined();
  });

  it('accepts node options (uniform-driven dials)', () => {
    const surface = fluteSurface(uv().mul(400), {
      fluteWidth: uniform(40),
      angle: uniform(90),
      refraction: uniform(1),
    });

    expect(surface.bend).toBeDefined();
    expect(surface.slope).toBeDefined();
  });

  it('accepts a cross-section at either end of the dial and between', () => {
    for (const crossSection of [0, 0.25, 0.5, 1]) {
      expect(fluteSurface(uv().mul(400), { crossSection }).slope).toBeDefined();
    }
  });

  it('accepts a node cross-section and node exponent ends', () => {
    const surface = fluteSurface(uv().mul(400), {
      crossSection: uniform(0.5),
      prismExponent: uniform(1 / 16),
      flatExponent: uniform(16),
      grooveSmoothing: uniform(1),
    });

    expect(surface.bend).toBeDefined();
  });

  it('accepts a cross-section outside 0 to 1 without throwing', () => {
    expect(() => fluteSurface(uv(), { crossSection: -1 })).not.toThrow();
    expect(() => fluteSurface(uv(), { crossSection: 2 })).not.toThrow();
  });

  it('accepts a groove smoothing of 0 without throwing', () => {
    expect(() => fluteSurface(uv(), { grooveSmoothing: 0 })).not.toThrow();
  });

  it('accepts a flute width of 0 without throwing', () => {
    expect(() => fluteSurface(uv(), { fluteWidth: 0 })).not.toThrow();
  });
});

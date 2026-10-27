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

  it('accepts a flute width of 0 without throwing', () => {
    expect(() => fluteSurface(uv(), { fluteWidth: 0 })).not.toThrow();
  });
});

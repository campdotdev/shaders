import { uniform, uv } from 'three/tsl';
import { describe, expect, it } from 'vitest';

import { MAX_BLOBS, metaballs } from './metaballs.js';

describe('metaballs', () => {
  it('returns field and blend nodes when sampled at uv()', () => {
    const balls = metaballs(uv().sub(0.5));

    expect(balls.field).toBeDefined();
    expect(balls.blend).toBeDefined();
  });

  it('accepts numeric options, including a fractional count', () => {
    const balls = metaballs(uv(), {
      count: 5.5,
      size: 0.7,
      sizeVariation: 0.3,
      spread: 0.8,
      time: 1.5,
      seed: 3,
    });

    expect(balls.field).toBeDefined();
  });

  it('accepts out-of-range dials (clamped internally)', () => {
    expect(
      metaballs(uv(), { count: 99, size: -1, sizeVariation: 2, spread: 5 }).field,
    ).toBeDefined();
  });

  it('accepts node options (uniform-driven dials)', () => {
    const balls = metaballs(uv(), {
      count: uniform(6),
      size: uniform(0.5),
      sizeVariation: uniform(0),
      spread: uniform(0.5),
      time: uniform(0),
      seed: uniform(0),
    });

    expect(balls.blend).toBeDefined();
  });

  it('exposes the blob cap', () => {
    expect(MAX_BLOBS).toBe(20);
  });

  it('accepts TEMPORARY tuning overrides as nodes', () => {
    const balls = metaballs(uv(), {
      tuning: { fieldReach: uniform(2), exponentMax: 45, fastWeight: uniform(0.35) },
    });

    expect(balls.field).toBeDefined();
  });
});

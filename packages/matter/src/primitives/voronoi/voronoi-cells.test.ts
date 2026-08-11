import { uniform, uv } from 'three/tsl';
import { describe, expect, it } from 'vitest';

import { voronoiCells } from './voronoi-cells.js';

describe('voronoiCells', () => {
  it('returns edgeDistance, seedOffset, and hash nodes when sampled at uv()', () => {
    const cells = voronoiCells(uv().mul(5));

    expect(cells.edgeDistance).toBeDefined();
    expect(cells.seedOffset).toBeDefined();
    expect(cells.hash).toBeDefined();
  });

  it('accepts numeric options', () => {
    expect(voronoiCells(uv(), { time: 1.5, jitter: 0.5, drift: 0.1 }).edgeDistance).toBeDefined();
  });

  it('accepts out-of-range dials (clamped to 0..1 internally)', () => {
    expect(voronoiCells(uv(), { jitter: 2, drift: -1 }).edgeDistance).toBeDefined();
  });

  it('accepts node options (uniform-driven dials)', () => {
    const cells = voronoiCells(uv(), {
      time: uniform(0),
      jitter: uniform(1),
      drift: uniform(0.1),
    });

    expect(cells.hash).toBeDefined();
  });
});

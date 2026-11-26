import { describe, expect, it } from 'vitest';

import { createStrandGeometry } from './create-strand-geometry.js';

const values = (geometry: ReturnType<typeof createStrandGeometry>, name: string) =>
  Array.from(geometry.getAttribute(name).array);

describe('createStrandGeometry', () => {
  it('allocates two vertices per sample and two triangles per segment', () => {
    const geometry = createStrandGeometry({ strands: 3, samples: 5 });

    // 3 strands x 5 samples x 2 sides.
    expect(geometry.getAttribute('strandAlong').count).toBe(30);
    // 3 strands x 4 segments x 2 triangles x 3 corners.
    expect(geometry.getIndex()?.count).toBe(72);
  });

  it('carries across, seed, along, and side as one float per vertex', () => {
    const geometry = createStrandGeometry({ strands: 3, samples: 5 });

    for (const name of ['strandAcross', 'strandSeed', 'strandAlong', 'strandSide']) {
      const attribute = geometry.getAttribute(name);

      expect(attribute.itemSize, name).toBe(1);
      expect(attribute.count, name).toBe(30);
      expect(attribute.array, name).toBeInstanceOf(Float32Array);
    }
  });

  it('lays vertices out strand by strand, sample by sample, in side pairs', () => {
    const geometry = createStrandGeometry({ strands: 2, samples: 3 });

    expect(values(geometry, 'strandAcross')).toEqual([0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1]);
    expect(values(geometry, 'strandAlong')).toEqual([0, 0, 0.5, 0.5, 1, 1, 0, 0, 0.5, 0.5, 1, 1]);
    expect(values(geometry, 'strandSide')).toEqual([-1, 1, -1, 1, -1, 1, -1, 1, -1, 1, -1, 1]);
  });

  it('gives each strand one seed from 0 to 1, shared by all its vertices', () => {
    const geometry = createStrandGeometry({ strands: 8, samples: 4 });
    const seeds = values(geometry, 'strandSeed');
    const perStrand = Array.from({ length: 8 }, (_, strand) =>
      seeds.slice(strand * 8, strand * 8 + 8),
    );

    for (const strand of perStrand) {
      expect(new Set(strand).size).toBe(1);
      expect(strand[0]).toBeGreaterThanOrEqual(0);
      expect(strand[0]).toBeLessThan(1);
    }
    expect(new Set(perStrand.map((strand) => strand[0])).size).toBe(8);
  });

  it('builds the same seeds every time', () => {
    const first = createStrandGeometry({ strands: 8, samples: 4 });
    const second = createStrandGeometry({ strands: 8, samples: 4 });

    expect(values(first, 'strandSeed')).toEqual(values(second, 'strandSeed'));
  });

  it('joins each segment with two triangles that stay inside one strand', () => {
    const geometry = createStrandGeometry({ strands: 2, samples: 3 });
    const index = Array.from(geometry.getIndex()!.array);

    // First segment of the first strand: vertices 0 and 1 are the two sides
    // of sample 0, and 2 and 3 the two sides of sample 1. Each triangle's
    // corners run counter-clockwise once extrudeStrand has placed them, so
    // three draws them as facing the viewer.
    expect(index.slice(0, 6)).toEqual([0, 2, 1, 2, 3, 1]);
    // The first strand owns vertices 0 to 5 and the second 6 to 11. No
    // triangle bridges the two.
    expect(Math.max(...index.slice(0, 12))).toBe(5);
    expect(Math.min(...index.slice(12))).toBe(6);
  });

  it('centers a single strand across the ribbon', () => {
    const geometry = createStrandGeometry({ strands: 1, samples: 2 });

    expect(values(geometry, 'strandAcross')).toEqual([0.5, 0.5, 0.5, 0.5]);
  });

  it('is never culled, because the shader moves every vertex', () => {
    const geometry = createStrandGeometry({ strands: 1, samples: 2 });

    expect(geometry.boundingSphere?.radius).toBe(Number.POSITIVE_INFINITY);
  });

  it.each([0, -1, 1.5, Number.NaN])('throws on a strand count of %s', (strands) => {
    expect(() => createStrandGeometry({ strands, samples: 4 })).toThrow(RangeError);
  });

  it.each([1, 0, 2.5, Number.NaN])('throws on a sample count of %s', (samples) => {
    expect(() => createStrandGeometry({ strands: 4, samples })).toThrow(RangeError);
  });
});

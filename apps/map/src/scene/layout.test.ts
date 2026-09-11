// Covers the cell-to-world math in layout.ts: centering cells, plates, and
// boxes, the hop's ease and lift, and the grid bounds computed from a set of
// neighborhoods.
import { describe, expect, it } from 'vitest';

import type { Module, Neighborhood } from '@/data/types';

import {
  BOX_HEIGHT,
  boxCenter,
  cellCenter,
  easeInOut,
  gridBounds,
  hopPosition,
  moduleTop,
  PLATE_HEIGHT,
  plateCenter,
} from './layout';

const neighborhood: Neighborhood = {
  id: 'n',
  name: 'N',
  description: '',
  origin: [2, 4],
  size: [6, 3],
  color: '#fff',
};

const module: Module = {
  id: 'm',
  name: 'M',
  neighborhood: 'n',
  cell: [3, 5],
  path: 'x',
  summary: '',
};

describe('layout', () => {
  it('centers a cell at its midpoint', () => {
    expect(cellCenter([3, 5])).toEqual([3.5, 5.5]);
  });

  it('centers a plate on its rectangle at half the plate height', () => {
    expect(plateCenter(neighborhood)).toEqual([5, PLATE_HEIGHT / 2, 5.5]);
  });

  it('sits a box on the plate and its top at the box height', () => {
    expect(boxCenter(module)).toEqual([3.5, PLATE_HEIGHT + BOX_HEIGHT / 2, 5.5]);
    expect(moduleTop(module)).toEqual([3.5, PLATE_HEIGHT + BOX_HEIGHT, 5.5]);
  });

  it('eases from 0 to 1 through the midpoint', () => {
    expect(easeInOut(0)).toBe(0);
    expect(easeInOut(0.5)).toBe(0.5);
    expect(easeInOut(1)).toBe(1);
  });

  it('hops from one point to another with a lift in the middle', () => {
    const from = [0, 1, 0] as const;
    const to = [4, 1, 2] as const;

    expect(hopPosition(from, to, 0)).toEqual([0, 1, 0]);
    expect(hopPosition(from, to, 1)).toEqual([4, 1, 2]);

    const [x, y, z] = hopPosition(from, to, 0.5);

    expect(x).toBe(2);
    expect(z).toBe(1);
    expect(y).toBeGreaterThan(1);
  });

  it('bounds the grid around every neighborhood', () => {
    const other: Neighborhood = { ...neighborhood, id: 'o', origin: [0, 0], size: [2, 2] };
    const bounds = gridBounds([neighborhood, other]);

    expect(bounds.center).toEqual([4, 3.5]);
    expect(bounds.width).toBe(8);
    expect(bounds.depth).toBe(7);
  });
});

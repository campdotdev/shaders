// Turns grid cells into world units and interpolates the payload's hop. Pure
// math, no three, so the scene can be swapped and this file stays. One grid
// cell is one world unit. World y is up, x runs along columns, z along rows.
import type { Cell, Module, Neighborhood } from '@/data/types';

export type Point3 = readonly [x: number, y: number, z: number];

// ---- Sizes, in world units --------------------------------------------------

/** Thickness of a neighborhood plate. */
export const PLATE_HEIGHT = 0.12;
/** Footprint of a module box. Under 1 so gaps show between neighbors. */
export const BOX_SIZE = 0.7;
/** Height of a module box above its plate. */
export const BOX_HEIGHT = 0.45;
/** Peak height the payload gains mid-hop. Larger reads as a bigger jump. */
export const HOP_LIFT = 1.2;

// ---- Cells to world ---------------------------------------------------------

export function cellCenter([column, row]: Cell): readonly [x: number, z: number] {
  return [column + 0.5, row + 0.5];
}

export function plateCenter({ origin, size }: Neighborhood): Point3 {
  const [column, row] = origin;
  const [width, depth] = size;

  return [column + width / 2, PLATE_HEIGHT / 2, row + depth / 2];
}

export function boxCenter({ cell }: Module): Point3 {
  const [x, z] = cellCenter(cell);

  return [x, PLATE_HEIGHT + BOX_HEIGHT / 2, z];
}

export function moduleTop({ cell }: Module): Point3 {
  const [x, z] = cellCenter(cell);

  return [x, PLATE_HEIGHT + BOX_HEIGHT, z];
}

export function gridBounds(neighborhoods: readonly Neighborhood[]): {
  center: readonly [x: number, z: number];
  width: number;
  depth: number;
} {
  let maxColumn = 0;
  let maxRow = 0;

  for (const { origin, size } of neighborhoods) {
    maxColumn = Math.max(maxColumn, origin[0] + size[0]);
    maxRow = Math.max(maxRow, origin[1] + size[1]);
  }

  return { center: [maxColumn / 2, maxRow / 2], width: maxColumn, depth: maxRow };
}

// ---- The hop ----------------------------------------------------------------

/** Quadratic ease-in-out: slow out of the source, slow into the target. */
export function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

/**
 * The payload's position at progress `t` from `from` to `to`. Straight-line
 * interpolation plus a parabolic lift, `4t(1 - t)`, which is 0 at both ends
 * and 1 in the middle, so the payload hops instead of sliding.
 */
export function hopPosition(from: Point3, to: Point3, t: number): Point3 {
  const lift = HOP_LIFT * 4 * t * (1 - t);

  return [
    from[0] + (to[0] - from[0]) * t,
    from[1] + (to[1] - from[1]) * t + lift,
    from[2] + (to[2] - from[2]) * t,
  ];
}

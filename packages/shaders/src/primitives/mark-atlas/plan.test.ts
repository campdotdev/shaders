import { describe, expect, it } from 'vitest';

import { MARK_TILE_PADDING, MARK_TILE_SIZE, planMarkTiles } from './plan.js';

const TRIANGLE =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 2 22 22H2z"/></svg>';
const SQUARE = '<svg viewBox="0 0 10 10"><rect width="10" height="10"/></svg>';
const COMMA_BOX = "<svg viewBox='0, 0, 16, 16'><circle cx='8' cy='8' r='8'/></svg>";
const NO_BOX = '<svg><rect width="10" height="10"/></svg>';

// The inner square a box is fitted into, once the mip gutter is taken off
// both sides of the tile.
const INNER = MARK_TILE_SIZE - MARK_TILE_PADDING * 2;

// The plan is the pure step between markup strings and the atlas: it reads
// each mark's box and decides where in one shared texture the mark will be
// drawn. Nothing here touches an image, so it runs in plain Vitest.
describe('planMarkTiles', () => {
  it('reads the box from the viewBox', () => {
    const plan = planMarkTiles([TRIANGLE]);

    expect(plan.entries[0]?.box).toEqual({ width: 24, height: 24 });
  });

  it('accepts a comma-separated, single-quoted viewBox', () => {
    expect(planMarkTiles([COMMA_BOX]).entries[0]?.box).toEqual({ width: 16, height: 16 });
  });

  it('fits a square box into the first tile, inside the padding', () => {
    const plan = planMarkTiles([SQUARE]);
    const tile = plan.entries[0];

    expect(tile).toMatchObject({ column: 0, row: 0 });
    expect(tile?.rect).toEqual({
      x: MARK_TILE_PADDING,
      y: MARK_TILE_PADDING,
      width: INNER,
      height: INNER,
    });
    expect(plan).toMatchObject({ width: MARK_TILE_SIZE, height: MARK_TILE_SIZE });
  });

  it('lays distinct marks on a near-square grid of tiles', () => {
    const marks = [1, 2, 3, 4, 5].map((size) => `<svg viewBox="0 0 ${size} ${size}"></svg>`);
    const plan = planMarkTiles(marks);

    // Five tiles: three columns, two rows, the last row half empty.
    expect(plan).toMatchObject({ width: MARK_TILE_SIZE * 3, height: MARK_TILE_SIZE * 2 });
    expect(plan.entries[4]).toMatchObject({ column: 1, row: 1 });
    expect(plan.entries[4]?.rect).toMatchObject({
      x: MARK_TILE_SIZE + MARK_TILE_PADDING,
      y: MARK_TILE_SIZE + MARK_TILE_PADDING,
    });
  });

  it('keeps neighboring rectangles two gutters apart, so mip levels do not bleed between marks', () => {
    const plan = planMarkTiles([TRIANGLE, SQUARE]);
    const [left, right] = plan.entries;

    if (!left || !right) throw new Error('both marks should have tiles');

    // Both boxes are square, so each rectangle fills its tile's inner
    // square, and the gap between them is exactly the two gutters.
    expect(right.rect.x - (left.rect.x + left.rect.width)).toBe(MARK_TILE_PADDING * 2);
    expect(left.rect.x).toBe(MARK_TILE_PADDING);
    expect(plan.width - (right.rect.x + right.rect.width)).toBe(MARK_TILE_PADDING);
  });

  it('gives identical markup one tile, so a repeated entry decodes once', () => {
    const plan = planMarkTiles([TRIANGLE, SQUARE, TRIANGLE]);

    expect(plan.tiles).toHaveLength(2);
    expect(plan.entries[2]).toBe(plan.entries[0]);
    expect(plan).toMatchObject({ width: MARK_TILE_SIZE * 2, height: MARK_TILE_SIZE });
  });

  it('lists the tiles in first-seen order, which is the order the decode draws them', () => {
    const plan = planMarkTiles([SQUARE, TRIANGLE, SQUARE]);

    expect(plan.tiles.map((tile) => tile.markup)).toEqual([SQUARE, TRIANGLE]);
  });

  it('plans no tiles and a zero-size atlas for no marks', () => {
    expect(planMarkTiles([])).toEqual({ width: 0, height: 0, tiles: [], entries: [] });
  });

  it('gives markup with no viewBox no tile, so its cells draw nothing', () => {
    const plan = planMarkTiles([NO_BOX, SQUARE]);

    expect(plan.entries[0]).toBeNull();
    expect(plan.tiles).toHaveLength(1);
    expect(plan.entries[1]).toMatchObject({ column: 0, row: 0 });
  });
});

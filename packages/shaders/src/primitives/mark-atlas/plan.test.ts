import { describe, expect, it } from 'vitest';

import {
  MARK_TILE_MAX_MIP_LEVEL,
  MARK_TILE_PADDING,
  MARK_TILE_SIZE,
  planMarkTiles,
} from './plan.js';

const TRIANGLE =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 2 22 22H2z"/></svg>';
const SQUARE = '<svg viewBox="0 0 10 10"><rect width="10" height="10"/></svg>';
const COMMA_BOX = "<svg viewBox='0, 0, 16, 16'><circle cx='8' cy='8' r='8'/></svg>";
const WIDE = '<svg viewBox="0 0 48 24"><ellipse cx="24" cy="12" rx="24" ry="12"/></svg>';
const TALL = '<svg viewBox="0 0 10 30"><rect width="10" height="30"/></svg>';
const SIZED = '<svg width="24" height="24"><rect width="24" height="24"/></svg>';
const SIZED_PX = '<svg width="32px" height="16px"><rect width="32" height="16"/></svg>';
const SIZED_EM = '<svg width="2em" height="2em"><rect width="2" height="2"/></svg>';
const NO_BOX = '<svg><rect width="10" height="10"/></svg>';
const DATA_SIZED = '<svg data-width="24" data-height="24"><rect width="24" height="24"/></svg>';
const BAD_VIEW_BOX =
  '<svg viewBox="bad" width="24" height="24"><rect width="24" height="24"/></svg>';
const NOT_SVG = '<div>not an svg</div>';

// The inner square a box is fitted into, once the mip gutter is taken off
// both sides of the tile.
const INNER = MARK_TILE_SIZE - MARK_TILE_PADDING * 2;

// The plan is the pure step between markup strings and the atlas: it reads
// each mark's box and decides where in one shared texture the mark will be
// drawn. Nothing here touches an image, so it runs in plain Vitest.
describe('planMarkTiles', () => {
  it('reads the box from the viewBox', () => {
    const plan = planMarkTiles([TRIANGLE]);

    expect(plan.entries[0]).toMatchObject({ box: { width: 24, height: 24 } });
  });

  it('accepts a comma-separated, single-quoted viewBox', () => {
    expect(planMarkTiles([COMMA_BOX]).entries[0]).toMatchObject({ box: { width: 16, height: 16 } });
  });

  it('falls back to width and height when there is no viewBox, with or without px', () => {
    const plan = planMarkTiles([SIZED, SIZED_PX]);

    expect(plan.entries[0]).toMatchObject({ box: { width: 24, height: 24 } });
    expect(plan.entries[1]).toMatchObject({ box: { width: 32, height: 16 } });
  });

  it('fits a square box into the first tile, inside the padding', () => {
    const plan = planMarkTiles([SQUARE]);
    const tile = plan.entries[0];

    expect(tile).toMatchObject({ column: 0, row: 0 });
    expect(tile).toMatchObject({
      rect: { x: MARK_TILE_PADDING, y: MARK_TILE_PADDING, width: INNER, height: INNER },
    });
    expect(plan).toMatchObject({ width: MARK_TILE_SIZE, height: MARK_TILE_SIZE });
  });

  it('keeps a non-square box at its aspect, longer side filling the frame, centered', () => {
    const plan = planMarkTiles([WIDE, TALL]);

    // 48x24 scales to 96x48 and sits 24 down from the frame's top.
    expect(plan.entries[0]).toMatchObject({
      rect: {
        x: MARK_TILE_PADDING,
        y: MARK_TILE_PADDING + INNER / 4,
        width: INNER,
        height: INNER / 2,
      },
    });
    // 10x30 scales to 32x96 and sits 32 in from the frame's left, in tile 1.
    expect(plan.entries[1]).toMatchObject({
      rect: {
        x: MARK_TILE_SIZE + MARK_TILE_PADDING + INNER / 3,
        y: MARK_TILE_PADDING,
        width: INNER / 3,
        height: INNER,
      },
    });
  });

  it('states each tile frame, the inner square the shader maps the dotSize box onto', () => {
    const plan = planMarkTiles([WIDE]);

    expect(plan.entries[0]).toMatchObject({
      frame: { x: MARK_TILE_PADDING, y: MARK_TILE_PADDING, width: INNER, height: INNER },
    });
  });

  it('lays distinct marks on a near-square grid of tiles', () => {
    const marks = [1, 2, 3, 4, 5].map((size) => `<svg viewBox="0 0 ${size} ${size}"></svg>`);
    const plan = planMarkTiles(marks);

    // Five tiles: three columns, two rows, the last row half empty.
    expect(plan).toMatchObject({ width: MARK_TILE_SIZE * 3, height: MARK_TILE_SIZE * 2 });
    expect(plan.entries[4]).toMatchObject({ column: 1, row: 1 });
    expect(plan.entries[4]).toMatchObject({
      rect: { x: MARK_TILE_SIZE + MARK_TILE_PADDING, y: MARK_TILE_SIZE + MARK_TILE_PADDING },
    });
  });

  it('keeps neighboring rectangles two gutters apart', () => {
    const plan = planMarkTiles([TRIANGLE, SQUARE]);
    const [left, right] = plan.entries;

    if (!left || !right || !('rect' in left) || !('rect' in right)) {
      throw new Error('both marks should have tiles');
    }

    // Both boxes are square, so each rectangle fills its tile's inner
    // square, and the gap between them is exactly the two gutters.
    expect(right.rect.x - (left.rect.x + left.rect.width)).toBe(MARK_TILE_PADDING * 2);
    expect(left.rect.x).toBe(MARK_TILE_PADDING);
    expect(plan.width - (right.rect.x + right.rect.width)).toBe(MARK_TILE_PADDING);
  });

  it('caps the mip level at the one whose half-texel is the gutter', () => {
    // The shader clamps its reads here; the gutter is what makes that level
    // safe, so the two must move together.
    expect(2 ** MARK_TILE_MAX_MIP_LEVEL).toBe(MARK_TILE_PADDING * 2);
    expect(Number.isInteger(MARK_TILE_MAX_MIP_LEVEL)).toBe(true);
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
    expect(planMarkTiles([])).toEqual({
      width: 0,
      height: 0,
      tiles: [],
      entries: [],
      rejections: [],
    });
  });

  it('rejects markup with no box, with the reason, and gives it no tile', () => {
    const plan = planMarkTiles([NO_BOX, SQUARE, SIZED_EM]);

    expect(plan.entries[0]).toEqual({ markup: NO_BOX, reason: 'no-box' });
    expect(plan.entries[2]).toEqual({ markup: SIZED_EM, reason: 'no-box' });
    expect(plan.tiles).toHaveLength(1);
    expect(plan.entries[1]).toMatchObject({ column: 0, row: 0 });
  });

  it('does not read data-width as width, and does not fall back past a viewBox that is present but unreadable', () => {
    const plan = planMarkTiles([DATA_SIZED, BAD_VIEW_BOX]);

    expect(plan.entries[0]).toEqual({ markup: DATA_SIZED, reason: 'no-box' });
    expect(plan.entries[1]).toEqual({ markup: BAD_VIEW_BOX, reason: 'no-box' });
    expect(plan.tiles).toHaveLength(0);
  });

  it('rejects markup with no svg element, with its own reason', () => {
    const plan = planMarkTiles([NOT_SVG]);

    expect(plan.entries[0]).toEqual({ markup: NOT_SVG, reason: 'no-svg-element' });
  });

  it('lists each distinct rejection once, in first-seen order, for the component to warn from', () => {
    const plan = planMarkTiles([NO_BOX, NOT_SVG, NO_BOX]);

    expect(plan.rejections).toEqual([
      { markup: NO_BOX, reason: 'no-box' },
      { markup: NOT_SVG, reason: 'no-svg-element' },
    ]);
  });
});

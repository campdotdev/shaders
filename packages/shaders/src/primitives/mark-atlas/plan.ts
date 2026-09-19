// The pure half of the custom-mark atlas: given the SVG markup strings a
// dot field wants to draw, decide where each mark lands in one shared
// texture. The browser decode (./atlas.ts) draws the tiles this plan lays
// out, and DotField's shader reads them back through the rectangles it
// returns. No DOM and no image here, so this runs in plain Vitest.

/**
 * Inline SVG markup for a custom mark: the full `<svg>` element as text,
 * including its `viewBox`, which is the box the mark is scaled from. Only
 * the mark's alpha is read, so its fills do not matter and the mark takes
 * the field's `color`.
 */
export type SvgMarkup = string;

// ---------------------------------------------
// Tile geometry
// ---------------------------------------------
// The side of one tile in device pixels, so a mark is decoded once at this
// size and sampled from there at whatever `dotSize` asks for. Raising it
// keeps a large mark crisp for longer at the cost of atlas memory, which
// grows with the square of it; lowering it saves memory and softens a mark
// sooner. The mark fills the tile inside its gutter, 96 device pixels for
// the values below, and a mark drawn larger than that on screen is
// magnified from it, so its edge softens past 96 device pixels.
export const MARK_TILE_SIZE = 128;

// The transparent gutter on each side of a tile, in device pixels. The
// atlas is sampled with mipmaps, where each level averages a 2x2 block of
// the level above into one texel, so at level n a texel covers 2^n device
// pixels of the tile. The sampler blends the texel under the sample point
// with its neighbors, reaching half a texel each way, and a sample near a
// mark's edge would pull in the next tile's edge texel where the neighbor
// mark sits. With this gutter, a sample anywhere inside a mark's rectangle
// stays at least a gutter from the tile boundary, so no blend reaches a
// neighbor at any level whose half-texel is within the gutter: that is
// every level up to MARK_TILE_MAX_MIP_LEVEL, and the shader clamps its
// reads there. Wider protects deeper levels at the cost of mark
// resolution, since the mark fills what the gutter leaves.
export const MARK_TILE_PADDING = 16;

// The deepest mip level a read may use: the one whose half-texel equals
// the gutter, so the sampler's blend never crosses into a neighbor. At
// this level a texel is 2 * padding device pixels wide, and the inner
// square holds (tile - 2 * padding) / (2 * padding) texels, three for the
// values above, which is about the size in device pixels below which a
// mark is minified from this level rather than a finer one and starts to
// shimmer as it moves. 16 gives level 5, which covers the default dotSize
// of 3 on a 1x display exactly.
export const MARK_TILE_MAX_MIP_LEVEL = Math.log2(MARK_TILE_PADDING * 2);

/** The mark's own coordinate box, in the units its markup uses. */
export interface MarkBox {
  width: number;
  height: number;
}

/** A rectangle in the atlas, in device pixels, measured from the top-left. */
export interface AtlasRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** One decoded mark's place in the atlas. Entries with the same markup share one. */
export interface MarkTile {
  markup: SvgMarkup;
  box: MarkBox;
  /** Which tile of the grid, counted from the top-left. */
  column: number;
  row: number;
  /**
   * Where the box lands inside the tile: scaled to fit the tile inside its
   * padding, keeping its aspect, and centered.
   */
  rect: AtlasRect;
}

export interface MarkTilePlan {
  /** Atlas size in device pixels. Both are 0 when there are no tiles. */
  width: number;
  height: number;
  /** One tile per distinct markup with a usable box, in first-seen order. */
  tiles: readonly MarkTile[];
  /**
   * Per input entry, the tile it draws from, or null for markup with no
   * usable box, whose cells draw nothing.
   */
  entries: ReadonlyArray<MarkTile | null>;
}

/**
 * Lays the marks out on a near-square grid of tiles. Identical markup maps
 * to one tile, so a repeated entry costs one decode, and the grid is as
 * square as the count allows, so a long list does not make a texture that
 * is wide and one tile tall.
 */
export function planMarkTiles(markups: readonly SvgMarkup[]): MarkTilePlan {
  // First pass: the distinct markups with a box, in the order first seen,
  // and each markup's index into that list. Markup with no box maps to
  // null. The grid position waits for the second pass, because the column
  // count depends on how many boxes there are.
  const boxes: Array<{ markup: SvgMarkup; box: MarkBox }> = [];
  const indexByMarkup = new Map<SvgMarkup, number | null>();

  for (const markup of markups) {
    if (indexByMarkup.has(markup)) continue;

    const box = readMarkBox(markup);

    if (box === null) {
      indexByMarkup.set(markup, null);
      continue;
    }

    indexByMarkup.set(markup, boxes.length);
    boxes.push({ markup, box });
  }

  if (boxes.length === 0)
    return { width: 0, height: 0, tiles: [], entries: markups.map(() => null) };

  // Second pass: the grid. ceil(sqrt(n)) columns is the narrowest grid that
  // is no taller than it is wide, and the row count is what those columns
  // need to hold every tile.
  const columns = Math.ceil(Math.sqrt(boxes.length));
  const rows = Math.ceil(boxes.length / columns);

  const tiles = boxes.map(({ markup, box }, index): MarkTile => {
    const column = index % columns;
    const row = Math.floor(index / columns);

    return { markup, box, column, row, rect: fitBox(box, column, row) };
  });

  return {
    width: columns * MARK_TILE_SIZE,
    height: rows * MARK_TILE_SIZE,
    tiles,
    entries: markups.map((markup) => {
      const index = indexByMarkup.get(markup);

      return index === null || index === undefined ? null : (tiles[index] ?? null);
    }),
  };
}

// ---------------------------------------------
// Reading the box
// ---------------------------------------------
// The root `<svg>` element's opening tag, up to its first `>`, which is
// where its attributes are. Case-insensitive because SVG served as HTML is.
const SVG_OPEN_TAG = /<svg\b[^>]*>/i;

// `viewBox="min-x min-y width height"`, with either quote and with spaces
// or commas between the numbers, both of which SVG allows. Only the last
// two numbers are the size; the origin is where the drawing starts, and
// the decode hands the whole viewBox to the browser unchanged.
const VIEW_BOX_ATTRIBUTE =
  /\bviewBox\s*=\s*(["'])\s*[-+\d.eE]+[\s,]+[-+\d.eE]+[\s,]+([-+\d.eE]+)[\s,]+([-+\d.eE]+)\s*\1/;

/**
 * The mark's box from its `viewBox`, or null when there is none. The
 * `width` and `height` fallback and the warning for markup with neither
 * are the next ticket's; here a missing box just means no tile.
 */
function readMarkBox(markup: SvgMarkup): MarkBox | null {
  const openTag = SVG_OPEN_TAG.exec(markup)?.[0];

  if (openTag === undefined) return null;

  const viewBox = VIEW_BOX_ATTRIBUTE.exec(openTag);

  if (viewBox === null) return null;

  const width = Number(viewBox[2]);
  const height = Number(viewBox[3]);

  if (!(width > 0) || !(height > 0)) return null;

  return { width, height };
}

// ---------------------------------------------
// Fitting the box into a tile
// ---------------------------------------------
// The box scales uniformly until its longer side fills the tile inside the
// padding, so the mark keeps its aspect, and the shorter side is centered
// in the leftover. A square box, the case this ticket covers, fills the
// inner square exactly.
function fitBox(box: MarkBox, column: number, row: number): AtlasRect {
  const inner = MARK_TILE_SIZE - MARK_TILE_PADDING * 2;
  const scale = inner / Math.max(box.width, box.height);
  const width = box.width * scale;
  const height = box.height * scale;

  return {
    x: column * MARK_TILE_SIZE + (MARK_TILE_SIZE - width) / 2,
    y: row * MARK_TILE_SIZE + (MARK_TILE_SIZE - height) / 2,
    width,
    height,
  };
}

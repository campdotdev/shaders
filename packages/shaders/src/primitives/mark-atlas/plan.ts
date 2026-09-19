// The pure half of the custom-mark atlas: given the SVG markup strings a
// dot field wants to draw, decide where each mark lands in one shared
// texture, or say why it cannot. The browser decode (./atlas.ts) draws the
// tiles this plan lays out, and DotField's shader reads them back through
// the frames it returns. No DOM and no image here, so this runs in plain
// Vitest.

/**
 * Inline SVG markup for a custom mark: the full `<svg>` element as text.
 * Its `viewBox` is the box the mark is scaled from, and `width` and
 * `height` stand in when there is no `viewBox`, as plain numbers or with
 * `px`. Markup with neither, or with no `<svg>` element, is rejected: one
 * console warning, and its cells draw nothing. Only the mark's alpha is
 * read, so its fills do not matter and the mark takes the field's `color`.
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
// pixels of the tile. The tile side is a power of two, so at every level
// the texel grid lines up with the tile boundaries, and the outermost
// texel of a tile has its center half a texel, 2^(n-1) device pixels,
// inside the boundary. The sampler blends between the centers of the
// texels around the sample point, so a sample that sits at or inside the
// outermost texel's center gives the next tile's texels no weight at all.
// A sample anywhere in a mark's frame is at least a gutter from the
// boundary, so the gutter protects every level whose half-texel is no
// wider than it: up to MARK_TILE_MAX_MIP_LEVEL, where the shader clamps
// its reads. Wider protects deeper levels at the cost of mark resolution,
// since the mark fills what the gutter leaves.
export const MARK_TILE_PADDING = 16;

// The deepest mip level a read may use: the one whose half-texel equals
// the gutter, so a blend never reaches a neighbor. At this level a texel
// is 2 * padding device pixels wide, and the inner square holds
// (tile - 2 * padding) / (2 * padding) texels, three for the values
// above, which is the size in device pixels below which a mark would
// want a coarser level than this and is instead minified from it, so it
// shimmers a little as it moves. 16 gives level 5, which is exactly the
// level the default dotSize of 3 wants on a 1x display.
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
   * The tile's inner square, inside the gutter. The shader maps the
   * `dotSize` box onto this, so a mark's aspect and centering on screen
   * are whatever they are inside it.
   */
  frame: AtlasRect;
  /**
   * Where the box lands inside the frame: scaled to fit it, keeping its
   * aspect, and centered. What the decode draws the SVG into.
   */
  rect: AtlasRect;
}

/** Why markup got no tile. */
export type MarkRejectionReason = 'no-svg-element' | 'no-box';

/** Markup the plan could not place, with the reason, for the caller to warn from. */
export interface MarkRejection {
  markup: SvgMarkup;
  reason: MarkRejectionReason;
}

export interface MarkTilePlan {
  /** Atlas size in device pixels. Both are 0 when there are no tiles. */
  width: number;
  height: number;
  /** One tile per distinct markup with a usable box, in first-seen order. */
  tiles: readonly MarkTile[];
  /** Per input entry, the tile it draws from, or its rejection. */
  entries: ReadonlyArray<MarkTile | MarkRejection>;
  /** Each distinct rejected markup once, in first-seen order. */
  rejections: readonly MarkRejection[];
}

/**
 * Lays the marks out on a near-square grid of tiles. Identical markup maps
 * to one tile, so a repeated entry costs one decode, and the grid is as
 * square as the count allows, so a long list does not make a texture that
 * is wide and one tile tall.
 */
export function planMarkTiles(markups: readonly SvgMarkup[]): MarkTilePlan {
  // First pass: the distinct markups with a box, in the order first seen,
  // and each markup's index into that list, or its rejection. The grid
  // position waits for the second pass, because the column count depends
  // on how many boxes there are.
  const boxes: Array<{ markup: SvgMarkup; box: MarkBox }> = [];
  const rejections: MarkRejection[] = [];
  const placement = new Map<SvgMarkup, number | MarkRejection>();

  for (const markup of markups) {
    if (placement.has(markup)) continue;

    const read = readMarkBox(markup);

    if ('reason' in read) {
      const rejection = { markup, reason: read.reason };

      placement.set(markup, rejection);
      rejections.push(rejection);
      continue;
    }

    placement.set(markup, boxes.length);
    boxes.push({ markup, box: read.box });
  }

  // Second pass: the grid. ceil(sqrt(n)) columns is the narrowest grid that
  // is no taller than it is wide, and the row count is what those columns
  // need to hold every tile.
  const columns = Math.ceil(Math.sqrt(boxes.length));
  const rows = columns === 0 ? 0 : Math.ceil(boxes.length / columns);

  const tiles = boxes.map(({ markup, box }, index): MarkTile => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const frame = tileFrame(column, row);

    return { markup, box, column, row, frame, rect: fitBox(box, frame) };
  });

  return {
    width: columns * MARK_TILE_SIZE,
    height: rows * MARK_TILE_SIZE,
    tiles,
    entries: markups.map((markup): MarkTile | MarkRejection => {
      const placed = placement.get(markup);
      const entry = typeof placed === 'number' ? tiles[placed] : placed;

      if (entry === undefined) throw new Error('every markup was placed in the first pass');

      return entry;
    }),
    rejections,
  };
}

// ---------------------------------------------
// Reading the box
// ---------------------------------------------
// The root `<svg>` element's opening tag, up to its first unquoted `>`,
// which is where its attributes are. A quoted attribute may contain `>`
// without ending the tag, so each quoted value is consumed as one unit.
// Case-insensitive because SVG served as HTML is.
const SVG_OPEN_TAG = /<svg\b(?:[^>"']|"[^"]*"|'[^']*')*>/i;

// Each attribute is matched as a whole name: the lookbehind refuses a
// letter, digit, or hyphen before it, so `data-width` is not `width`.
// Whether a viewBox is present at all is checked separately from whether
// it parses, because a viewBox that is there but unreadable must not fall
// back to width and height: the decode hands an existing viewBox to the
// browser unchanged, so the two halves have to agree on which box is
// meant.
const HAS_VIEW_BOX = /(?<![\w-])viewBox\s*=/;

// `viewBox="min-x min-y width height"`, with either quote and with spaces
// or commas between the numbers, both of which SVG allows. Only the last
// two numbers are the size; the origin is where the drawing starts.
const VIEW_BOX_ATTRIBUTE =
  /(?<![\w-])viewBox\s*=\s*(["'])\s*[-+\d.eE]+[\s,]+[-+\d.eE]+[\s,]+([-+\d.eE]+)[\s,]+([-+\d.eE]+)\s*\1/;

// `width="24"` or `width="24px"`. Those are the two forms supported as a
// box; a value in any other unit, such as em, %, or cm, is not read.
const WIDTH_ATTRIBUTE = /(?<![\w-])width\s*=\s*(["'])\s*([-+\d.eE]+)(?:px)?\s*\1/;
const HEIGHT_ATTRIBUTE = /(?<![\w-])height\s*=\s*(["'])\s*([-+\d.eE]+)(?:px)?\s*\1/;

/**
 * The mark's box from its `viewBox`, or from `width` and `height` when
 * there is no `viewBox` at all, or the reason there is neither.
 */
function readMarkBox(markup: SvgMarkup): { box: MarkBox } | { reason: MarkRejectionReason } {
  const openTag = SVG_OPEN_TAG.exec(markup)?.[0];

  if (openTag === undefined) return { reason: 'no-svg-element' };

  const viewBox = VIEW_BOX_ATTRIBUTE.exec(openTag);
  const box = HAS_VIEW_BOX.test(openTag)
    ? toBox(viewBox?.[2], viewBox?.[3])
    : toBox(WIDTH_ATTRIBUTE.exec(openTag)?.[2], HEIGHT_ATTRIBUTE.exec(openTag)?.[2]);

  return box === null ? { reason: 'no-box' } : { box };
}

function toBox(width: string | undefined, height: string | undefined): MarkBox | null {
  const parsedWidth = Number(width);
  const parsedHeight = Number(height);

  if (!(parsedWidth > 0) || !(parsedHeight > 0)) return null;

  return { width: parsedWidth, height: parsedHeight };
}

// ---------------------------------------------
// Fitting the box into a tile
// ---------------------------------------------
// The tile's inner square: the tile with the gutter taken off every side.
function tileFrame(column: number, row: number): AtlasRect {
  const inner = MARK_TILE_SIZE - MARK_TILE_PADDING * 2;

  return {
    x: column * MARK_TILE_SIZE + MARK_TILE_PADDING,
    y: row * MARK_TILE_SIZE + MARK_TILE_PADDING,
    width: inner,
    height: inner,
  };
}

// The box scales uniformly until its longer side fills the frame, so the
// mark keeps its aspect, and the shorter side is centered in the leftover.
// A square box fills the frame exactly.
function fitBox(box: MarkBox, frame: AtlasRect): AtlasRect {
  const scale = frame.width / Math.max(box.width, box.height);
  const width = box.width * scale;
  const height = box.height * scale;

  return {
    x: frame.x + (frame.width - width) / 2,
    y: frame.y + (frame.height - height) / 2,
    width,
    height,
  };
}

import type { Page } from '@playwright/test';

import { expect, test } from './fixtures';
import { readCanvasPixels, waitForShader } from './helpers';

test('PaletteMap — default story', async ({ page }) => {
  await page.goto('/components/palette-map?visualTest=1');
  await waitForShader(page);
  // Every cell is one flat palette color, so a SwiftShader precision wobble
  // near a band edge flips whole cells, as on Dither. Allow the same drift.
  await expect(page.locator('canvas').first()).toHaveScreenshot('palette-map-default.png', {
    maxDiffPixelRatio: 0.05,
  });
});

// The probe maps a gray noise field onto six colors under an LED wall whose
// cells match the map's, 8 CSS pixels apart, which is 8 device pixels at the
// config's deviceScaleFactor of 1. Each dot is 7 pixels wide and starts half
// a pixel into its cell. ?spread= sets the map's spread.
const PROBE = '/dev/palette-map-probe?visualTest=1';
const SPACING = 8;
const PALETTE_SIZE = 6;
// Pixels inside each dot, as offsets from the cell's top-left corner: its
// center and two opposite corners, each more than the dot's anti-aliased rim
// from the edge.
const DOT_OFFSETS = [
  [4, 4],
  [1, 1],
  [6, 6],
] as const;
// The most two channels of one palette color may differ, out of 255. The
// output stage's anti-banding dither moves each channel by about 1.
const SAME_COLOR = 6;
// The least share of cells a spread of 0.5 must scatter, and how many times
// the share at spread 0 it must reach. They measured 0.034 and 0.0005 on
// macOS, about 66 times apart, so both bounds leave room for another GPU.
const MIN_SCATTERED = 0.01;
const MIN_SCATTER_RATIO = 10;

type Rgb = readonly [number, number, number];

const sameColor = (first: Rgb, second: Rgb) =>
  first.every((channel, index) => Math.abs(channel - (second[index] ?? 0)) <= SAME_COLOR);

/**
 * Loads the probe with `query` appended and returns each LED cell's color,
 * as an index into the distinct colors found, row by row. Throws if a dot
 * holds more than one color.
 */
async function loadCells(page: Page, query: string): Promise<{ cells: number[][]; colors: Rgb[] }> {
  await page.goto(`${PROBE}${query}`);
  await page.locator('canvas').first().waitFor();
  await waitForShader(page);

  const { width, height, rgb } = await readCanvasPixels(page);
  const colors: Rgb[] = [];
  const cells: number[][] = [];

  for (let row = 0; (row + 1) * SPACING <= height; row += 1) {
    const line: number[] = [];

    for (let column = 0; (column + 1) * SPACING <= width; column += 1) {
      const samples = DOT_OFFSETS.map(([x, y]) => rgb(column * SPACING + x, row * SPACING + y));
      const [center] = samples;

      if (center === undefined || !samples.every((sample) => sameColor(sample, center))) {
        throw new Error(`The dot in row ${row}, column ${column} holds more than one color.`);
      }
      let index = colors.findIndex((color) => sameColor(color, center));

      if (index === -1) index = colors.push(center) - 1;
      line.push(index);
    }
    cells.push(line);
  }

  return { cells, colors };
}

/**
 * The share of cells whose color differs from all four of their neighbors.
 * Clean bands have almost none: a cell on a band edge shares its color with
 * the cells along the edge. A dither scatters single cells across the edge.
 */
function scatteredShare(cells: number[][]): number {
  let inner = 0;
  let scattered = 0;

  for (let row = 1; row < cells.length - 1; row += 1) {
    for (let column = 1; column < (cells[row]?.length ?? 0) - 1; column += 1) {
      const color = cells[row]?.[column];
      const neighbors = [
        cells[row - 1]?.[column],
        cells[row + 1]?.[column],
        cells[row]?.[column - 1],
        cells[row]?.[column + 1],
      ];

      inner += 1;
      if (neighbors.every((neighbor) => neighbor !== color)) scattered += 1;
    }
  }

  return scattered / inner;
}

test('PaletteMap — each LED dot shows exactly one palette color', async ({ page }) => {
  // loadCells already fails on a dot with two colors. A blend between two
  // palette colors would add colors past the palette's six.
  const { colors } = await loadCells(page, '');

  expect(colors.length).toBeLessThanOrEqual(PALETTE_SIZE);
});

test('PaletteMap — spread scatters cells across band edges', async ({ page }) => {
  const clean = scatteredShare((await loadCells(page, '&spread=0')).cells);
  const dithered = scatteredShare((await loadCells(page, '&spread=0.5')).cells);

  expect(dithered).toBeGreaterThan(MIN_SCATTERED);
  expect(dithered).toBeGreaterThan(clean * MIN_SCATTER_RATIO);
});

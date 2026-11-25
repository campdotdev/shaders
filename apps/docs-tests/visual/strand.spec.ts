import type { Page } from '@playwright/test';

import { expect, test } from './fixtures';
import { readCanvasPixels, waitForShader } from './helpers';

// The strand primitives (SHA-331) on their probe route, which draws them the
// way a Mode 2 user does: the engine's renderer, a plain three scene, and
// materials from useShaderMaterial. The probe's perspective view lays the
// strands out in depth, one behind the next, with a ball in the middle of
// them. Headless Chromium runs the WebGL2 fallback, so this is the check
// that vertex-stage strands draw there.
const PROBE = '/dev/strand-probe?visualTest=1';
const PERSPECTIVE = `${PROBE}&camera=perspective`;

// The pixel checks draw 12 strands 8 CSS pixels thick, so each is a band
// about 5 pixels tall that a column of pixels can count and measure.
const MEASURED = '&strands=12&strandWidth=8';
const STRANDS = 12;

/**
 * Loads the probe at `url`, waits for its held frame, and checks that it
 * drew on the WebGL2 fallback. A runner that gains WebGPU then fails here,
 * and can't drop the fallback's coverage unnoticed.
 */
async function loadProbe(page: Page, url: string): Promise<void> {
  await page.goto(url);
  await page.locator('canvas').first().waitFor();
  await waitForShader(page);

  const backend = await page.evaluate(
    () => (window as unknown as { __shadersBackend?: string }).__shadersBackend,
  );

  expect(backend).toBe('webgl2');
}

test('Strands — perspective view with a ball among them', async ({ page }) => {
  await loadProbe(page, PERSPECTIVE);
  await expect(page.locator('canvas').first()).toHaveScreenshot('strand-probe.png');
});

/** One strand where it crosses a column of pixels: its top row and how many rows tall it is. */
interface Band {
  top: number;
  height: number;
}

/** What the middle column of the canvas shows, from the top of the canvas down. */
interface MiddleColumn {
  /** The strands the column crosses. The furthest strand comes first in the perspective view. */
  bands: Band[];
  /** The first and last rows that show the ball, or null when the column misses it. */
  ball: { top: number; bottom: number } | null;
}

/**
 * Loads the probe at `url` and reads the middle column of its canvas. The
 * strands are blue and the ball is a dull red, over black. A row is strand
 * where blue passes 110 of 255, which the ball (about 48) and the black
 * background never reach, and ball where red leads blue by 30.
 */
async function middleColumn(page: Page, url: string): Promise<MiddleColumn> {
  await loadProbe(page, url);

  const { width, height, rgb } = await readCanvasPixels(page);
  const x = Math.floor(width / 2);
  const bands: Band[] = [];
  const ballRows: number[] = [];
  let top = -1;

  for (let y = 0; y < height; y += 1) {
    const [red, , blue] = rgb(x, y);
    const lit = blue > 110;

    if (lit && top < 0) top = y;
    if (!lit && top >= 0) {
      bands.push({ top, height: y - top });
      top = -1;
    }
    if (red > blue + 30) ballRows.push(y);
  }

  return {
    bands,
    ball: ballRows.length > 0 ? { top: ballRows[0]!, bottom: ballRows.at(-1)! } : null,
  };
}

/** The rows between each band and the next one down. */
const gaps = (bands: Band[]) => bands.slice(1).map((band, index) => band.top - bands[index]!.top);

// A regenerated baseline of a broken build would pass its own screenshot, so
// these checks read what the canvas must show. A blank canvas has no bands
// and fails the first count.

// The flat view spaces its strands evenly, and with no scatter they all ride
// one wave, so a column crosses them at even steps. This is the reference
// the perspective check below departs from.
test('Strands — the flat view spaces its strands evenly', async ({ page }) => {
  const { bands } = await middleColumn(page, `${PROBE}${MEASURED}&scatter=0`);

  expect(bands, 'one band per strand').toHaveLength(STRANDS);

  const steps = gaps(bands);

  expect(
    Math.max(...steps) - Math.min(...steps),
    'spread of the steps, in rows',
  ).toBeLessThanOrEqual(2);
});

// The perspective view's strands sit at even steps in depth. A perspective
// camera draws a far step smaller than a near one, so down the canvas, from
// the furthest strand to the nearest, each step is larger than the one
// before. On macOS the steps ran from 9 rows to 108. A path drawn without
// the camera's projection would keep the flat view's even steps.
test('Strands — the path projects through the perspective camera', async ({ page }) => {
  const { bands } = await middleColumn(page, `${PERSPECTIVE}${MEASURED}&mesh=0`);

  expect(bands, 'one band per strand').toHaveLength(STRANDS);

  const steps = gaps(bands);

  for (let index = 1; index < steps.length; index += 1) {
    expect(steps[index], `step ${index} against the one before`).toBeGreaterThan(steps[index - 1]!);
  }
  expect(steps.at(-1), 'nearest step against furthest').toBeGreaterThan(steps[0]! * 4);
});

// The same strands again: the nearest is about 3 units from the camera and
// the furthest about 12, and both are 8 CSS pixels thick. The page loads at
// one canvas pixel per CSS pixel, and a band is the part of the strand's
// falloff bright enough to count, so it is at most 8 rows tall. On macOS
// every band was 4 or 5 rows. A strand widened in 3D, as an ordinary mesh
// is, would draw the nearest nearly four times as thick as the furthest.
test('Strands — a strand keeps its width in CSS pixels near and far', async ({ page }) => {
  const { bands } = await middleColumn(page, `${PERSPECTIVE}${MEASURED}&mesh=0`);

  expect(bands, 'one band per strand').toHaveLength(STRANDS);

  const heights = bands.map((band) => band.height);

  expect(Math.max(...heights) - Math.min(...heights), 'spread of band heights').toBeLessThanOrEqual(
    2,
  );
  expect(Math.min(...heights), 'thinnest band').toBeGreaterThanOrEqual(3);
  expect(Math.max(...heights), 'thickest band against strandWidth').toBeLessThanOrEqual(8);
});

/**
 * Loads the flat view with one strand `strandWidth` CSS pixels thick and
 * returns the brightest blue in the middle column, 0 to 255, and how many
 * rows are at least half that bright.
 */
async function strandCrossSection(page: Page, strandWidth: number) {
  await loadProbe(page, `${PROBE}&strands=1&scatter=0&strandWidth=${strandWidth}`);

  const { width, height, rgb } = await readCanvasPixels(page);
  const x = Math.floor(width / 2);
  const column = Array.from({ length: height }, (_, y) => rgb(x, y)[2]);
  const peak = Math.max(...column);

  return { peak, rows: column.filter((blue) => blue >= peak / 2).length };
}

// strandProfile's floor. A strand can't be drawn thinner than 3 CSS pixels,
// so one asked to be 1 pixel thick draws as wide as one asked to be 3, and
// a third as bright in light, which is a little over half as bright once
// encoded for the display. On macOS the peak fell from about 190 levels to
// about 116. Without the floor, the thin strand would be a third the width
// and as bright.
test('Strands — a strand too thin to draw dims and keeps its width', async ({ page }) => {
  const drawable = await strandCrossSection(page, 3);
  const thin = await strandCrossSection(page, 1);

  expect(drawable.peak, 'a 3-pixel strand is lit').toBeGreaterThan(120);
  expect(thin.peak, 'thin peak against drawable peak').toBeLessThan(drawable.peak - 40);
  expect(thin.peak, 'the thin strand still draws').toBeGreaterThan(40);
  expect(Math.abs(thin.rows - drawable.rows), 'rows at half brightness').toBeLessThanOrEqual(1);
});

// The ball sits among the strands. The middle column runs down through it,
// so the strands behind the ball are missing from the rows it covers, and a
// strand in front still draws over it. Strands the ball doesn't reach are
// where they were without it. On macOS the ball hid 7 strands and 1 drew
// over it.
test('Strands — the ball hides the strands behind it', async ({ page }) => {
  const open = await middleColumn(page, `${PERSPECTIVE}${MEASURED}&mesh=0`);
  const withBall = await middleColumn(page, `${PERSPECTIVE}${MEASURED}`);
  const ball = withBall.ball;

  expect(open.bands, 'one band per strand without the ball').toHaveLength(STRANDS);
  expect(ball, 'the column crosses the ball').not.toBeNull();
  if (!ball) return;

  const drawn = (band: Band) => withBall.bands.some((other) => Math.abs(other.top - band.top) <= 1);
  const overBall = open.bands.filter((band) => band.top >= ball.top && band.top <= ball.bottom);
  const hidden = overBall.filter((band) => !drawn(band));
  const inFront = overBall.filter(drawn);
  const clear = open.bands.filter((band) => band.top > ball.bottom);

  expect(hidden.length, 'strands hidden behind the ball').toBeGreaterThanOrEqual(3);
  expect(inFront.length, 'strands drawn over the ball').toBeGreaterThanOrEqual(1);
  // Further strands are higher up the canvas, so every hidden strand sits
  // above every strand that draws over the ball.
  expect(
    Math.max(...hidden.map((band) => band.top)),
    'lowest hidden strand against highest strand in front',
  ).toBeLessThan(Math.min(...inFront.map((band) => band.top)));
  expect(clear.every(drawn), 'strands below the ball are unchanged').toBe(true);
});

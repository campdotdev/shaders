import type { Page } from '@playwright/test';

import { expect, test } from './fixtures';
import { type CanvasPixels, changedPixels, readCanvasPixels, waitForShader } from './helpers';

// One baseline of the default demo, with the clock paused, on the WebGL2
// fallback that headless Chromium runs. The probe checks below need no
// baseline: they compare loads of /dev/heat-shimmer-probe with each other,
// to check that the shimmer moves the photo, moves with the clock, holds
// still at a speed of 0, and stays inside its band. Which way it rises is a
// check by eye: with the change of shape on, a row-by-row match of two loads
// found the rise at some intervals and missed it at others.

test('HeatShimmer — default story', async ({ page }) => {
  await page.goto('/components/heat-shimmer?visualTest=1');
  await waitForShader(page);

  const backend = await page.evaluate(
    () => (window as unknown as { __shadersBackend?: string }).__shadersBackend,
  );

  expect(backend).toBe('webgl2');
  await expect(page.locator('canvas').first()).toHaveScreenshot('heat-shimmer-default.png');
});

// The shimmer moves the photo at the default strength. This check loads
// the probe twice, once at strength 0, which leaves the photo exactly as it
// is, and once at the default strength, and counts the pixels that differ.
// A shimmer that stops moving the photo changes none of them.
//
// The least number of pixels the shimmer must change. On macOS the default
// strength changed about 355,000 of the 1280 x 720 canvas's 921,600, and two
// loads at strength 0 changed none, so this leaves room for another GPU.
const MIN_CHANGED_PIXELS = 50_000;

test('HeatShimmer — nonzero strength moves the photo', async ({ page }) => {
  const capture = async (query: string) => {
    await page.goto(`/dev/heat-shimmer-probe?visualTest=1${query}`);
    await page.locator('canvas').first().waitFor();
    await waitForShader(page);

    return page.locator('canvas').first().screenshot();
  };
  const still = await capture('&strength=0');
  const shimmering = await capture('');
  const changed = await changedPixels(page, still, shimmering);

  expect(changed).toBeGreaterThan(MIN_CHANGED_PIXELS);
});

// ---------------------------------------------
// Motion: the clock, and a speed of 0
// ---------------------------------------------
// ?phaseTime starts the shimmer's clock that many seconds in, at the probe's
// speed, and the paused policy every visual test loads under holds it there.
// So two loads at different times are two moments of the same motion, and
// neither is a baseline.

/** Loads the probe with `query` added, and returns the canvas's pixels. */
async function probePixels(page: Page, query: string): Promise<CanvasPixels> {
  await page.goto(`/dev/heat-shimmer-probe?visualTest=1${query}`);
  await page.locator('canvas').first().waitFor();
  await waitForShader(page);

  return readCanvasPixels(page);
}

/** How many pixels in pixel row `y` differ between two reads of the canvas, by more than 3 levels summed over red, green, and blue. */
function rowChanged(before: CanvasPixels, after: CanvasPixels, y: number): number {
  let changed = 0;

  for (let x = 0; x < before.width; x++) {
    const [red, green, blue] = before.rgb(x, y);
    const [nextRed, nextGreen, nextBlue] = after.rgb(x, y);

    if (Math.abs(red - nextRed) + Math.abs(green - nextGreen) + Math.abs(blue - nextBlue) > 3) {
      changed++;
    }
  }

  return changed;
}

/** How many pixels differ between two reads of the canvas, as `rowChanged` counts them. */
function pixelsChanged(before: CanvasPixels, after: CanvasPixels): number {
  let changed = 0;

  for (let y = 0; y < before.height; y++) changed += rowChanged(before, after, y);

  return changed;
}

// The clock moves the shimmer: two seconds apart, the rise and the change
// of shape have moved the photo. A clock that no longer reaches the noise
// leaves the two loads identical.
// On macOS two seconds changed about 395,000 of the canvas's 921,600
// pixels.
test('HeatShimmer — the clock moves the photo', async ({ page }) => {
  const start = await probePixels(page, '&phaseTime=0');
  const later = await probePixels(page, '&phaseTime=2');

  expect(pixelsChanged(start, later)).toBeGreaterThan(MIN_CHANGED_PIXELS);
});

// At a speed of 0 the clock never leaves 0, whatever time the load starts
// at, so the warp holds still.
test('HeatShimmer — a speed of 0 holds the warp still', async ({ page }) => {
  const start = await probePixels(page, '&speed=0&phaseTime=0');
  const later = await probePixels(page, '&speed=0&phaseTime=2');

  expect(pixelsChanged(start, later)).toBe(0);
});

// ---------------------------------------------
// The band: only the band wavers
// ---------------------------------------------

// At a strength of 0 the warp moves no sample, so the canvas matches one
// with no HeatShimmer mounted at all, pixel for pixel.
test('HeatShimmer — a strength of 0 matches the photo with no HeatShimmer', async ({ page }) => {
  const without = await probePixels(page, '&shimmer=none');
  const still = await probePixels(page, '&strength=0');

  expect(pixelsChanged(without, still)).toBe(0);
});

// The band's full height in the checks below, as a share of the canvas.
const BAND_HEIGHT = 0.3;

// Rows this close to a band edge belong to neither side of the check: the
// edge falls between two rows, and a row's center may sit a hair on
// either side of it.
const EDGE_ROWS = 2;

// With the feather at 0 the band has hard edges, so every row outside it
// keeps the photo exactly as it was, and the rows inside it waver. The
// check runs at the middle and again a quarter of the way down. A band
// flipped top to bottom passes at 0.5, so only the off-center run catches
// a y axis read the wrong way up, the bug CursorRipple once had: there,
// the band would land three quarters of the way down, and rows the check
// expects still would move.
//
// On macOS every row inside the band changed some pixels, so the check
// asks for nine in ten, which leaves room for a flat stretch of the photo
// on another GPU.
for (const bandPosition of [0.5, 0.25]) {
  test(`HeatShimmer — a hard-edged band at ${bandPosition} wavers only its own rows`, async ({
    page,
  }) => {
    const without = await probePixels(page, '&shimmer=none');
    const banded = await probePixels(
      page,
      `&band=1&bandPosition=${bandPosition}&bandHeight=${BAND_HEIGHT}&bandFeather=0`,
    );
    const top = (bandPosition - BAND_HEIGHT / 2) * without.height;
    const bottom = (bandPosition + BAND_HEIGHT / 2) * without.height;
    const movedOutside: number[] = [];
    let insideRows = 0;
    let movedInsideRows = 0;

    for (let y = 0; y < without.height; y++) {
      const center = y + 0.5;

      if (center < top - EDGE_ROWS || center > bottom + EDGE_ROWS) {
        if (rowChanged(without, banded, y) > 0) movedOutside.push(y);
      } else if (center > top + EDGE_ROWS && center < bottom - EDGE_ROWS) {
        insideRows++;
        if (rowChanged(without, banded, y) > 0) movedInsideRows++;
      }
    }

    expect(movedOutside, 'rows outside the band that moved').toEqual([]);
    expect(movedInsideRows, 'rows inside the band that moved').toBeGreaterThan(insideRows * 0.9);
  });
}

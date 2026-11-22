import type { Page } from '@playwright/test';

import { expect, test } from './fixtures';
import { type CanvasPixels, changedPixels, readCanvasPixels, waitForShader } from './helpers';

// The shimmer's look changes in every build phase, so the baseline
// screenshot waits for the defaults gate (SHA-344). Until then this spec
// checks that the page draws on the WebGL2 fallback, which headless
// Chromium runs, that the canvas shows the photo rather than nothing, and
// that the shimmer moves: it rises, changes shape, and holds at a speed of 0.

test('HeatShimmer — default story renders on the WebGL2 fallback', async ({ page }) => {
  await page.goto('/components/heat-shimmer?visualTest=1');
  await waitForShader(page);

  const backend = await page.evaluate(
    () => (window as unknown as { __shadersBackend?: string }).__shadersBackend,
  );

  expect(backend).toBe('webgl2');

  // A blank or black canvas would read one flat color. The photo's
  // flowers, vase, and wall spread the brightness across the canvas.
  const pixels = await readCanvasPixels(page);
  const brightness: number[] = [];

  for (let step = 1; step < 20; step += 1) {
    const [red, green, blue] = pixels.rgb(
      Math.floor((pixels.width * step) / 20),
      Math.floor((pixels.height * step) / 20),
    );

    brightness.push((red + green + blue) / 3);
  }

  expect(Math.max(...brightness) - Math.min(...brightness)).toBeGreaterThan(40);
});

// The photo alone spreads the brightness, so the check above passes even
// when the shimmer moves nothing. This one loads the probe twice, once at
// strength 0, which leaves the photo exactly as it is, and once at the
// default strength, and counts the pixels that differ. A shimmer that stops
// moving the photo changes none of them. Neither load is a baseline, so the
// provisional look can keep changing until the defaults gate.
//
// The least number of pixels the shimmer must change. On macOS the default
// strength changed about 355,000 of the 1280 x 720 canvas's 921,600, and two
// loads at strength 0 changed none, so this leaves room for another GPU and
// for the defaults to soften.
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
// Motion: the rise, the change of shape, and a speed of 0
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

/** How many pixels differ between two reads of the canvas, by more than 3 levels summed over red, green, and blue. */
function pixelsChanged(before: CanvasPixels, after: CanvasPixels): number {
  let changed = 0;

  for (let y = 0; y < before.height; y++) {
    for (let x = 0; x < before.width; x++) {
      const [red, green, blue] = before.rgb(x, y);
      const [nextRed, nextGreen, nextBlue] = after.rgb(x, y);

      if (Math.abs(red - nextRed) + Math.abs(green - nextGreen) + Math.abs(blue - nextBlue) > 3) {
        changed++;
      }
    }
  }

  return changed;
}

// Each motion on its own moves the photo: the rise with the change of shape
// off, and the change of shape with the rise off. A clock that no longer
// reaches one of them leaves its two loads identical.
// On macOS two seconds of rise alone changed about 397,000 of the canvas's
// 921,600 pixels and two seconds of shape change alone about 402,000, so
// the floor leaves room for another GPU and for the rates to soften.
test('HeatShimmer — the rise and the change of shape each move the photo', async ({ page }) => {
  const riseStart = await probePixels(page, '&morphRate=0&phaseTime=0');
  const riseLater = await probePixels(page, '&morphRate=0&phaseTime=2');
  const morphStart = await probePixels(page, '&riseRate=0&phaseTime=0');
  const morphLater = await probePixels(page, '&riseRate=0&phaseTime=2');

  expect(pixelsChanged(riseStart, riseLater), 'the rise alone').toBeGreaterThan(MIN_CHANGED_PIXELS);
  expect(pixelsChanged(morphStart, morphLater), 'the change of shape alone').toBeGreaterThan(
    MIN_CHANGED_PIXELS,
  );
});

// At a speed of 0 the clock never leaves 0, whatever time the load starts
// at, so the warp holds still.
test('HeatShimmer — a speed of 0 holds the warp still', async ({ page }) => {
  const start = await probePixels(page, '&speed=0&phaseTime=0');
  const later = await probePixels(page, '&speed=0&phaseTime=2');

  expect(pixelsChanged(start, later)).toBe(0);
});

/**
 * How far the shimmer moved each row of the photo: per pixel row, the
 * brightness change from `still`, the photo at strength 0, to `warped`,
 * summed along the row. A lump of shift shows as a band of rows that moved
 * more than its neighbors.
 */
function rowMovement(still: CanvasPixels, warped: CanvasPixels): number[] {
  return Array.from({ length: still.height }, (_, y) => {
    let moved = 0;

    for (let x = 0; x < still.width; x++) {
      const [red, green, blue] = still.rgb(x, y);
      const [nextRed, nextGreen, nextBlue] = warped.rgb(x, y);

      moved += Math.abs(red + green + blue - nextRed - nextGreen - nextBlue);
    }

    return moved;
  });
}

/**
 * How many pixel rows the bands in `after` sit above the ones in `before`:
 * the shift, up to `reach` rows either way, that lines the two up best.
 * Negative is down the canvas.
 */
function rowsMovedUp(before: number[], after: number[], reach: number): number {
  let best = 0;
  let bestError = Infinity;

  for (let shift = -reach; shift <= reach; shift++) {
    let error = 0;

    for (let y = reach; y < before.length - reach; y++) {
      error += Math.abs(after[y]! - before[y + shift]!);
    }
    if (error < bestError) {
      bestError = error;
      best = shift;
    }
  }

  return best;
}

// Which way the shimmer rises. With the change of shape off, the lumps
// slide like a picture, at 0.1 canvas heights a second: a third of a second
// carries them 24 rows up the 720-row canvas. The photo's own detail stays
// put and pulls the best match toward 0, so the reading is rough.
// On macOS the bands moved 27 rows up, and with the rise reversed 17 rows
// down, so 8 leaves room for another GPU.
test('HeatShimmer — the shimmer rises up the canvas', async ({ page }) => {
  const still = await probePixels(page, '&strength=0');
  const start = rowMovement(still, await probePixels(page, '&morphRate=0&phaseTime=0'));
  const later = rowMovement(still, await probePixels(page, '&morphRate=0&phaseTime=0.3333'));

  expect(rowsMovedUp(start, later, 80)).toBeGreaterThan(8);
});

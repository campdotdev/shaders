import type { Page } from '@playwright/test';

import { expect, test } from './fixtures';
import { type CanvasPixels, readCanvasPixels, waitForShader } from './helpers';

// One baseline of the default demo, on the WebGL2 fallback that headless
// Chromium runs. The probe checks below need no baseline: they compare loads
// of /dev/bloom-probe with each other, to check that the glow adds light,
// that it only adds, that a strength of 0 leaves the photo alone, that a
// wider radius reaches further, that a threshold no pixel passes blooms
// nothing, and that the glow holds the same light at 1x and at 2x.

test('Bloom — default story', async ({ page }) => {
  await page.goto('/components/bloom?visualTest=1');
  await waitForShader(page);

  const backend = await page.evaluate(
    () => (window as unknown as { __shadersBackend?: string }).__shadersBackend,
  );

  expect(backend).toBe('webgl2');
  await expect(page.locator('canvas').first()).toHaveScreenshot('bloom-default.png');
});

// ---------------------------------------------
// Comparing loads of the probe
// ---------------------------------------------

/** Loads the probe with `query` added, and returns the canvas's pixels. */
async function probePixels(page: Page, query: string): Promise<CanvasPixels> {
  await page.goto(`/dev/bloom-probe?visualTest=1${query}`);
  await page.locator('canvas').first().waitFor();
  await waitForShader(page);

  return readCanvasPixels(page);
}

/**
 * How two reads of the canvas differ: the pixels whose red, green, and blue
 * sum rose by more than 3 levels, and the pixels where it fell by more.
 */
function compare(before: CanvasPixels, after: CanvasPixels) {
  let brighter = 0;
  let darker = 0;

  for (let y = 0; y < before.height; y++) {
    for (let x = 0; x < before.width; x++) {
      const [red, green, blue] = before.rgb(x, y);
      const [nextRed, nextGreen, nextBlue] = after.rgb(x, y);
      const change = nextRed + nextGreen + nextBlue - (red + green + blue);

      if (change > 3) brighter++;
      if (change < -3) darker++;
    }
  }

  return { brighter, darker };
}

// The least number of pixels the glow must brighten. On macOS the default
// Bloom brightened about 121,000 of the 1280 x 720 canvas's 921,600, and a
// radius of 1 brightened about 317,000 more than a radius of 0, so this
// leaves room for another GPU.
const MIN_BRIGHTER_PIXELS = 20_000;

// Light adds: the glow goes on top of the photo, so it brightens the pixels
// around the sign and darkens none. A glow blended in place of the photo,
// or one that dims the picture to keep its total light, darkens some.
test('Bloom — the glow brightens the photo and darkens none of it', async ({ page }) => {
  const without = await probePixels(page, '&bloom=none');
  const bloomed = await probePixels(page, '');
  const { brighter, darker } = compare(without, bloomed);

  expect(brighter).toBeGreaterThan(MIN_BRIGHTER_PIXELS);
  expect(darker).toBe(0);
});

// At a strength of 0 the glow is multiplied by 0, so the canvas matches one
// with no Bloom mounted at all, within the 3 levels `compare` allows.
test('Bloom — a strength of 0 matches the photo with no Bloom', async ({ page }) => {
  const without = await probePixels(page, '&bloom=none');
  const off = await probePixels(page, '&strength=0');
  const { brighter, darker } = compare(without, off);

  expect(brighter + darker).toBe(0);
});

// The radius only adds reach: every level a radius of 0 uses, a radius of 1
// uses too, and it adds the wider ones. So the wide glow brightens pixels
// the tight one leaves alone and darkens none.
test('Bloom — a wider radius reaches further and takes nothing away', async ({ page }) => {
  const tight = await probePixels(page, '&radius=0');
  const wide = await probePixels(page, '&radius=1');
  const { brighter, darker } = compare(tight, wide);

  expect(brighter).toBeGreaterThan(MIN_BRIGHTER_PIXELS);
  expect(darker).toBe(0);
});

// The photo is 8-bit, so no pixel's luminance passes 1. The knee starts at
// half the threshold, so at a threshold of 4 it starts at 2, and nothing
// blooms.
test('Bloom — a threshold no pixel passes blooms nothing', async ({ page }) => {
  const without = await probePixels(page, '&bloom=none');
  const high = await probePixels(page, '&threshold=4');
  const { brighter, darker } = compare(without, high);

  expect(brighter + darker).toBe(0);
});

// ---------------------------------------------
// The same glow at any pixel density
// ---------------------------------------------

/** The light Bloom adds: the mean rise in red, green, and blue per pixel. */
function addedLight(without: CanvasPixels, bloomed: CanvasPixels): number {
  let added = 0;

  for (let y = 0; y < without.height; y++) {
    for (let x = 0; x < without.width; x++) {
      const [red, green, blue] = without.rgb(x, y);
      const [nextRed, nextGreen, nextBlue] = bloomed.rgb(x, y);

      added += nextRed + nextGreen + nextBlue - (red + green + blue);
    }
  }

  return added / (without.width * without.height);
}

// The glow's levels join it by their size as a share of the canvas, so a
// canvas with twice the pixels adds the same light. A threshold of 0 blooms
// everything, which makes the added light the photo's own light times the
// levels' weights, and the low strength keeps the sum from clipping at
// white. A chain that counted its levels from the finest one added a sixth
// more light here at 2x, because the taller canvas has one more level.
test('Bloom — the glow adds the same light at 1x and at 2x', async ({ page, browser }) => {
  const dials = '&threshold=0&radius=1&strength=0.2';
  const atOne = addedLight(await probePixels(page, '&bloom=none'), await probePixels(page, dials));

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 2,
  });
  const densePage = await context.newPage();
  const atTwo = addedLight(
    await probePixels(densePage, '&bloom=none'),
    await probePixels(densePage, dials),
  );

  await context.close();

  expect(atOne).toBeGreaterThan(1);
  expect(atTwo / atOne).toBeGreaterThan(0.95);
  expect(atTwo / atOne).toBeLessThan(1.05);
});

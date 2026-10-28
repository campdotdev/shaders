import type { Page } from '@playwright/test';

import { expect, test } from './fixtures';
import { waitForShader } from './helpers';

test('FlutedGlass — default story', async ({ page }) => {
  await page.goto('/components/fluted-glass?visualTest=1');
  await waitForShader(page);
  await expect(page.locator('canvas').first()).toHaveScreenshot('fluted-glass-default.png');
});

// The probe draws hard diagonal stripes under FlutedGlass at its defaults.
// Query params set the glass's dials, drop the glass with glass=none, or drop
// the stripes with source=none.
const PROBE = '/dev/fluted-glass-probe?visualTest=1';
// FlutedGlass's default flute width in CSS pixels, which is device pixels at
// the config's deviceScaleFactor of 1. A flute's center sits on the canvas
// center, so the grooves fall half a flute either side of it and every flute
// width beyond.
const FLUTE_WIDTH = 40;
// How far either side of a groove each sample column sits, in pixels. Wide
// enough to step clear of the groove's own pixel, narrow enough that
// unbroken stripes rarely change between the two columns.
const COLUMN_OFFSET = 3;
// The least the highlight must brighten the walls that face the light, in
// brightness levels from 0 to 255, averaged over those walls. The defaults
// measured about 18 on macOS, so this leaves room for another GPU.
const GAIN_ON_LIT_WALLS = 6;

/** The probe's canvas as each pixel's brightness, the mean of its channels. */
interface Brightness {
  width: number;
  /** Brightness from 0 to 255 at a pixel. */
  at: (x: number, y: number) => number;
  /** The middle band of rows, clear of the site header drawn over the canvas. */
  rows: number[];
}

/**
 * Loads the probe with `query` appended and reads its canvas. The screenshot
 * decodes in the page, which has the browser's PNG decoder, and comes back
 * one byte of brightness per pixel.
 */
async function probeBrightness(page: Page, query: string): Promise<Brightness> {
  await page.goto(`${PROBE}${query}`);
  await page.locator('canvas').first().waitFor();
  await waitForShader(page);

  const shot = await page.locator('canvas').first().screenshot();
  const { width, height, bytes } = await page.evaluate(async (pngBase64) => {
    const response = await fetch(`data:image/png;base64,${pngBase64}`);
    const bitmap = await createImageBitmap(await response.blob());
    const canvas = document.createElement('canvas');

    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d')!;

    context.drawImage(bitmap, 0, 0);
    const rgba = context.getImageData(0, 0, bitmap.width, bitmap.height).data;
    let binary = '';

    for (let index = 0; index < rgba.length; index += 4) {
      const sum = (rgba[index] ?? 0) + (rgba[index + 1] ?? 0) + (rgba[index + 2] ?? 0);

      binary += String.fromCharCode(Math.round(sum / 3));
    }

    return { width: bitmap.width, height: bitmap.height, bytes: btoa(binary) };
  }, shot.toString('base64'));
  const pixels = Buffer.from(bytes, 'base64');
  const rows: number[] = [];

  for (let y = Math.floor(height * 0.2); y < Math.floor(height * 0.8); y += 1) rows.push(y);

  return { width, at: (x, y) => pixels[y * width + x] ?? 0, rows };
}

/** The x of every groove on a canvas `width` pixels wide, left to right. */
function grooves(width: number): number[] {
  const center = width / 2;
  const first =
    center + FLUTE_WIDTH / 2 - Math.floor((center + FLUTE_WIDTH / 2) / FLUTE_WIDTH) * FLUTE_WIDTH;
  const positions: number[] = [];

  for (let groove = first; groove < width; groove += FLUTE_WIDTH) {
    positions.push(Math.round(groove));
  }

  return positions;
}

/**
 * The share of rows where the pixels just left and just right of a groove
 * fall on different sides of mid-gray, over every groove on the canvas. On
 * unbroken stripes the two columns differ only where a stripe edge passes
 * between them. Through the glass they read the image from far apart, so
 * they differ far more often.
 */
function grooveBreaks(image: Brightness): number {
  let pairs = 0;
  let breaks = 0;

  for (const groove of grooves(image.width)) {
    const left = groove - COLUMN_OFFSET;
    const right = groove + COLUMN_OFFSET;

    if (left < 0 || right >= image.width) continue;
    for (const y of image.rows) {
      pairs += 1;
      if (image.at(left, y) > 128 !== image.at(right, y) > 128) breaks += 1;
    }
  }

  return breaks / pairs;
}

/**
 * How much brighter `lit` is than `unlit` on average, over the left half and
 * the right half of every whole flute, two pixels clear of the grooves and
 * the center.
 */
function wallGain(lit: Brightness, unlit: Brightness): { left: number; right: number } {
  let left = 0;
  let right = 0;
  let count = 0;

  for (const groove of grooves(lit.width)) {
    if (groove + FLUTE_WIDTH >= lit.width) continue;
    for (const y of lit.rows) {
      for (let step = 2; step <= FLUTE_WIDTH / 2 - 2; step += 1) {
        const leftX = groove + step;
        const rightX = groove + FLUTE_WIDTH - step;

        left += lit.at(leftX, y) - unlit.at(leftX, y);
        right += lit.at(rightX, y) - unlit.at(rightX, y);
        count += 1;
      }
    }
  }

  return { left: left / count, right: right / count };
}

/**
 * The x of every column `near` to `far` pixels out from a groove, on both
 * sides of every groove on a canvas `width` pixels wide. Column 0 touches
 * the groove.
 */
function columnsNearGrooves(width: number, near: number, far: number): number[] {
  const columns: number[] = [];

  for (const groove of grooves(width)) {
    for (let step = near; step <= far; step += 1) {
      columns.push(groove - 1 - step, groove + step);
    }
  }

  return columns.filter((x) => x >= 0 && x < width);
}

/**
 * The share of `unshaded`'s brightness that `shaded` loses, over the columns
 * `near` to `far` pixels out from every groove.
 */
function shadowShare(shaded: Brightness, unshaded: Brightness, near: number, far: number): number {
  let lost = 0;
  let total = 0;

  for (const x of columnsNearGrooves(shaded.width, near, far)) {
    for (const y of shaded.rows) {
      lost += unshaded.at(x, y) - shaded.at(x, y);
      total += unshaded.at(x, y);
    }
  }

  return lost / total;
}

/** The largest brightness difference between two loads, pixel for pixel. */
function maxDifference(first: Brightness, second: Brightness): number {
  let largest = 0;

  for (const y of first.rows) {
    for (let x = 0; x < first.width; x += 1) {
      largest = Math.max(largest, Math.abs(first.at(x, y) - second.at(x, y)));
    }
  }

  return largest;
}

// A regenerated baseline of inert glass would pass its own screenshot, so
// this checks that the glass breaks the stripes at all. Both loads turn the
// light off, since the shadow and highlight also change the columns either
// side of a groove, and this measures the bend alone. The same probe with
// refraction 0 is the inert reference. At 1280 px wide a stripe repeats every
// 113 px across a row, so the two columns differ on about 11% of rows without
// the glass. Through it, they read the image 28 px apart, and differ on
// about half.
test('FlutedGlass — stripes break at the grooves', async ({ page }) => {
  const inert = grooveBreaks(await probeBrightness(page, '&highlight=0&shadow=0&refraction=0'));
  const glass = grooveBreaks(await probeBrightness(page, '&highlight=0&shadow=0'));

  expect(glass, `groove breaks: glass ${glass}, inert ${inert}`).toBeGreaterThan(inert + 0.2);
});

// The default light comes from the upper left, so over vertical flutes the
// left wall of each flute faces it and catches the highlight, and the right
// wall faces away. Both loads turn the shadow off, so the highlight is the
// only difference between them.
test('FlutedGlass — the highlight lights the walls that face the light', async ({ page }) => {
  const unlit = await probeBrightness(page, '&highlight=0&shadow=0');
  const lit = await probeBrightness(page, '&shadow=0');
  const gain = wallGain(lit, unlit);
  const message = `brightness gain: left walls ${gain.left}, right walls ${gain.right}`;

  expect(gain.left, message).toBeGreaterThan(GAIN_ON_LIT_WALLS);
  expect(gain.right, message).toBeLessThan(gain.left / 4);
});

// A flat top is flat across its middle and steep only at its walls, so its
// shadow belongs on the walls. Both loads turn the highlight off, and only
// the shadow differs between them. Columns 0 and 1 out from a groove sit on
// the walls. Columns 4 to 9 sit a fifth to a half of the way to the center:
// inside the shadow's reach, but on glass that is flat.
test('FlutedGlass — on a flat top the shadow stays on the walls', async ({ page }) => {
  const unshaded = await probeBrightness(page, '&crossSection=flat&highlight=0&shadow=0');
  const shaded = await probeBrightness(page, '&crossSection=flat&highlight=0&shadow=1');
  const walls = shadowShare(shaded, unshaded, 0, 1);
  const flatTop = shadowShare(shaded, unshaded, 4, 9);
  const message = `share of brightness the shadow takes: walls ${walls}, flat top ${flatTop}`;

  expect(walls, message).toBeGreaterThan(0.1);
  expect(flatTop, message).toBeLessThan(0.02);
});

// With nothing to bend and no light, the glass draws the Source exactly as
// the Source alone does.
test('FlutedGlass — inert glass leaves the Source unchanged', async ({ page }) => {
  const source = await probeBrightness(page, '&glass=none');
  const inert = await probeBrightness(page, '&refraction=0&highlight=0&shadow=0');

  expect(maxDifference(source, inert)).toBeLessThanOrEqual(1);
});

// Over a transparent scene the canvas shows the probe page's black
// background. Light added to a pixel with no coverage would show on it.
test('FlutedGlass — a transparent pixel gets no highlight', async ({ page }) => {
  const black = await probeBrightness(page, '&glass=none&source=none');
  const glass = await probeBrightness(page, '&source=none&highlight=1&shadow=1');

  expect(maxDifference(black, glass)).toBeLessThanOrEqual(1);
});

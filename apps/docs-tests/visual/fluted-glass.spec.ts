import type { Page } from '@playwright/test';

import { expect, test } from './fixtures';
import { waitForShader } from './helpers';

test('FlutedGlass — default story', async ({ page }) => {
  await page.goto('/components/fluted-glass?visualTest=1');
  await waitForShader(page);
  await expect(page.locator('canvas').first()).toHaveScreenshot('fluted-glass-default.png');
});

// The flute width every probe load sets, in CSS pixels, which is device
// pixels at the config's deviceScaleFactor of 1. The checks set it rather than
// take the default, so their column math holds when the default changes. A
// flute's center sits on the canvas center, so the grooves fall half a flute
// either side of it and every flute width beyond.
const FLUTE_WIDTH = 40;
// The probe draws hard diagonal stripes under FlutedGlass at its defaults,
// apart from the flute width above. Query params set the glass's other dials,
// drop the glass with glass=none, or drop the stripes with source=none.
const PROBE = `/dev/fluted-glass-probe?visualTest=1&fluteWidth=${FLUTE_WIDTH}`;
// How far either side of a groove each sample column sits, in pixels. Wide
// enough to step clear of the groove's own pixel, narrow enough that
// unbroken stripes rarely change between the two columns.
const COLUMN_OFFSET = 3;
// The least a highlight of 0.45 must brighten the walls that face the light,
// in brightness levels from 0 to 255, averaged over those walls. It measured
// about 18 on macOS, so this leaves room for another GPU.
const GAIN_ON_LIT_WALLS = 6;

/** The probe's canvas, read back pixel by pixel. */
interface ProbeImage {
  width: number;
  /** Brightness from 0 to 255 at a pixel, the rounded mean of its channels. */
  brightness: (x: number, y: number) => number;
  /** Red from 0 to 255 at a pixel. */
  red: (x: number, y: number) => number;
  /** Blue from 0 to 255 at a pixel. */
  blue: (x: number, y: number) => number;
  /** The middle band of rows, clear of the site header drawn over the canvas. */
  rows: number[];
}

/**
 * Loads the probe with `query` appended and reads its canvas. The screenshot
 * decodes in the page, which has the browser's PNG decoder, and comes back
 * as three bytes per pixel: red, green, and blue.
 */
async function loadProbe(page: Page, query: string): Promise<ProbeImage> {
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
      binary += String.fromCharCode(rgba[index] ?? 0, rgba[index + 1] ?? 0, rgba[index + 2] ?? 0);
    }

    return { width: bitmap.width, height: bitmap.height, bytes: btoa(binary) };
  }, shot.toString('base64'));
  const pixels = Buffer.from(bytes, 'base64');
  const rows: number[] = [];

  for (let y = Math.floor(height * 0.2); y < Math.floor(height * 0.8); y += 1) rows.push(y);

  const channel = (x: number, y: number, offset: number) =>
    pixels[(y * width + x) * 3 + offset] ?? 0;

  return {
    width,
    brightness: (x, y) => Math.round((channel(x, y, 0) + channel(x, y, 1) + channel(x, y, 2)) / 3),
    red: (x, y) => channel(x, y, 0),
    blue: (x, y) => channel(x, y, 2),
    rows,
  };
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
function grooveBreaks(image: ProbeImage): number {
  let pairs = 0;
  let breaks = 0;

  for (const groove of grooves(image.width)) {
    const left = groove - COLUMN_OFFSET;
    const right = groove + COLUMN_OFFSET;

    if (left < 0 || right >= image.width) continue;
    for (const y of image.rows) {
      pairs += 1;
      if (image.brightness(left, y) > 128 !== image.brightness(right, y) > 128) breaks += 1;
    }
  }

  return breaks / pairs;
}

/**
 * How much brighter `lit` is than `unlit` on average, over the left half and
 * the right half of every whole flute, two pixels clear of the grooves and
 * the center.
 */
function wallGain(lit: ProbeImage, unlit: ProbeImage): { left: number; right: number } {
  let left = 0;
  let right = 0;
  let count = 0;

  for (const groove of grooves(lit.width)) {
    if (groove + FLUTE_WIDTH >= lit.width) continue;
    for (const y of lit.rows) {
      for (let step = 2; step <= FLUTE_WIDTH / 2 - 2; step += 1) {
        const leftX = groove + step;
        const rightX = groove + FLUTE_WIDTH - step;

        left += lit.brightness(leftX, y) - unlit.brightness(leftX, y);
        right += lit.brightness(rightX, y) - unlit.brightness(rightX, y);
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
function shadowShare(shaded: ProbeImage, unshaded: ProbeImage, near: number, far: number): number {
  let lost = 0;
  let total = 0;

  for (const x of columnsNearGrooves(shaded.width, near, far)) {
    for (const y of shaded.rows) {
      lost += unshaded.brightness(x, y) - shaded.brightness(x, y);
      total += unshaded.brightness(x, y);
    }
  }

  return lost / total;
}

/**
 * The x of every column within `reach` pixels of a flute's center, on a
 * canvas `width` pixels wide. A flute's center sits half a flute past each
 * groove.
 */
function columnsNearCenters(width: number, reach: number): number[] {
  const columns: number[] = [];

  for (const groove of grooves(width)) {
    for (let step = -reach; step <= reach; step += 1) {
      columns.push(groove + FLUTE_WIDTH / 2 + step);
    }
  }

  return columns.filter((x) => x >= 0 && x < width);
}

/**
 * The share of pixels in `columns` where red and blue fall on different
 * sides of mid-gray. The probe's stripes are gray, so red and blue match
 * wherever the glass splits no color. Where it does, a stripe edge lands in a
 * different place in each channel, and the pixels between the two places
 * split.
 */
function colorSplit(image: ProbeImage, columns: number[]): number {
  let pixels = 0;
  let splits = 0;

  for (const x of columns) {
    for (const y of image.rows) {
      pixels += 1;
      if (image.red(x, y) > 128 !== image.blue(x, y) > 128) splits += 1;
    }
  }

  return splits / pixels;
}

/** The largest brightness difference between two loads, pixel for pixel. */
function maxDifference(first: ProbeImage, second: ProbeImage): number {
  let largest = 0;

  for (const y of first.rows) {
    for (let x = 0; x < first.width; x += 1) {
      largest = Math.max(largest, Math.abs(first.brightness(x, y) - second.brightness(x, y)));
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
  const inert = grooveBreaks(await loadProbe(page, '&highlight=0&shadow=0&refraction=0'));
  const glass = grooveBreaks(await loadProbe(page, '&highlight=0&shadow=0'));

  expect(glass, `groove breaks: glass ${glass}, inert ${inert}`).toBeGreaterThan(inert + 0.2);
});

// Dispersion reads blue one split past the bend and red one split short of
// it, where the split is a share of the bend. Near a groove the bend is
// largest, so at the default dispersion a stripe edge lands several pixels
// apart in red and blue, and the two disagree across the gap. At a flute's
// center the bend falls to 0, so the colors stay together there: a pixel off
// center the bend is about a pixel, and the split a fifth of that. Both loads
// turn the light off, and the reference sets dispersion to 0, the glass
// without the split. On macOS the split pixels measured 11% near the grooves
// and 1.1% at the centers.
test('FlutedGlass — dispersion splits red from blue near the grooves', async ({ page }) => {
  const unsplit = await loadProbe(page, '&highlight=0&shadow=0&dispersion=0');
  const split = await loadProbe(page, '&highlight=0&shadow=0');
  const grooveColumns = columnsNearGrooves(split.width, 1, 6);
  const centerColumns = columnsNearCenters(split.width, 1);
  const atGrooves = colorSplit(split, grooveColumns);
  const atGroovesUnsplit = colorSplit(unsplit, grooveColumns);
  const atCenters = colorSplit(split, centerColumns);
  const message = `share of red and blue split: near grooves ${atGrooves} (${atGroovesUnsplit} with no dispersion), at centers ${atCenters}`;

  expect(atGrooves, message).toBeGreaterThan(atGroovesUnsplit + 0.05);
  expect(atCenters, message).toBeLessThan(atGrooves / 4);
});

// The default light comes from the upper left, so over vertical flutes the
// left wall of each flute faces it and catches the highlight, and the right
// wall faces away. Both loads turn the shadow off, so the highlight is the
// only difference between them. The lit load sets the highlight to 0.45,
// bright enough to measure well clear of noise.
test('FlutedGlass — the highlight lights the walls that face the light', async ({ page }) => {
  const unlit = await loadProbe(page, '&highlight=0&shadow=0');
  const lit = await loadProbe(page, '&highlight=0.45&shadow=0');
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
  const unshaded = await loadProbe(page, '&crossSection=flat&highlight=0&shadow=0');
  const shaded = await loadProbe(page, '&crossSection=flat&highlight=0&shadow=1');
  const walls = shadowShare(shaded, unshaded, 0, 1);
  const flatTop = shadowShare(shaded, unshaded, 4, 9);
  const message = `share of brightness the shadow takes: walls ${walls}, flat top ${flatTop}`;

  expect(walls, message).toBeGreaterThan(0.1);
  expect(flatTop, message).toBeLessThan(0.02);
});

// With nothing to bend and no light, the glass draws the Source exactly as
// the Source alone does.
test('FlutedGlass — inert glass leaves the Source unchanged', async ({ page }) => {
  const source = await loadProbe(page, '&glass=none');
  const inert = await loadProbe(page, '&refraction=0&highlight=0&shadow=0');

  expect(maxDifference(source, inert)).toBeLessThanOrEqual(1);
});

// Over a transparent scene the canvas shows the probe page's black
// background. Light added to a pixel with no coverage would show on it.
test('FlutedGlass — a transparent pixel gets no highlight', async ({ page }) => {
  const black = await loadProbe(page, '&glass=none&source=none');
  const glass = await loadProbe(page, '&source=none&highlight=1&shadow=1');

  expect(maxDifference(black, glass)).toBeLessThanOrEqual(1);
});

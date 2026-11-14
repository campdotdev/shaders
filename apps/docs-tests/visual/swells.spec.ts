import type { Page } from '@playwright/test';

import { expect, test } from './fixtures';
import { readCanvasPixels, waitForShader } from './helpers';

// Swells marches a ray per pixel in a fixed-count loop, which the WebGL2
// fallback accepts only with a constant bound. Headless Chromium runs that
// fallback, so this spec is the check that the march compiles there.

test('Swells — default story', async ({ page }) => {
  await page.goto('/components/swells?visualTest=1');
  await waitForShader(page);

  const backend = await page.evaluate(
    () => (window as unknown as { __shadersBackend?: string }).__shadersBackend,
  );

  expect(backend).toBe('webgl2');
  await expect(page.locator('canvas').first()).toHaveScreenshot('swells-default.png');
});

// A baseline regenerated from blank or unlit output would pass its own
// screenshot, so this checks what the demo must show. Swells is mounted
// alone, so above the horizon the ray misses the ground and Swells is
// transparent: the top rows read the page's own background, one flat
// color. The bottom rows are ground, and the ground as a whole reads as
// sand, more red than blue on average, far brighter than that background.
// And the sun's light varies across the ground, so its brightness spreads;
// unlit ground would be one flat color.
test('Swells — page background above the horizon, lit sand below', async ({ page }) => {
  await page.goto('/components/swells?visualTest=1');
  await waitForShader(page);

  const pixels = await readCanvasPixels(page);
  const across = (y: number) =>
    Array.from({ length: 41 }, (_, step) =>
      pixels.rgb(Math.min(pixels.width - 1, Math.floor((pixels.width * step) / 40)), y),
    );
  const brightnessOf = ([red, green, blue]: [number, number, number]) => (red + green + blue) / 3;

  const sky = across(Math.floor(pixels.height * 0.05)).map(brightnessOf);

  expect(Math.max(...sky) - Math.min(...sky), 'sky is one flat background').toBeLessThan(4);

  const groundRows = [0.7, 0.8, 0.9].map((share) => across(Math.floor(pixels.height * share)));
  const ground = groundRows.flat();
  const brightness = ground.map(brightnessOf);

  expect(mean(brightness) - mean(sky), 'ground over the background').toBeGreaterThan(60);

  const meanOf = (channel: 0 | 2) => mean(ground.map((pixel) => pixel[channel]));

  expect(meanOf(0), 'sand: mean red over mean blue').toBeGreaterThan(meanOf(2) + 8);
  expect(Math.max(...brightness) - Math.min(...brightness), 'slope light spread').toBeGreaterThan(
    12,
  );
});

// The probe draws the sand in gray, from near black on faces turned from the
// sun to near white on faces turned toward it, over a black canvas. Query
// params set Swells' dials. The sheen, the haze, and the mirage start at 0,
// and the haze is black, so hazed ground reads darker.
const PROBE = '/dev/swells-probe?visualTest=1';

/**
 * Loads the probe with `query` appended and returns the brightness, 0 to 255,
 * at points spread over its ground: the bottom third of the canvas, which
 * lies below the horizon at the default camera.
 */
async function groundBrightness(page: Page, query: string): Promise<number[]> {
  return bandBrightness(await probeRows(page, query), 0.65, 0.98);
}

/**
 * The canvas's brightness, 0 to 255, in rows 8 pixels apart: each row a
 * list of samples 8 pixels apart.
 */
async function sampleRows(page: Page): Promise<number[][]> {
  const { width, height, rgb } = await readCanvasPixels(page);
  const rows: number[][] = [];

  for (let y = 0; y < height; y += 8) {
    const row: number[] = [];

    for (let x = 0; x < width; x += 8) {
      const [red, green, blue] = rgb(x, y);

      row.push((red + green + blue) / 3);
    }
    rows.push(row);
  }

  return rows;
}

/** Loads the probe with `query` appended and returns its rows, as sampleRows reads them. */
async function probeRows(page: Page, query: string): Promise<number[][]> {
  await page.goto(`${PROBE}${query}`);
  await page.locator('canvas').first().waitFor();
  await waitForShader(page);

  return sampleRows(page);
}

/**
 * How far the mean brightness of the band from `top` to `bottom`, each a
 * share of the height, moved from `before` to `after`.
 */
function bandShift(before: number[][], after: number[][], top: number, bottom: number): number {
  return mean(bandBrightness(after, top, bottom)) - mean(bandBrightness(before, top, bottom));
}

/** The samples in rows from `top` to `bottom`, each a share of the height. */
function bandBrightness(rows: number[][], top: number, bottom: number): number[] {
  return rows.slice(Math.floor(rows.length * top), Math.floor(rows.length * bottom)).flat();
}

// Where the probe's sky starts, as a share of the canvas's height: below the
// site header, which the docs layout draws over the top of the canvas.
const SKY_TOP = 0.12;

const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;

// A camera sees mostly the faces turned toward it, because a dune hides its
// own far face. With the sun behind the camera those faces are sunlit, and
// with the sun ahead they are shaded, so the ground's mean brightness swings
// far between the two. Lighting that ignored the sun would read the same in
// both. The gap measured about 120 levels on macOS, so 60 leaves room for
// another GPU.
test('Swells — sunlit faces are brighter than shaded ones', async ({ page }) => {
  const sunBehind = mean(await groundBrightness(page, '&sunAngle=180'));
  const sunAhead = mean(await groundBrightness(page, '&sunAngle=0'));

  expect(sunBehind - sunAhead, 'sun behind minus sun ahead').toBeGreaterThan(60);
});

// With no relief and no ripples the ground is level, so every point faces the
// sun alike and the ground reads one even tone. The only spread left is the
// scene's dither, a level or two.
test('Swells — relief 0 and ripples 0 give flat, smooth ground', async ({ page }) => {
  const flat = await groundBrightness(page, '&relief=0&ripples=0');

  expect(Math.max(...flat) - Math.min(...flat), 'flat ground spread').toBeLessThan(6);
  expect(mean(flat), 'flat ground is lit').toBeGreaterThan(40);
});

// The sky stays transparent whatever the air is doing: with the sheen, the
// haze, and the mirage all on, the sky still reads the white canvas beneath
// Swells. The haze is black, so a sky Swells painted opaque would read dark
// here rather than pass for the canvas. The band starts below the site
// header, which the docs layout draws over the top of the probe's canvas,
// and ends above the horizon.
test('Swells — the sky above the horizon is transparent', async ({ page }) => {
  const rows = await probeRows(page, '&sheen=1&haze=0.04&mirage=1&background=white');

  expect(Math.min(...bandBrightness(rows, SKY_TOP, 0.22)), 'darkest sky sample').toBeGreaterThan(
    252,
  );
});

// Haze turns the far surface to its color, here black, and then fades it
// out, while the ground at the camera's feet stays clear. With the sun
// behind the camera every face in view is lit, so the far band, just below
// the horizon, reads bright in clear air. On macOS it fell from about 100
// levels to about 13 at haze 0.08, and the near ground moved about 6.
test('Swells — haze fades the far surface and leaves the near ground', async ({ page }) => {
  const clear = await probeRows(page, '&sunAngle=180');
  const hazy = await probeRows(page, '&sunAngle=180&haze=0.08');

  expect(bandShift(hazy, clear, 0.3, 0.4), 'far band, clear minus hazy').toBeGreaterThan(50);
  expect(
    Math.abs(bandShift(clear, hazy, 0.85, 0.95)),
    'near ground, clear against hazy',
  ).toBeLessThan(15);
});

// Haze turns the surface to its color first and fades it out further away,
// so with a thick white haze over the black canvas the two pull apart. The
// near ground turns toward white and brightens. Further out, inside 24
// units, where the reach fade has not started, the ground has turned
// almost all the way to white but has also faded, so it reads darker than
// in clear air even though the haze is white. A haze that only blended
// toward its color would read almost white there. On macOS the near
// ground went from about 109 levels to 163, and the band from 0.35 to
// 0.45 of the height went from about 120 to 68.
test('Swells — haze blends toward its color, then fades out', async ({ page }) => {
  const clear = await probeRows(page, '&sunAngle=180');
  const white = await probeRows(page, '&sunAngle=180&haze=0.3&hazeColor=white');

  expect(
    bandShift(clear, white, 0.85, 0.95),
    'near ground, white haze minus clear',
  ).toBeGreaterThan(25);
  expect(bandShift(clear, white, 0.35, 0.45), 'further out, white haze minus clear').toBeLessThan(
    -25,
  );
});

// Every ray heading down meets the ground, so no sky shows between the far
// crests. A ray that ran out of steps while it skimmed them used to count
// as a miss and left slivers of black among the lit far faces. With the sun
// behind the camera every face in view is lit, so a sample darker than 4
// levels below the horizon is a sliver. The check starts a little below the
// horizon, where the reach fade has not yet taken the ground to black.
test('Swells — no sky shows between the far crests', async ({ page }) => {
  const rows = await probeRows(page, '&sunAngle=180');
  const skyTop = Math.floor(rows.length * SKY_TOP);
  const horizon = skyTop + rows.slice(skyTop).findIndex((row) => mean(row) > 20);

  expect(horizon, 'a horizon row below the sky').toBeGreaterThan(skyTop);

  const start = horizon + Math.ceil(rows.length * 0.02);
  const below = rows.slice(start, Math.floor(rows.length * 0.5)).flat();
  const slivers = below.filter((sample) => sample < 4).length;

  expect(slivers / below.length, 'share of black samples below the horizon').toBeLessThan(0.01);
});

// The mirage wavers the far surface and clears it in patches, and leaves
// the near ground alone. The visual-test flag holds its clock still, so
// this compares one frame with the mirage against one without.
test('Swells — the mirage changes only the far surface', async ({ page }) => {
  const still = await probeRows(page, '&sunAngle=180');
  const shimmering = await probeRows(page, '&sunAngle=180&mirage=1');

  expect(
    Math.abs(bandShift(still, shimmering, 0.28, 0.34)),
    'far band, still against shimmering',
  ).toBeGreaterThan(8);
  expect(
    Math.abs(bandShift(still, shimmering, 0.85, 0.95)),
    'near ground, still against shimmering',
  ).toBeLessThan(1);
});

/**
 * Loads the probe with the camera swaying toward the pointer under the
 * reduced-motion `policy`, moves the pointer to `pointerX` across the
 * canvas's middle row, a share of its width, and returns the probe's rows
 * as sampleRows reads them. The glide is off, so only the sway can move the
 * picture, and `pointer=1` holds the capture until the pointer has moved
 * and the cursor's smoothing has settled.
 */
async function rowsUnderPointer(
  page: Page,
  policy: 'off' | 'slow',
  pointerX: number,
): Promise<number[][]> {
  await page.goto(
    `${PROBE}&sunAngle=180&speed=0&parallax=1&parallaxCenter=cursor&pointer=1&reducedMotion=${policy}`,
  );
  const canvas = page.locator('canvas').first();

  await canvas.waitFor();
  await page.waitForFunction(
    () =>
      (window as unknown as { __shadersTestAwaitingPointer?: boolean })
        .__shadersTestAwaitingPointer === true,
    undefined,
    { timeout: 60_000 },
  );

  const box = await canvas.boundingBox();

  if (box === null) throw new Error('canvas has no bounding box');
  await page.mouse.move(box.x + box.width * pointerX, box.y + box.height * 0.5);
  await waitForShader(page);

  return sampleRows(page);
}

/**
 * The mean of the per-sample brightness differences between two captures,
 * over the band from `top` to `bottom`, each a share of the height. Unlike
 * bandShift, it catches a pattern that slid sideways without changing its
 * mean.
 */
function bandChange(before: number[][], after: number[][], top: number, bottom: number): number {
  const from = bandBrightness(before, top, bottom);
  const to = bandBrightness(after, top, bottom);

  return mean(from.map((value, index) => Math.abs(value - (to[index] ?? value))));
}

/** The row index of the horizon: the first row below the site header that reads as lit ground. */
function horizonRow(rows: number[][]): number {
  const skyTop = Math.floor(rows.length * SKY_TOP);

  return skyTop + rows.slice(skyTop).findIndex((row) => mean(row) > 20);
}

// Parallax: a pointer right of the middle moves the camera right, and the
// camera turns a little to keep facing a point on the ground ahead. Ground
// nearer than that point slides one way and ground beyond it the other, so
// both the near ground and the far ground just under the horizon change.
// The camera never pitches or rolls and keeps its height, so the horizon
// stays at the same row. Under reduced motion the sway holds at 0, so the
// same pointer changes nothing.
test('Swells — the pointer orbits the camera at a level horizon, and holds under reduced motion', async ({
  page,
}) => {
  const middle = await rowsUnderPointer(page, 'off', 0.5);
  const right = await rowsUnderPointer(page, 'off', 0.85);
  const horizon = horizonRow(middle);
  const farTop = (horizon + 2) / middle.length;
  const farBottom = (horizon + 8) / middle.length;

  expect(bandChange(middle, right, 0.85, 0.95), 'near ground change').toBeGreaterThan(10);
  expect(bandChange(middle, right, farTop, farBottom), 'far ground change').toBeGreaterThan(15);
  expect(
    Math.abs(horizonRow(right) - horizon),
    'horizon move, in 8-pixel rows',
  ).toBeLessThanOrEqual(1);

  const slowMiddle = await rowsUnderPointer(page, 'slow', 0.5);
  const slowRight = await rowsUnderPointer(page, 'slow', 0.85);

  expect(
    bandChange(slowMiddle, slowRight, 0.85, 0.95),
    'near ground under reduced motion',
  ).toBeLessThan(1);
  expect(
    bandChange(slowMiddle, slowRight, farTop, farBottom),
    'far ground under reduced motion',
  ).toBeLessThan(1);
  expect(horizonRow(slowRight), 'horizon row under reduced motion').toBe(horizonRow(slowMiddle));
});

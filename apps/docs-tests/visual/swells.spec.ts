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
// color. The bottom rows are ground, far brighter than that background, and
// the default colors are pinks and violets over deep blue, so the ground
// reads far more blue than red. On macOS mean blue led mean red by about 89
// levels, so 40 leaves room for another GPU. And the light falls unevenly
// across the ground, so its brightness spreads, where unlit ground would be
// one flat color.
test('Swells — page background above the horizon, lit ground below', async ({ page }) => {
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

  expect(meanOf(2), 'default colors: mean blue over mean red').toBeGreaterThan(meanOf(0) + 40);
  expect(Math.max(...brightness) - Math.min(...brightness), 'slope light spread').toBeGreaterThan(
    12,
  );
});

// The probe draws the surface in gray, from near black on faces turned from the
// light to near white on faces turned toward it, over a black canvas. Query
// params set Swells' dials. The sheen and the haze start at 0, and the
// haze is black, so hazed ground reads darker.
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

// A camera sees mostly the faces turned toward it, because a swell hides its
// own far face. With the light behind the camera those faces are lit, and
// with the light ahead they are shaded, so the ground's mean brightness swings
// far between the two. Lighting that ignored lightAngle would read the same in
// both. The gap measured about 120 levels on macOS, so 60 leaves room for
// another GPU.
test('Swells — lit faces are brighter than shaded ones', async ({ page }) => {
  const lightBehind = mean(await groundBrightness(page, '&lightAngle=180'));
  const lightAhead = mean(await groundBrightness(page, '&lightAngle=0'));

  expect(lightBehind - lightAhead, 'light behind minus light ahead').toBeGreaterThan(60);
});

// With no relief and no ripples the ground is level, so every point faces the
// light alike and the ground reads one even tone. The only spread left is the
// scene's dither, a level or two.
test('Swells — relief 0 and ripples 0 give flat, smooth ground', async ({ page }) => {
  const flat = await groundBrightness(page, '&relief=0&ripples=0');

  expect(Math.max(...flat) - Math.min(...flat), 'flat ground spread').toBeLessThan(6);
  expect(mean(flat), 'flat ground is lit').toBeGreaterThan(40);
});

// The sky stays transparent whatever the air is doing: with the sheen and
// the haze both on, the sky still reads the white canvas beneath
// Swells. The haze is black, so a sky Swells painted opaque would read dark
// here rather than pass for the canvas. The band starts below the site
// header, which the docs layout draws over the top of the probe's canvas,
// and ends above the horizon.
test('Swells — the sky above the horizon is transparent', async ({ page }) => {
  const rows = await probeRows(page, '&sheen=1&haze=0.04&background=white');

  expect(Math.min(...bandBrightness(rows, SKY_TOP, 0.22)), 'darkest sky sample').toBeGreaterThan(
    252,
  );
});

// Haze turns the far surface to its color, here black, and then fades it
// out, while the ground at the camera's feet stays clear. With the light
// behind the camera every face in view is lit, so the far band, just below
// the horizon, reads bright in clear air. On macOS it fell from about 100
// levels to about 13 at haze 0.08, and the near ground moved about 6.
test('Swells — haze fades the far surface and leaves the near ground', async ({ page }) => {
  const clear = await probeRows(page, '&lightAngle=180');
  const hazy = await probeRows(page, '&lightAngle=180&haze=0.08');

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
  const clear = await probeRows(page, '&lightAngle=180');
  const white = await probeRows(page, '&lightAngle=180&haze=0.3&hazeColor=white');

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
// as a miss and left slivers of black among the lit far faces. With the light
// behind the camera every face in view is lit, so a sample darker than 4
// levels below the horizon is a sliver. The check starts a little below the
// horizon, where the reach fade has not yet taken the ground to black.
test('Swells — no sky shows between the far crests', async ({ page }) => {
  const rows = await probeRows(page, '&lightAngle=180');
  const skyTop = Math.floor(rows.length * SKY_TOP);
  const horizon = skyTop + rows.slice(skyTop).findIndex((row) => mean(row) > 20);

  expect(horizon, 'a horizon row below the sky').toBeGreaterThan(skyTop);

  const start = horizon + Math.ceil(rows.length * 0.02);
  const below = rows.slice(start, Math.floor(rows.length * 0.5)).flat();
  const slivers = below.filter((sample) => sample < 4).length;

  expect(slivers / below.length, 'share of black samples below the horizon').toBeLessThan(0.01);
});

/**
 * Loads the probe with the camera swaying toward a fixed point at `centerX`
 * across the canvas's middle row, a share of its width, under the
 * reduced-motion `policy`, and returns its rows as sampleRows reads them.
 * The glide is off, so only the sway can move the picture.
 *
 * A fixed point rather than the pointer, because the sway's math is the same
 * for either. The probe's `pointer=1` mode keeps the scene drawing until the
 * pointer settles, and on CI's software GL every Swells frame takes seconds
 * and stalls each Playwright step behind it, so pointer loads ran past the
 * test timeout.
 */
async function rowsSwayingToward(
  page: Page,
  policy: 'off' | 'slow',
  centerX: number,
): Promise<number[][]> {
  return probeRows(
    page,
    `&lightAngle=180&speed=0&parallax=1&parallaxCenter=${centerX},0.5&reducedMotion=${policy}`,
  );
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

// Parallax: a center right of the middle moves the camera right, and the
// camera turns a little to keep facing a point on the ground ahead. Ground
// nearer than that point slides one way and ground beyond it the other, so
// both the near ground and the far ground just under the horizon change.
// The camera never pitches or rolls and keeps its height, so the horizon
// stays at the same row.
test('Swells — a sway toward parallaxCenter orbits the camera at a level horizon', async ({
  page,
}) => {
  const middle = await rowsSwayingToward(page, 'off', 0.5);
  const right = await rowsSwayingToward(page, 'off', 0.85);
  const horizon = horizonRow(middle);
  const farTop = (horizon + 2) / middle.length;
  const farBottom = (horizon + 8) / middle.length;

  expect(bandChange(middle, right, 0.85, 0.95), 'near ground change').toBeGreaterThan(10);
  expect(bandChange(middle, right, farTop, farBottom), 'far ground change').toBeGreaterThan(15);
  expect(
    Math.abs(horizonRow(right) - horizon),
    'horizon move, in 8-pixel rows',
  ).toBeLessThanOrEqual(1);
});

// Under reduced motion the sway holds at 0, so the same move of the center
// changes nothing.
test('Swells — reduced motion holds the sway', async ({ page }) => {
  const middle = await rowsSwayingToward(page, 'slow', 0.5);
  const right = await rowsSwayingToward(page, 'slow', 0.85);
  const horizon = horizonRow(middle);
  const farTop = (horizon + 2) / middle.length;
  const farBottom = (horizon + 8) / middle.length;

  expect(bandChange(middle, right, 0.85, 0.95), 'near ground under reduced motion').toBeLessThan(1);
  expect(
    bandChange(middle, right, farTop, farBottom),
    'far ground under reduced motion',
  ).toBeLessThan(1);
  expect(horizonRow(right), 'horizon row under reduced motion').toBe(horizon);
});

/**
 * Loads the probe with the swell clock at `clock` slices and returns its
 * rows, as sampleRows reads them. swellSpeed 1 and ?phaseTime set the clock
 * to that many slices, and the paused reduced-motion policy every visual
 * test loads under holds it there. The glide is off, so only the swells'
 * strength can change the picture.
 */
async function rowsAtSwellClock(page: Page, clock: number): Promise<number[][]> {
  return probeRows(page, `&lightAngle=180&speed=0&swellSpeed=1&phaseTime=${clock}`);
}

/** The mean brightness change from `before` to `after` over everything below the site header. */
const canvasChange = (before: number[][], after: number[][]) =>
  bandChange(before, after, SKY_TOP, 0.98);

// The swells rise and fall by blending each swell's strength from one noise
// slice into the next as the clock runs through a slice. Partway through,
// the picture differs from both ends. Just short of the end it already
// matches the next slice, which it can only do if the next slice's noise is
// read and blended in full. On macOS the mid-blend frame differed from each
// end by 7 to 9 levels, and the end of a blend matched the next slice to 0,
// so 2 and 0.5 leave room for another GPU.
test("Swells — the swells' strength blends into the next slice", async ({ page }) => {
  const start = await rowsAtSwellClock(page, 0);
  const midway = await rowsAtSwellClock(page, 0.5);
  const almostNext = await rowsAtSwellClock(page, 0.999);
  const next = await rowsAtSwellClock(page, 1);

  expect(canvasChange(start, midway), 'midway against the first slice').toBeGreaterThan(2);
  expect(canvasChange(midway, next), 'midway against the next slice').toBeGreaterThan(2);
  expect(canvasChange(almostNext, next), 'end of the blend against the next slice').toBeLessThan(
    0.5,
  );
});

// The clock counts slices without end, and the shader wraps it into
// STRENGTH_SLICES (64) slices, so the last slice blends back into the first.
// Partway through that last blend the picture differs from where it ends,
// the blend's end matches slice 64, and slice 64 matches slice 0. A next
// slice that didn't wrap would blend toward noise that slice 0 never shows,
// so the swells would jump at the wrap. On macOS the mid-blend frame
// differed by about 5.5 levels, and both matches came to 0.
test('Swells — the swell clock wraps from the last slice to the first', async ({ page }) => {
  const first = await rowsAtSwellClock(page, 0);
  const lastMidway = await rowsAtSwellClock(page, 63.5);
  const almostWrapped = await rowsAtSwellClock(page, 63.999);
  const wrapped = await rowsAtSwellClock(page, 64);

  expect(canvasChange(lastMidway, wrapped), 'last blend midway against its end').toBeGreaterThan(2);
  expect(
    canvasChange(almostWrapped, wrapped),
    'end of the last blend against slice 64',
  ).toBeLessThan(0.5);
  expect(canvasChange(first, wrapped), 'slice 64 against slice 0').toBeLessThan(0.5);
});

/**
 * Loads the probe with the intro on or off under the reduced-motion `policy`
 * and returns its rows, as sampleRows reads them. The glide is off, so
 * only the intro can change the picture.
 */
async function rowsWithIntro(
  page: Page,
  intro: boolean,
  policy: 'off' | 'slow' | 'paused',
): Promise<number[][]> {
  return probeRows(page, `&lightAngle=180&speed=0&intro=${intro ? 1 : 0}&reducedMotion=${policy}`);
}

// The intro raises the surface from flat ground under thick haze. At full
// motion the capture lands a couple of frames in, while the ground is still
// flat and hazed, so it differs from the finished surface the intro-off load
// draws.
test('Swells — the intro plays at full motion', async ({ page }) => {
  const playing = await rowsWithIntro(page, true, 'off');
  const finished = await rowsWithIntro(page, false, 'off');

  expect(
    canvasChange(playing, finished),
    'early intro frame against the finished surface',
  ).toBeGreaterThan(5);
});

// The paused policy, which posters and baselines load under, and the slow
// policy both count as reduced motion. Under either the intro skips to the
// finished surface, so the first frame matches the intro-off load. Each
// policy gets a test of its own because a probe load on CI's software GL
// takes 12 to 23 seconds, and six loads in one test ran past its 90-second
// timeout.
for (const policy of ['paused', 'slow'] as const) {
  test(`Swells — the intro skips under the ${policy} policy`, async ({ page }) => {
    const skipped = await rowsWithIntro(page, true, policy);
    const off = await rowsWithIntro(page, false, policy);

    expect(canvasChange(skipped, off), 'intro on against intro off').toBeLessThan(0.5);
  });
}

// A low light off to one side stretches each crest's shadow over the
// ground behind it, so with `shadows` on the ground reads darker than with
// only each face's own tilt shading it. On macOS the ground's mean fell
// from about 19 levels to about 12.
test('Swells — crests cast shadows under a low light', async ({ page }) => {
  const low = '&lightAngle=60&lightHeight=10';
  const unshadowed = mean(await groundBrightness(page, low));
  const shadowed = mean(await groundBrightness(page, `${low}&shadows=1`));

  expect(unshadowed - shadowed, 'ground, without shadows minus with').toBeGreaterThan(3);
});

// With the light ahead of the camera, the faces in view are turned from it
// and take the shadow color alone. Skylight lifts them toward the lit
// color. On macOS the ground's mean rose from about 26 levels to about 65.
test('Swells — skylight lifts the faces turned from the light', async ({ page }) => {
  const shaded = mean(await groundBrightness(page, '&lightAngle=0'));
  const skylit = mean(await groundBrightness(page, '&lightAngle=0&skylight=1'));

  expect(skylit - shaded, 'ground, with skylight minus without').toBeGreaterThan(20);
});

// The rim glow turns surfaces seen edge-on toward the sheen color, white
// here. The far ground is seen at a low angle and the ground at the
// camera's feet from above, so the far band brightens and the near ground
// barely moves. On macOS the far band rose from about 37 levels to about
// 100, and the near ground by about 5.
test('Swells — the rim glow brightens ground seen edge-on', async ({ page }) => {
  const plain = await probeRows(page, '&lightAngle=0');
  const glowing = await probeRows(page, '&lightAngle=0&rimGlow=1');

  expect(bandShift(plain, glowing, 0.3, 0.4), 'far band, with glow minus without').toBeGreaterThan(
    30,
  );
  expect(
    bandShift(plain, glowing, 0.85, 0.95),
    'near ground, with glow minus without',
  ).toBeLessThan(15);
});

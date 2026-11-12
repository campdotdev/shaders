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
// screenshot, so this checks what the demo must show. The demo mounts a blue
// sky gradient beneath Swells. Above the horizon the ray misses the ground and
// Swells is transparent, so the top rows read blue. The bottom rows are
// ground. No ground pixel reads as sky, and the ground as a whole reads as
// sand, more red than blue on average. And the sun's light varies across the
// ground, so its brightness spreads; unlit ground would be one flat color.
test('Swells — sky above the horizon, lit sand below', async ({ page }) => {
  await page.goto('/components/swells?visualTest=1');
  await waitForShader(page);

  const pixels = await readCanvasPixels(page);
  const across = (y: number) =>
    Array.from({ length: 41 }, (_, step) =>
      pixels.rgb(Math.min(pixels.width - 1, Math.floor((pixels.width * step) / 40)), y),
    );

  for (const [red, , blue] of across(Math.floor(pixels.height * 0.05))) {
    expect(blue, 'sky pixel').toBeGreaterThan(red + 40);
  }

  const groundRows = [0.7, 0.8, 0.9].map((share) => across(Math.floor(pixels.height * share)));
  const ground = groundRows.flat();

  for (const [red, , blue] of ground) {
    expect(blue, 'ground pixel, not sky').toBeLessThan(red + 40);
  }

  const meanOf = (channel: 0 | 2) =>
    ground.reduce((sum, pixel) => sum + pixel[channel], 0) / ground.length;

  expect(meanOf(0), 'sand: mean red over mean blue').toBeGreaterThan(meanOf(2) + 8);

  const brightness = ground.map(([red, green, blue]) => (red + green + blue) / 3);

  expect(Math.max(...brightness) - Math.min(...brightness), 'slope light spread').toBeGreaterThan(
    12,
  );
});

// The probe draws the sand in gray, from near black on faces turned from the
// sun to near white on faces turned toward it, over a black canvas. Query
// params set Swells' dials.
const PROBE = '/dev/swells-probe?visualTest=1';

/**
 * Loads the probe with `query` appended and returns the brightness, 0 to 255,
 * at points spread over its ground: the bottom third of the canvas, which
 * lies below the horizon at the default camera.
 */
async function groundBrightness(page: Page, query: string): Promise<number[]> {
  await page.goto(`${PROBE}${query}`);
  await page.locator('canvas').first().waitFor();
  await waitForShader(page);

  const { width, height, rgb } = await readCanvasPixels(page);
  const samples: number[] = [];

  for (let y = Math.floor(height * 0.65); y < Math.floor(height * 0.98); y += 8) {
    for (let x = 0; x < width; x += 8) {
      const [red, green, blue] = rgb(x, y);

      samples.push((red + green + blue) / 3);
    }
  }

  return samples;
}

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

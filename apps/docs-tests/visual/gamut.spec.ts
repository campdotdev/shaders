import { expect, test } from '@playwright/test';

import { waitForShader } from './helpers';

/**
 * Smoke test for the forced-P3 output path. Renders the same out-of-sRGB green
 * twice — once with `gamut="srgb"`, once with `gamut="p3"` — and asserts both
 * ShaderScenes initialize and render without error.
 *
 * Why not assert the pixels widen? A WebGPU canvas can't be read back via
 * `drawImage`/`getImageData` (the drawing buffer is gone after present, returns
 * zeros), and a Playwright screenshot is color-managed to sRGB, which collapses
 * the P3-vs-sRGB difference we'd want to measure. So output-widening is validated
 * by eye on a P3 display; the deterministic automated proof that wide-gamut colors
 * decode to extended linear-sRGB lives in the `parseColorString` unit tests
 * (`packages/shaders`). This spec guards that the P3 output path itself stays alive
 * (the manual context.configure into Display P3 doesn't throw or blank the canvas).
 */
test('gamut probe — sRGB and P3 output paths both render without error', async ({ page }) => {
  const pageErrors: Error[] = [];

  page.on('pageerror', (error) => pageErrors.push(error));

  await page.goto('/dev/gamut-probe?visualTest=1');
  await page.locator('[data-gamut="srgb"] canvas').waitFor();
  await page.locator('[data-gamut="p3"] canvas').waitFor();
  await waitForShader(page);
  // Both halves run their own VisualTestPause; give the second a beat to settle.
  await page.waitForTimeout(200);

  for (const gamut of ['srgb', 'p3'] as const) {
    const size = await page.locator(`[data-gamut="${gamut}"] canvas`).evaluate((element) => {
      const canvas = element as HTMLCanvasElement;

      return { width: canvas.width, height: canvas.height };
    });

    expect(size.width, `${gamut} canvas width`).toBeGreaterThan(0);
    expect(size.height, `${gamut} canvas height`).toBeGreaterThan(0);
  }

  expect(pageErrors, pageErrors.map((error) => error.message).join('\n')).toHaveLength(0);
});

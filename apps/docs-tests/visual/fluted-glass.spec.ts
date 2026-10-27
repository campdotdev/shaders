import type { Page } from '@playwright/test';

import { expect, test } from './fixtures';
import { waitForShader } from './helpers';

test('FlutedGlass — default story', async ({ page }) => {
  await page.goto('/components/fluted-glass?visualTest=1');
  await waitForShader(page);
  await expect(page.locator('canvas').first()).toHaveScreenshot('fluted-glass-default.png');
});

// The probe draws hard diagonal stripes under FlutedGlass at its defaults.
// FlutedGlass's default flute width in CSS pixels, which is device pixels at
// the config's deviceScaleFactor of 1. A flute's center sits on the canvas
// center, so the grooves fall half a flute either side of it and every flute
// width beyond.
const FLUTE_WIDTH = 40;
// How far either side of a groove each sample column sits. Wide enough to
// step clear of the groove's own pixel, narrow enough that unbroken stripes
// rarely change between the two columns.
const COLUMN_OFFSET = 3;

/**
 * The share of rows where the pixels just left and just right of a groove
 * fall on different sides of mid-gray, over every groove on the canvas. On
 * unbroken stripes the two columns differ only where a stripe edge passes
 * between them. Through the glass they read the image from far apart, so
 * they differ far more often.
 */
async function grooveBreaks(page: Page, url: string): Promise<number> {
  await page.goto(url);
  await page.locator('canvas').first().waitFor();
  await waitForShader(page);

  const shot = await page.locator('canvas').first().screenshot();

  return page.evaluate(
    async ({ pngBase64, fluteWidth, columnOffset }) => {
      const response = await fetch(`data:image/png;base64,${pngBase64}`);
      const bitmap = await createImageBitmap(await response.blob());
      const canvas = document.createElement('canvas');

      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext('2d')!;

      context.drawImage(bitmap, 0, 0);
      const pixels = context.getImageData(0, 0, bitmap.width, bitmap.height).data;
      const isLight = (x: number, y: number) => {
        const index = (y * bitmap.width + x) * 4;

        return (
          ((pixels[index] ?? 0) + (pixels[index + 1] ?? 0) + (pixels[index + 2] ?? 0)) / 3 > 128
        );
      };

      // The first groove right of the canvas's left edge, then every flute
      // width after it.
      const center = bitmap.width / 2;
      const firstGroove =
        center + fluteWidth / 2 - Math.floor((center + fluteWidth / 2) / fluteWidth) * fluteWidth;
      // The middle band of rows, clear of the site header drawn over the
      // top of the canvas.
      const top = Math.floor(bitmap.height * 0.2);
      const bottom = Math.floor(bitmap.height * 0.8);

      let pairs = 0;
      let breaks = 0;

      for (let groove = firstGroove; groove < bitmap.width; groove += fluteWidth) {
        const left = Math.round(groove) - columnOffset;
        const right = Math.round(groove) + columnOffset;

        if (left < 0 || right >= bitmap.width) continue;
        for (let y = top; y < bottom; y += 1) {
          pairs += 1;
          if (isLight(left, y) !== isLight(right, y)) breaks += 1;
        }
      }

      return breaks / pairs;
    },
    { pngBase64: shot.toString('base64'), fluteWidth: FLUTE_WIDTH, columnOffset: COLUMN_OFFSET },
  );
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
  const inert = await grooveBreaks(
    page,
    '/dev/fluted-glass-probe?visualTest=1&highlight=0&shadow=0&refraction=0',
  );
  const glass = await grooveBreaks(
    page,
    '/dev/fluted-glass-probe?visualTest=1&highlight=0&shadow=0',
  );

  expect(glass, `groove breaks: glass ${glass}, inert ${inert}`).toBeGreaterThan(inert + 0.2);
});

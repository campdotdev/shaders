import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

const SPACES = ['linear', 'oklab', 'oklch', 'lch', 'hsl', 'hsv'] as const;
const ROWS = SPACES.length;

/** Top-down y fraction of the vertical center of row `index` (uv().y is bottom-up, so row 0 is at the bottom). */
function rowYFraction(index: number): number {
  return 1 - (index + 0.5) / ROWS;
}

/** Sample one pixel of the probe canvas at fractional (x, y) coordinates (0..1, top-down). */
async function samplePixel(
  page: Page,
  xFraction: number,
  yFraction: number,
): Promise<[number, number, number]> {
  const shot = await page.locator('canvas').first().screenshot();
  const base64 = shot.toString('base64');

  return page.evaluate(
    async ({ pngBase64, sampleX, sampleY }) => {
      const response = await fetch(`data:image/png;base64,${pngBase64}`);
      const bitmap = await createImageBitmap(await response.blob());
      const canvas = document.createElement('canvas');

      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext('2d')!;

      context.drawImage(bitmap, 0, 0);
      const x = Math.min(bitmap.width - 1, Math.floor(bitmap.width * sampleX));
      const y = Math.min(bitmap.height - 1, Math.floor(bitmap.height * sampleY));
      const pixel = context.getImageData(x, y, 1, 1).data;

      return [pixel[0], pixel[1], pixel[2]] as [number, number, number];
    },
    { pngBase64: base64, sampleX: xFraction, sampleY: yFraction },
  );
}

async function openProbe(page: Page): Promise<void> {
  await page.goto('/dev/color-space-probe');
  await page.locator('canvas').first().waitFor();
  // Static render (no animation); a short settle is enough.
  await page.waitForTimeout(2000);
}

test('endpoints round-trip: each space row is yellow on the left, blue on the right', async ({
  page,
}) => {
  await openProbe(page);

  for (let rowIndex = 0; rowIndex < ROWS; rowIndex += 1) {
    const y = rowYFraction(rowIndex);
    const [leftR, leftG, leftB] = await samplePixel(page, 0.01, y);
    const [rightR, rightG, rightB] = await samplePixel(page, 0.99, y);
    const space = SPACES[rowIndex];

    // Left edge == round-trip(yellow) ~ yellow. The green channel here is what
    // guards conversion bugs that crush a single channel (e.g. the LCH matrix).
    expect(leftR, `${space} left (${leftR},${leftG},${leftB})`).toBeGreaterThan(210);
    expect(leftG, `${space} left (${leftR},${leftG},${leftB})`).toBeGreaterThan(210);
    expect(leftB, `${space} left (${leftR},${leftG},${leftB})`).toBeLessThan(85);

    // Right edge == round-trip(blue) ~ blue.
    expect(rightB, `${space} right (${rightR},${rightG},${rightB})`).toBeGreaterThan(210);
    expect(rightR, `${space} right (${rightR},${rightG},${rightB})`).toBeLessThan(85);
    expect(rightG, `${space} right (${rightR},${rightG},${rightB})`).toBeLessThan(60);
  }
});

test('oklab yellow->blue midpoint stays chromatic (not the gray of a naive average)', async ({
  page,
}) => {
  await openProbe(page);

  const y = rowYFraction(SPACES.indexOf('oklab'));
  const [red, green, blue] = await samplePixel(page, 0.5, y);
  const spread = Math.max(red, green, blue) - Math.min(red, green, blue);

  // A naive linear average of yellow and blue is mid-gray (spread ~0); the
  // perceptual oklab path stays a saturated teal (spread ~90).
  expect(spread, `oklab midpoint (${red}, ${green}, ${blue})`).toBeGreaterThan(40);
});

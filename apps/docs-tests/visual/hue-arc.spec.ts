import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

import { waitForShader } from './helpers';

// Row order MUST match the probe's MODES array (row 0 = bottom, uv().y bottom-up).
const MODES = ['shorter', 'longer', 'increasing', 'decreasing'] as const;
const ROWS = MODES.length;

// For the blue->yellow pair the wheel splits cleanly in two: shorter/decreasing
// run the midpoint through cyan/green (G > R); longer/increasing run it through
// magenta/orange (R > G). That R-vs-G flip is the non-circular check that each
// keyword resolves to the correct arc direction.
const EXPECT_GREEN_SIDE: Record<(typeof MODES)[number], boolean> = {
  shorter: true,
  decreasing: true,
  longer: false,
  increasing: false,
};

/** Top-down y fraction of the vertical center of row `index` (uv().y is bottom-up). */
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
  await page.goto('/dev/hue-arc-probe?visualTest=1');
  await page.locator('canvas').first().waitFor();
  await waitForShader(page);
}

test('blue->yellow OKLch midpoint lands on the arc each hueInterpolation mode selects', async ({
  page,
}) => {
  await openProbe(page);

  for (const [rowIndex, mode] of MODES.entries()) {
    const y = rowYFraction(rowIndex);

    // Endpoints hold regardless of arc: left ~ blue, right ~ yellow.
    const [, , leftB] = await samplePixel(page, 0.01, y);
    const [rightR, rightG] = await samplePixel(page, 0.99, y);

    expect(leftB, `${mode} left edge should be blue`).toBeGreaterThan(180);
    expect(Math.min(rightR, rightG), `${mode} right edge should be yellow`).toBeGreaterThan(140);

    // The midpoint hue is what the arc direction decides.
    const [midR, midG, midB] = await samplePixel(page, 0.5, y);
    const detail = `${mode} midpoint (${midR}, ${midG}, ${midB})`;

    if (EXPECT_GREEN_SIDE[mode]) {
      expect(midG, `${detail} should be cyan/green side (G > R)`).toBeGreaterThan(midR + 20);
    } else {
      expect(midR, `${detail} should be magenta/orange side (R > G)`).toBeGreaterThan(midG + 20);
    }
  }
});

// Exercise the mounted effect through pointer input and the real GPU.
// The browser clock fixes stroke timing; no displacement-field internals
// are exposed to the test or used to seed the image.
import type { Page } from '@playwright/test';

import { expect, test } from './fixtures';

// ---- Controlled browser input and image comparison
async function openProbe(page: Page, source = 'LiquidGradient') {
  await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
  await page.goto('/dev/cursor-smudge-probe');
  const canvas = page.locator('canvas').first();

  await canvas.waitFor();
  await expect(page.locator('[data-smudge-probe]')).toContainText(/ticks: [1-9]/);
  if (source === 'LinearGradient') {
    await page.getByRole('combobox', { name: 'Source', exact: true }).click();
    await page.getByRole('option', { name: 'LinearGradient', exact: true }).click();
  }
  await page.clock.pauseAt(new Date('2026-01-01T01:00:00Z'));
  await page.clock.runFor(64);
  // The HTML monitor overlaps the canvas but is not part of the GPU output.
  await page.addStyleTag({ content: '[data-testid="shaders-monitor"] { visibility: hidden; }' });

  return canvas;
}

async function changedPixels(page: Page, before: Buffer, after: Buffer) {
  return page.evaluate(
    async ([first, second]) => {
      const read = async (png: string) => {
        const response = await fetch(`data:image/png;base64,${png}`);
        const bitmap = await createImageBitmap(await response.blob());
        const scratch = document.createElement('canvas');

        scratch.width = bitmap.width;
        scratch.height = bitmap.height;
        const context = scratch.getContext('2d')!;

        context.drawImage(bitmap, 0, 0);
        bitmap.close();

        return context.getImageData(0, 0, scratch.width, scratch.height).data;
      };
      const [left, right] = await Promise.all([read(first!), read(second!)]);
      let changed = 0;

      for (let index = 0; index < left.length; index += 4) {
        const difference =
          Math.abs(left[index]! - right[index]!) +
          Math.abs(left[index + 1]! - right[index + 1]!) +
          Math.abs(left[index + 2]! - right[index + 2]!);

        if (difference > 3) changed++;
      }

      return changed;
    },
    [before.toString('base64'), after.toString('base64')],
  );
}

async function swipe(page: Page) {
  const box = await page.locator('canvas').first().boundingBox();

  if (!box) throw new Error('The smudge canvas has no bounding box');
  for (let step = 0; step <= 12; step++) {
    await page.mouse.move(box.x + box.width * (0.2 + step * 0.05), box.y + box.height * 0.6);
    await page.clock.runFor(16);
  }
  // Input is gathered after drawing, so let the last stroke reach the image.
  await page.clock.runFor(32);
}

// ---- GPU output through the mounted component
test('CursorSmudge pulls a still LiquidGradient along a swipe', async ({ page }) => {
  const canvas = await openProbe(page);

  await swipe(page);
  await expect(canvas).toHaveScreenshot('cursor-smudge-active.png');
});

for (const source of ['LiquidGradient', 'LinearGradient']) {
  test(`CursorSmudge distorts ${source} and returns to its original image`, async ({ page }) => {
    const canvas = await openProbe(page, source);
    const before = await canvas.screenshot();

    await swipe(page);
    expect(await changedPixels(page, before, await canvas.screenshot())).toBeGreaterThan(500);
    await page.clock.runFor(4000);
    expect(await changedPixels(page, before, await canvas.screenshot())).toBe(0);
  });
}

test('CursorSmudge at zero strength leaves the GPU image unchanged', async ({ page }) => {
  const canvas = await openProbe(page);
  const strength = page.getByRole('slider', { name: 'Strength', exact: true });

  await strength.press('Home');
  await expect(strength).toHaveAttribute('aria-valuenow', '0');
  await page.clock.runFor(32);
  const before = await canvas.screenshot();

  await swipe(page);
  expect(await changedPixels(page, before, await canvas.screenshot())).toBe(0);
});

test('zero decay holds the GPU distortion until recovery or clearing is requested', async ({
  page,
}) => {
  const canvas = await openProbe(page);
  const decay = page.getByRole('slider', { name: 'Decay', exact: true });

  // Keep rendering to prove persistence also holds beside an animated Source.
  await page.getByRole('checkbox', { name: 'Keep drawing for GPU measurement' }).check();
  await decay.press('Home');
  await expect(decay).toHaveAttribute('aria-valuenow', '0');
  await page.clock.runFor(32);
  const original = await canvas.screenshot();

  await swipe(page);
  const held = await canvas.screenshot();

  expect(await changedPixels(page, original, held)).toBeGreaterThan(500);
  await page.clock.runFor(6000);
  expect(await changedPixels(page, held, await canvas.screenshot())).toBe(0);

  await decay.press('End');
  await page.clock.runFor(64);
  expect(await changedPixels(page, original, await canvas.screenshot())).toBeGreaterThan(100);
  await page.clock.runFor(1000);
  expect(await changedPixels(page, original, await canvas.screenshot())).toBe(0);

  await decay.press('Home');
  await page.clock.runFor(32);
  await swipe(page);
  expect(await changedPixels(page, original, await canvas.screenshot())).toBeGreaterThan(500);
  await page.getByRole('slider', { name: 'Strength', exact: true }).press('Home');
  await page.clock.runFor(32);
  expect(await changedPixels(page, original, await canvas.screenshot())).toBe(0);
});

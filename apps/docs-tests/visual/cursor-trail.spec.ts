// CursorTrail (SHA-169) through pointer input and the real GPU, on its dev
// probe at the probe's defaults: decay 0.75, grow 0.3, hold off. The
// browser clock fixes stroke timing, so the moving trail is the same image
// on every run. Headless Chromium takes the WebGL2 fallback (ADR 0003), so
// these run on the backend the trail must support.
import type { Page } from '@playwright/test';

import { expect, test } from './fixtures';
import { changedPixels } from './helpers';

// The trail draws in over the probe's 0.75 s decay. Add margin.
const DRAW_IN_MS = 1000;
// A held spot settles later: grow eases it back to its base size, and it
// snaps there about 1.6 s after a fast stroke. Add margin.
const SETTLE_MS = 2000;

// ---- Controlled browser input
async function openProbe(page: Page, { hold = false } = {}) {
  await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
  await page.goto('/dev/cursor-trail-probe');
  const canvas = page.locator('[data-trail-probe] canvas').first();

  await canvas.waitFor();
  await expect(page.locator('[data-trail-probe]')).toContainText(/ticks: [1-9]/);
  // Pick options before pausing the clock: the select's popup opens on
  // timers that a paused clock never runs.
  if (hold) {
    await page.getByRole('combobox', { name: 'Hold', exact: true }).click();
    await page.getByRole('option', { name: /^On/ }).click();
  }
  await page.clock.pauseAt(new Date('2026-01-01T01:00:00Z'));
  await page.clock.runFor(64);
  // The HTML monitor overlaps the canvas but is not part of the GPU output.
  await page.addStyleTag({ content: '[data-testid="shaders-monitor"] { visibility: hidden; }' });

  return canvas;
}

// A curve across the canvas, one move per 16 ms frame, so the trail bends
// with the path rather than running straight.
async function swipe(page: Page) {
  const box = await page.locator('[data-trail-probe] canvas').first().boundingBox();

  if (!box) throw new Error('The trail canvas has no bounding box');
  for (let step = 0; step <= 20; step++) {
    const along = step / 20;

    await page.mouse.move(
      box.x + box.width * (0.2 + 0.5 * along),
      box.y + box.height * (0.5 + 0.25 * Math.sin(along * Math.PI * 1.5)),
    );
    await page.clock.runFor(16);
  }
  // Input is gathered after drawing, so let the last stroke reach the image.
  await page.clock.runFor(32);
}

// ---- GPU output through the mounted component
test('CursorTrail draws a tapering trail along a moving pointer', async ({ page }) => {
  const canvas = await openProbe(page);

  await swipe(page);
  await expect(canvas).toHaveScreenshot('cursor-trail-moving.png');
});

test('CursorTrail draws in and leaves the original image once the pointer stops', async ({
  page,
}) => {
  const canvas = await openProbe(page);
  const before = await canvas.screenshot();

  await swipe(page);
  expect(await changedPixels(page, before, await canvas.screenshot())).toBeGreaterThan(500);
  await page.clock.runFor(DRAW_IN_MS);
  expect(await changedPixels(page, before, await canvas.screenshot())).toBe(0);
});

test('CursorTrail with hold keeps a steady spot under a still pointer', async ({ page }) => {
  const canvas = await openProbe(page, { hold: true });
  const before = await canvas.screenshot();

  await swipe(page);
  await page.clock.runFor(SETTLE_MS);
  const held = await canvas.screenshot();

  await expect(canvas).toHaveScreenshot('cursor-trail-held.png');
  // Steady: a second later the spot hasn't changed.
  await page.clock.runFor(1000);
  expect(await changedPixels(page, held, await canvas.screenshot())).toBe(0);
  // It fades once the pointer leaves the canvas.
  await page.mouse.move(0, 0);
  await page.clock.runFor(DRAW_IN_MS);
  expect(await changedPixels(page, before, await canvas.screenshot())).toBe(0);
});

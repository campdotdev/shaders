import type { Page } from '@playwright/test';

import { expect, test } from './fixtures';
import { waitForShader } from './helpers';

// CursorSpotlight (SHA-159) lit over its demo's RadialGradient. `pointer=1`
// tells VisualTestPause to hold the capture until the spec has moved the
// pointer and the spotlight has settled on it: the light eases its position
// and presence and then lands exactly on both, so the frame is the same
// however many frames the settle took.
const PAGE_URL = '/components/cursor-spotlight?visualTest=1&pointer=1';

// Left of and above center, so the light sits off the gradient's own bright
// core and reads as a separate highlight. Fractions of the canvas box.
const POINTER_AT = [0.3, 0.4] as const;

async function openLit(page: Page) {
  await page.goto(PAGE_URL);
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
  await page.mouse.move(box.x + box.width * POINTER_AT[0], box.y + box.height * POINTER_AT[1]);
  await waitForShader(page);

  return canvas;
}

test('CursorSpotlight — lit under a still pointer', async ({ page }) => {
  const canvas = await openLit(page);

  await expect(canvas).toHaveScreenshot('cursor-spotlight-lit.png');
});

// A regenerated baseline of an unlit frame would pass its own screenshot,
// so this checks the light is there at all. The default RadialGradient is
// symmetric about the canvas center, so without the spotlight the pixel
// under the pointer and its mirror through the center read the same. Lit,
// the pointer's side reads about 30% brighter at intensity 0.75; 15
// levels is far below that and far above any precision drift.
test('CursorSpotlight — brightens under the pointer', async ({ page }) => {
  const canvas = await openLit(page);
  const shot = await canvas.screenshot();
  const levels = await page.evaluate(
    async ({ pngBase64, pointer }) => {
      const response = await fetch(`data:image/png;base64,${pngBase64}`);
      const bitmap = await createImageBitmap(await response.blob());
      const scratch = document.createElement('canvas');

      scratch.width = bitmap.width;
      scratch.height = bitmap.height;
      const context = scratch.getContext('2d')!;

      context.drawImage(bitmap, 0, 0);
      const luminanceAt = (fractionX: number, fractionY: number) => {
        const x = Math.floor(bitmap.width * fractionX);
        const y = Math.floor(bitmap.height * fractionY);
        const [red = 0, green = 0, blue = 0] = context.getImageData(x, y, 1, 1).data;

        return (red + green + blue) / 3;
      };

      return {
        lit: luminanceAt(pointer[0], pointer[1]),
        mirror: luminanceAt(1 - pointer[0], 1 - pointer[1]),
      };
    },
    { pngBase64: shot.toString('base64'), pointer: POINTER_AT },
  );

  const detail = JSON.stringify(levels);

  expect(levels.lit, `spotlight missing: ${detail}`).toBeGreaterThan(levels.mirror + 15);
});

import type { Page } from '@playwright/test';

/**
 * Waits for the shader to finish its first deterministic frame and settle.
 * Pages set `window.__shadersTestReady = true` via VisualTestPause after the
 * second frame. The extra 50ms absorbs any micro-jitter before the screenshot.
 * The timeout budgets for SwiftShader on 2-core CI runners, where a heavy
 * raymarch (aurora: 60 slices, each reading a field texture) needs several
 * seconds per frame.
 */
export async function waitForShader(page: Page): Promise<void> {
  await page.waitForFunction(
    () => (window as unknown as { __shadersTestReady?: boolean }).__shadersTestReady === true,
    undefined,
    { timeout: 60_000 },
  );
  await page.waitForTimeout(50);
}

/** A canvas read back from a screenshot, three bytes per pixel. */
export interface CanvasPixels {
  width: number;
  height: number;
  /** Red, green, and blue from 0 to 255 at a pixel. */
  rgb: (x: number, y: number) => [number, number, number];
}

/**
 * Reads the page's first canvas pixel by pixel. The screenshot decodes in the
 * page, which has the browser's PNG decoder, and comes back as three bytes
 * per pixel: red, green, and blue.
 */
export async function readCanvasPixels(page: Page): Promise<CanvasPixels> {
  const shot = await page.locator('canvas').first().screenshot();
  const { width, height, bytes } = await page.evaluate(async (pngBase64) => {
    const response = await fetch(`data:image/png;base64,${pngBase64}`);
    const bitmap = await createImageBitmap(await response.blob());
    const canvas = document.createElement('canvas');

    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d')!;

    context.drawImage(bitmap, 0, 0);
    const rgba = context.getImageData(0, 0, bitmap.width, bitmap.height).data;
    let binary = '';

    for (let index = 0; index < rgba.length; index += 4) {
      binary += String.fromCharCode(rgba[index] ?? 0, rgba[index + 1] ?? 0, rgba[index + 2] ?? 0);
    }

    return { width: bitmap.width, height: bitmap.height, bytes: btoa(binary) };
  }, shot.toString('base64'));
  const pixels = Buffer.from(bytes, 'base64');
  const channel = (x: number, y: number, offset: number) =>
    pixels[(y * width + x) * 3 + offset] ?? 0;

  return {
    width,
    height,
    rgb: (x, y) => [channel(x, y, 0), channel(x, y, 1), channel(x, y, 2)],
  };
}

/**
 * How many pixels differ between two screenshots of the same canvas, by more
 * than 3 levels summed over red, green, and blue. Decodes in the page, which
 * has the browser's PNG decoder.
 */
export async function changedPixels(page: Page, before: Buffer, after: Buffer) {
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

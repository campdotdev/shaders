import { expect, test } from '@playwright/test';

import { waitForShader } from './helpers';

/**
 * Regression for the WGSL compile crash: mixing out-of-sRGB colors in HSL/HSV
 * routed through the sRGB transfer's `pow()`, which WGSL can't const-evaluate on
 * a negative base — the fragment shader failed to compile and the canvas went
 * black. Asserts both spaces render a non-black gradient with no shader error.
 */
test('HSL/HSV mixing of wide-gamut colors compiles and renders', async ({ page }) => {
  const shaderErrors: string[] = [];

  page.on('console', (message) => {
    const text = message.text();

    if (/WGSL|ShaderModule|RenderPipeline/i.test(text)) shaderErrors.push(text);
  });

  await page.goto('/dev/hsl-gamut-probe?visualTest=1');
  await page.locator('[data-space="hsv"] canvas').waitFor();
  await waitForShader(page);
  await page.waitForTimeout(200);

  for (const space of ['hsl', 'hsv'] as const) {
    const shot = await page.locator(`[data-space="${space}"] canvas`).screenshot();
    const brightness = await page.evaluate(async (pngBase64) => {
      const response = await fetch(`data:image/png;base64,${pngBase64}`);
      const bitmap = await createImageBitmap(await response.blob());
      const canvas = document.createElement('canvas');

      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext('2d')!;

      context.drawImage(bitmap, 0, 0);
      const pixel = context.getImageData(bitmap.width >> 1, bitmap.height >> 1, 1, 1).data;

      return (pixel[0] ?? 0) + (pixel[1] ?? 0) + (pixel[2] ?? 0);
    }, shot.toString('base64'));

    // A failed-compile canvas is black/transparent; a real gradient is not.
    expect(brightness, `${space} center brightness`).toBeGreaterThan(30);
  }

  expect(shaderErrors, shaderErrors.join('\n')).toHaveLength(0);
});

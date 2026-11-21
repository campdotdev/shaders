import { expect, test } from './fixtures';
import { readCanvasPixels, waitForShader } from './helpers';

// The shimmer's look changes in every build phase, so the baseline
// screenshot waits for the defaults gate (SHA-344). Until then this spec
// checks that the page draws on the WebGL2 fallback, which headless
// Chromium runs, and that the canvas shows the photo rather than nothing.

test('HeatShimmer — default story renders on the WebGL2 fallback', async ({ page }) => {
  await page.goto('/components/heat-shimmer?visualTest=1');
  await waitForShader(page);

  const backend = await page.evaluate(
    () => (window as unknown as { __shadersBackend?: string }).__shadersBackend,
  );

  expect(backend).toBe('webgl2');

  // A blank or black canvas would read one flat color. The photo's
  // flowers, vase, and wall spread the brightness across the canvas.
  const pixels = await readCanvasPixels(page);
  const brightness: number[] = [];

  for (let step = 1; step < 20; step += 1) {
    const [red, green, blue] = pixels.rgb(
      Math.floor((pixels.width * step) / 20),
      Math.floor((pixels.height * step) / 20),
    );

    brightness.push((red + green + blue) / 3);
  }

  expect(Math.max(...brightness) - Math.min(...brightness)).toBeGreaterThan(40);
});

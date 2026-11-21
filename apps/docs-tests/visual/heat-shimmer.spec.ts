import { expect, test } from './fixtures';
import { changedPixels, readCanvasPixels, waitForShader } from './helpers';

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

// The photo alone spreads the brightness, so the check above passes even
// when the shimmer moves nothing. This one loads the probe twice, once at
// strength 0, which leaves the photo exactly as it is, and once at the
// default strength, and counts the pixels that differ. A shimmer that stops
// moving the photo changes none of them. Neither load is a baseline, so the
// provisional look can keep changing until the defaults gate.
//
// The least number of pixels the shimmer must change. On macOS the default
// strength changed about 355,000 of the 1280 x 720 canvas's 921,600, and two
// loads at strength 0 changed none, so this leaves room for another GPU and
// for the defaults to soften.
const MIN_CHANGED_PIXELS = 50_000;

test('HeatShimmer — nonzero strength moves the photo', async ({ page }) => {
  const capture = async (query: string) => {
    await page.goto(`/dev/heat-shimmer-probe?visualTest=1${query}`);
    await page.locator('canvas').first().waitFor();
    await waitForShader(page);

    return page.locator('canvas').first().screenshot();
  };
  const still = await capture('&strength=0');
  const shimmering = await capture('');
  const changed = await changedPixels(page, still, shimmering);

  expect(changed).toBeGreaterThan(MIN_CHANGED_PIXELS);
});

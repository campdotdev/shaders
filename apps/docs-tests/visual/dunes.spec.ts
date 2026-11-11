import { expect, test } from './fixtures';
import { readCanvasPixels, waitForShader } from './helpers';

// Dunes marches a ray per pixel in a fixed-count loop, which the WebGL2
// fallback accepts only with a constant bound. Headless Chromium runs that
// fallback, so this spec is the check that the march compiles there.
test('Dunes — default story', async ({ page }) => {
  await page.goto('/components/dunes?visualTest=1');
  await waitForShader(page);

  const backend = await page.evaluate(
    () => (window as unknown as { __shadersBackend?: string }).__shadersBackend,
  );

  expect(backend).toBe('webgl2');
  await expect(page.locator('canvas').first()).toHaveScreenshot('dunes-default.png');
});

// A baseline regenerated from blank or unlit output would pass its own
// screenshot, so this checks what the demo must show. The demo mounts a blue
// sky gradient beneath Dunes. Above the horizon the ray misses the ground and
// Dunes is transparent, so the top rows read blue. The bottom rows are
// ground, which reads sand: more red than blue. And the slope light varies
// across the ground, so its brightness spreads; unlit ground would be one
// flat color.
test('Dunes — sky above the horizon, lit sand below', async ({ page }) => {
  await page.goto('/components/dunes?visualTest=1');
  await waitForShader(page);

  const pixels = await readCanvasPixels(page);
  const across = (y: number) =>
    Array.from({ length: 41 }, (_, step) =>
      pixels.rgb(Math.min(pixels.width - 1, Math.floor((pixels.width * step) / 40)), y),
    );

  for (const [red, , blue] of across(Math.floor(pixels.height * 0.05))) {
    expect(blue, 'sky pixel').toBeGreaterThan(red + 40);
  }

  const groundRows = [0.7, 0.8, 0.9].map((share) => across(Math.floor(pixels.height * share)));
  const ground = groundRows.flat();

  for (const [red, , blue] of ground) {
    expect(red, 'sand pixel').toBeGreaterThan(blue + 30);
  }

  const brightness = ground.map(([red, green, blue]) => (red + green + blue) / 3);

  expect(Math.max(...brightness) - Math.min(...brightness), 'slope light spread').toBeGreaterThan(
    12,
  );
});

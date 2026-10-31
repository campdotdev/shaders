import { expect, test } from './fixtures';
import { waitForShader } from './helpers';

/**
 * The fixture composition, once per preset, Default included. Every
 * composition renders on the WebGL2 fallback, as ADR 0005 decides, and CI's
 * headless Chromium has no WebGPU, so the spec asserts the backend before any
 * screenshot: a runner that gains WebGPU fails here instead of quietly
 * dropping the fallback's coverage. The picker loads each preset, and
 * VisualTestPause remounts on the load to capture a fresh frame, so the spec
 * clears the ready flag first and waits for it to rise again.
 */

const PRESETS = ['Tight', 'Coarse'];

// A preset's name in its baseline's file name, by the kebab-case rule its
// golden file takes in apps/docs/src/compositions/generate.ts.
const fileName = (preset: string) =>
  preset
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 0)
    .join('-');

// The stack ends in Grain, a noise shader whose SwiftShader precision drifts
// across arm64 and amd64 past the 0.02 default, as in grain.spec.ts.
const MAX_DIFF_PIXEL_RATIO = 0.05;

test('Fixture composition — every preset, on WebGL2', async ({ page }) => {
  await page.goto('/gallery/fixture?visualTest=1');
  await waitForShader(page);

  const backend = await page.evaluate(
    () => (window as unknown as { __shadersBackend?: string }).__shadersBackend,
  );

  expect(backend).toBe('webgl2');

  const canvas = page.locator('[data-shader-demo] canvas');

  await expect(canvas).toHaveScreenshot('gallery-fixture-default.png', {
    maxDiffPixelRatio: MAX_DIFF_PIXEL_RATIO,
  });

  for (const preset of PRESETS) {
    await page.evaluate(() => {
      (window as unknown as { __shadersTestReady?: boolean }).__shadersTestReady = false;
    });
    await page.getByRole('combobox', { name: 'Preset' }).click();
    await page.getByRole('option', { name: preset }).click();
    await waitForShader(page);

    await expect(canvas).toHaveScreenshot(`gallery-fixture-${fileName(preset)}.png`, {
      maxDiffPixelRatio: MAX_DIFF_PIXEL_RATIO,
    });
  }
});

import { expect, test } from './fixtures';
import { waitForShader } from './helpers';

test('FractalNoise — default story', async ({ page }) => {
  await page.goto('/components/fractal-noise?visualTest=1');
  await waitForShader(page);
  await expect(page.locator('canvas').first()).toHaveScreenshot('fractal-noise-default.png');
});

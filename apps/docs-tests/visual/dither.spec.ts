import { expect, test } from './fixtures';
import { waitForShader } from './helpers';

test('Dither — default story', async ({ page }) => {
  await page.goto('/components/dither?visualTest=1');
  await waitForShader(page);
  // Posterized blocks are high-contrast: a SwiftShader precision wobble near
  // a threshold flips whole cells, so allow more drift than the 0.02 default
  // (same reasoning as grain's tolerance).
  await expect(page.locator('canvas').first()).toHaveScreenshot('dither-default.png', {
    maxDiffPixelRatio: 0.05,
  });
});

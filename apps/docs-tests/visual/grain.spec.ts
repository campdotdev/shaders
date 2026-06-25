import { expect, test } from './fixtures';
import { waitForShader } from './helpers';

test('Grain — default story', async ({ page }) => {
  await page.goto('/components/grain?visualTest=1');
  await waitForShader(page);
  // Noise shader: SwiftShader precision drifts across arm64/amd64 past the 0.02 default.
  await expect(page.locator('canvas').first()).toHaveScreenshot('grain-default.png', {
    maxDiffPixelRatio: 0.05,
  });
});

import { expect, test } from './fixtures';

import { waitForShader } from './helpers';

test('SimplexNoise — default story', async ({ page }) => {
  await page.goto('/components/simplex-noise?visualTest=1');
  await waitForShader(page);
  await expect(page.locator('canvas').first()).toHaveScreenshot('simplex-noise-default.png');
});

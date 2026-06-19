import { expect, test } from './fixtures';

import { waitForShader } from './helpers';

test('Vignette — default story', async ({ page }) => {
  await page.goto('/components/vignette?visualTest=1');
  await waitForShader(page);
  await expect(page.locator('canvas').first()).toHaveScreenshot('vignette-default.png');
});

import { expect, test } from './fixtures';

import { waitForShader } from './helpers';

test('Waves — default story', async ({ page }) => {
  await page.goto('/components/waves?visualTest=1');
  await waitForShader(page);
  await expect(page.locator('canvas').first()).toHaveScreenshot('waves-default.png');
});

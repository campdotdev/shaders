import { expect, test } from './fixtures';
import { waitForShader } from './helpers';

test('Aurora — default story', async ({ page }) => {
  await page.goto('/components/aurora?visualTest=1');
  await waitForShader(page);
  await expect(page.locator('canvas').first()).toHaveScreenshot('aurora-default.png');
});

import { expect, test } from './fixtures';
import { waitForShader } from './helpers';

test('Blobs — default story', async ({ page }) => {
  await page.goto('/components/blobs?visualTest=1');
  await waitForShader(page);
  await expect(page.locator('canvas').first()).toHaveScreenshot('blobs-default.png');
});

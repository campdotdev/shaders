import { expect, test } from './fixtures';
import { waitForShader } from './helpers';

test('Dissolve — default story', async ({ page }) => {
  await page.goto('/components/dissolve?visualTest=1');
  await waitForShader(page);
  await expect(page.locator('canvas').first()).toHaveScreenshot('dissolve-default.png');
});

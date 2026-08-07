import { expect, test } from './fixtures';
import { waitForShader } from './helpers';

test('GodRays — default story', async ({ page }) => {
  await page.goto('/components/god-rays?visualTest=1');
  await waitForShader(page);
  await expect(page.locator('canvas').first()).toHaveScreenshot('god-rays-default.png');
});

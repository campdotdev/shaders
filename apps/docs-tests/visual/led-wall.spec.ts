import { expect, test } from './fixtures';
import { waitForShader } from './helpers';

test('LedWall — default story', async ({ page }) => {
  await page.goto('/components/led-wall?visualTest=1');
  await waitForShader(page);
  await expect(page.locator('canvas').first()).toHaveScreenshot('led-wall-default.png');
});

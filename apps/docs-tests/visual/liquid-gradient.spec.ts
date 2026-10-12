import { expect, test } from './fixtures';
import { waitForShader } from './helpers';

test('LiquidGradient — default story', async ({ page }) => {
  await page.goto('/components/liquid-gradient?visualTest=1');
  await waitForShader(page);
  await expect(page.locator('canvas').first()).toHaveScreenshot('liquid-gradient-default.png');
});

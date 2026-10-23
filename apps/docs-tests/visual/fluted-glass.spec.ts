import { expect, test } from './fixtures';
import { waitForShader } from './helpers';

test('FlutedGlass — default story', async ({ page }) => {
  await page.goto('/components/fluted-glass?visualTest=1');
  await waitForShader(page);
  await expect(page.locator('canvas').first()).toHaveScreenshot('fluted-glass-default.png');
});

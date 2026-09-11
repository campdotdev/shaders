import { expect, test } from './fixtures';
import { waitForShader } from './helpers';

test('RadialWipe — default story', async ({ page }) => {
  await page.goto('/components/radial-wipe?visualTest=1');
  await waitForShader(page);
  await expect(page.locator('canvas').first()).toHaveScreenshot('radial-wipe-default.png');
});

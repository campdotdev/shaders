import { expect, test } from './fixtures';
import { waitForShader } from './helpers';

test('DotField — default story', async ({ page }) => {
  await page.goto('/components/dot-field?visualTest=1');
  await waitForShader(page);
  await expect(page.locator('canvas').first()).toHaveScreenshot('dot-field-default.png');
});

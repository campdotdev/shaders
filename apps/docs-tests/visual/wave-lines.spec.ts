import { expect, test } from './fixtures';
import { waitForShader } from './helpers';

test('WaveLines — default story', async ({ page }) => {
  await page.goto('/components/wave-lines?visualTest=1');
  await waitForShader(page);
  await expect(page.locator('canvas').first()).toHaveScreenshot('wave-lines-default.png');
});

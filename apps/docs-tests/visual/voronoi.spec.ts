import { expect, test } from './fixtures';
import { waitForShader } from './helpers';

test('Voronoi — default story', async ({ page }) => {
  await page.goto('/components/voronoi?visualTest=1');
  await waitForShader(page);
  await expect(page.locator('canvas').first()).toHaveScreenshot('voronoi-default.png');
});

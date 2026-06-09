import { expect, test } from '@playwright/test';

import { waitForShader } from './helpers';

test('MeshGradient — default story', async ({ page }) => {
  await page.goto('/components/mesh-gradient?visualTest=1');
  await waitForShader(page);
  await expect(page.locator('canvas').first()).toHaveScreenshot('mesh-gradient-default.png');
});

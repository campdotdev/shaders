import { expect, test } from '@playwright/test'

import { waitForShader } from './helpers'

test('NoiseField — default story', async ({ page }) => {
  await page.goto('/components/noise-field?visualTest=1')
  await waitForShader(page)
  await expect(page.locator('canvas').first()).toHaveScreenshot('noise-field-default.png')
})

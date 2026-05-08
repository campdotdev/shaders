import { test, expect } from '@playwright/test'

test('Waves — default story', async ({ page }) => {
  await page.goto('/components/waves?visualTest=1')
  await page.waitForFunction(
    () => (window as unknown as { __matterTestReady?: boolean }).__matterTestReady === true,
    undefined,
    { timeout: 15_000 },
  )
  await page.waitForTimeout(50)

  await expect(page.locator('canvas').first()).toHaveScreenshot('waves-default.png')
})

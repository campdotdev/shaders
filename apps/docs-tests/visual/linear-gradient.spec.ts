import { test, expect } from '@playwright/test'

test('LinearGradient — default story', async ({ page }) => {
  await page.goto('/components/linear-gradient?visualTest=1')
  await page.waitForFunction(
    () => (window as unknown as { __matterTestReady?: boolean }).__matterTestReady === true,
    undefined,
    { timeout: 15_000 },
  )
  await page.waitForTimeout(50)

  const canvas = page.locator('canvas').first()
  await expect(canvas).toHaveScreenshot('linear-gradient-default.png')
})

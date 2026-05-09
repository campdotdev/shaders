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

test('LinearGradient — reduced motion paused', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' })
  const page = await ctx.newPage()
  await page.goto('/components/linear-gradient?visualTest=1&reducedMotion=paused')
  await page.waitForFunction(
    () => (window as unknown as { __matterTestReady?: boolean }).__matterTestReady === true,
    undefined,
    { timeout: 15_000 },
  )

  // Capture two screenshots one second apart. With policy=paused the scheduler
  // is frozen — the canvas should produce byte-identical frames.
  const buf1 = await page.locator('canvas').first().screenshot()
  await page.waitForTimeout(1000)
  const buf2 = await page.locator('canvas').first().screenshot()

  expect(buf1.compare(buf2)).toBe(0)
  await ctx.close()
})

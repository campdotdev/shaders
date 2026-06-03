import type { Page } from '@playwright/test'

/**
 * Waits for the shader to finish its first deterministic frame and settle.
 * Pages set `window.__matterTestReady = true` via VisualTestPause after the
 * second frame. The extra 50ms absorbs any micro-jitter before the screenshot.
 */
export async function waitForShader(page: Page): Promise<void> {
  await page.waitForFunction(
    () => (window as unknown as { __matterTestReady?: boolean }).__matterTestReady === true,
    undefined,
    { timeout: 15_000 },
  )
  await page.waitForTimeout(50)
}

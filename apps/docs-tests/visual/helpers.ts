import type { Page } from '@playwright/test';

/**
 * Waits for the shader to finish its first deterministic frame and settle.
 * Pages set `window.__shadersTestReady = true` via VisualTestPause after the
 * second frame. The extra 50ms absorbs any micro-jitter before the screenshot.
 * The timeout budgets for SwiftShader on 2-core CI runners, where a heavy
 * raymarch (aurora: 60 slices x 5 fbm octaves) needs several seconds per frame.
 */
export async function waitForShader(page: Page): Promise<void> {
  await page.waitForFunction(
    () => (window as unknown as { __shadersTestReady?: boolean }).__shadersTestReady === true,
    undefined,
    { timeout: 60_000 },
  );
  await page.waitForTimeout(50);
}

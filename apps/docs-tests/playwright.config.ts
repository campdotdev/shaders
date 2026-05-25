// Visual regression tolerance:
//
// maxDiffPixelRatio: 0.02 — up to 2% of pixels may differ between baseline and
// run. Empirically validated across 10 consecutive runs (all green). The
// tolerance is generous enough to absorb minor anti-aliasing drift but tight
// enough to catch real visual regressions (validated via deliberate color
// change → linear-gradient test fails as expected).
//
// threshold: 0.2 — per-pixel YIQ tolerance. Standard Playwright default for
// pixel-perfect-ish comparisons.
//
// Determinism contract is enforced by VisualTestPause (apps/docs/app/_lib/):
// — Resets NodeFrame.time/deltaTime/lastTime so TSL `time` reads near 0
// — Calls scheduler.setIdle(false) so static components don't halt early
// — Captures at frame 2 (after TSL compile + before time accumulates)
//
// If flake re-emerges, first investigate the cause before raising tolerance.
// The contract is: deterministic input → reproducible output. Loose tolerance
// is a debugging shortcut, not a fix.

import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: '.',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.02, threshold: 0.2 },
  },
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'pnpm --filter @matter/docs build && pnpm --filter @matter/docs preview',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
        deviceScaleFactor: 1,
      },
    },
  ],
})

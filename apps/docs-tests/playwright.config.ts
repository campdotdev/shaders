import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  // Default 30s cuts off waitForShader's 60s readiness budget on slow CI runners.
  timeout: 90_000,
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
    // INCLUDE_DEV_ROUTES makes next.config.ts treat `page.dev.tsx` as a page,
    // which is how the four probes under app/dev reach the router. Four visual
    // specs render against them, and this builds the production bundle rather
    // than running the dev server, so without the flag those specs 404. The
    // deploy build omits it, which is the point — see next.config.ts.
    command:
      'INCLUDE_DEV_ROUTES=1 pnpm turbo run build --filter=@matter/docs --force && pnpm --filter @matter/docs preview',
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
});

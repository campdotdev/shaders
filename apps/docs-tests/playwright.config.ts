import { defineConfig, devices } from '@playwright/test';

// The suite serves its own build on PLAYWRIGHT_PORT, away from the dev
// server's 3000. Each worktree has its own build, so two worktrees running the
// suite at once need two ports.
const port = process.env.PLAYWRIGHT_PORT ?? '3100';
const serverUrl = `http://localhost:${port}`;

// Exits 1 if something already answers on the port. Playwright checks the port
// only before the build, which takes minutes. If another run takes the port in
// that window, `serve` moves to a random free port without failing, and the
// suite would test the other run's build. Checking again right before `serve`
// starts closes most of that window.
const failIfPortTaken = `node -e "const s = require('net').connect(${port}, 'localhost'); s.on('connect', () => { console.error('Port ${port} is taken. Set PLAYWRIGHT_PORT to a free port.'); process.exit(1); }); s.on('error', () => process.exit(0));"`;

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
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? serverUrl,
    trace: 'on-first-retry',
  },
  webServer: {
    // INCLUDE_DEV_ROUTES makes next.config.ts treat `page.dev.tsx` as a page,
    // which is how the probes under app/dev reach the router. The visual specs
    // that load `/dev/*-probe` render against them, and this builds the
    // production bundle rather than running the dev server, so without the flag
    // those specs 404. The deploy build omits it, which is the point — see
    // next.config.ts.
    // `serve` reads PORT, so the build is served on the suite's own port.
    command: `INCLUDE_DEV_ROUTES=1 pnpm turbo run build --filter=@shaders/docs --force && ${failIfPortTaken} && PORT=${port} pnpm --filter @shaders/docs preview`,
    url: serverUrl,
    // Never reuse a server already on the port. It can belong to another
    // worktree, or be a broken leftover from an earlier run, and both look
    // like a shader regression. A taken port fails the run instead.
    reuseExistingServer: false,
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

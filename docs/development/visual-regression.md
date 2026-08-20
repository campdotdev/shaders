# Visual regression testing

Matter's shader components are validated by Playwright visual regression
tests that live in [`apps/docs-tests/visual/`](../../apps/docs-tests/visual/).
Each test navigates to a deterministic visual-test route on the docs site
(`/components/<name>?visualTest=1`), screenshots the canvas, and compares
against a committed baseline PNG.

The Playwright config lives at
[`apps/docs-tests/playwright.config.ts`](../../apps/docs-tests/playwright.config.ts).
Tolerance is `maxDiffPixelRatio: 0.02` (2% of pixels may differ) with a
per-pixel YIQ `threshold: 0.2`. The determinism contract that makes these
tests reproducible (pinned `NodeFrame.time`, capture at frame 2, scheduler
forced non-idle) lives in `VisualTestPause` under
[`apps/docs/app/_lib/`](../../apps/docs/app/_lib/).

## Two platform baselines

Each spec has two committed snapshots:

```
visual/<name>.spec.ts-snapshots/
  <name>-default-chromium-linux.png
  <name>-default-chromium-darwin.png
```

CI runs on Linux, so the `-linux.png` is the one that gates merges. The
`-darwin.png` keeps local `pnpm test:visual` runs green on macOS. The two
files are not interchangeable — Chromium rasterizes fonts and applies
sub-pixel anti-aliasing differently on each OS, so a Mac-generated PNG
will not pass on Linux and vice versa.

## When to regenerate

Only when you've **intentionally** changed how a component looks. A pixel
diff > 2% means either:

1. You wanted the visual change (regenerate the baseline).
2. You introduced a regression (fix the code, don't touch the baseline).

If unsure, open the diff artifact CI uploads (`visual-regression-diffs` on
failed runs, 7-day retention) and eyeball it.

## Regenerating the Linux baseline (the one CI checks)

Linux baselines must be generated inside a Linux environment that matches
CI. The standard play is Microsoft's official Playwright Docker image,
matched to the installed `@playwright/test` version.

### Prerequisites

- A Docker runtime. On macOS, [OrbStack](https://orbstack.dev/) is
  recommended (`brew install --cask orbstack`) — faster startup and lower
  idle resource use than Docker Desktop, free for personal use,
  Docker-CLI-compatible. Docker Desktop also works.
- Run `docker info` once to confirm the daemon is reachable.

### The command

```bash
# from repo root
PLAYWRIGHT_VERSION=$(node -p \
  "require('./apps/docs-tests/node_modules/@playwright/test/package.json').version")

docker pull "mcr.microsoft.com/playwright:v${PLAYWRIGHT_VERSION}-jammy"

# regenerate only the spec you care about (replace 'Aurora' with the test
# name from the .spec.ts file, matched by --grep). Run without --grep to
# regenerate every baseline at once.
docker run --rm \
  -v "$PWD":/work -w /work \
  -e CI=1 \
  "mcr.microsoft.com/playwright:v${PLAYWRIGHT_VERSION}-jammy" \
  bash -lc '
    corepack enable &&
    corepack prepare "$(node -p "require(\"./package.json\").packageManager")" --activate &&
    pnpm install --frozen-lockfile &&
    pnpm --filter @shaders/docs-tests exec playwright test \
      --update-snapshots --grep "Aurora"
  '
```

What each part does:

- `-v "$PWD":/work -w /work` — mounts the repo into the container and
  works from inside it, so any file Playwright writes (the regenerated
  PNG) lands on the host filesystem.
- `corepack prepare … --activate` — reads the `packageManager` field from
  the mounted `package.json` so the container runs the exact pnpm the repo
  pins. The Playwright image ships Node but no pnpm.
- `pnpm install --frozen-lockfile` — cold install inside the container.
  ~2–3 min the first time per fresh container.
- `playwright test --update-snapshots --grep "<name>"` — runs only the
  matching specs. Playwright's `webServer` block uses Turbo to build the
  static docs output, then starts the Next.js docs site inside the
  container (see
  [`playwright.config.ts:17-23`](../../apps/docs-tests/playwright.config.ts#L17-L23)).

Total wall time on a cold run: ~5 min, mostly the Next.js production
build. Subsequent runs reuse the pulled image and the `.next` cache if
it's still on disk.

### Verify before committing

```bash
git status apps/docs-tests/visual/<name>.spec.ts-snapshots/
open apps/docs-tests/visual/<name>.spec.ts-snapshots/<name>-default-chromium-linux.png
```

Eyeball the PNG. It should look like the new visual you intended — not a
black canvas, not a half-compiled frame, not a startup artifact. The test
can't sanity-check the *content* of the baseline; it can only check that
future runs match it.

## Regenerating the macOS baseline

Run natively, no Docker:

```bash
pnpm --filter @shaders/docs-tests exec playwright test \
  --update-snapshots --grep "Aurora"
```

Same `webServer` boots the local static docs build through Turbo. Faster
than the Docker path because there's no container start cost.

## Committing

Both baselines change as a pair when you intentionally change a
component. Commit them together so CI passes on Linux and local runs pass
on Mac:

```bash
git add apps/docs-tests/visual/<name>.spec.ts-snapshots/<name>-default-chromium-{linux,darwin}.png
git commit -m "test(docs-tests): regenerate <name> baselines after <reason>"
```

## Image tag must match `@playwright/test`

Microsoft tags the image as `v<playwright-version>-<ubuntu-codename>`
(currently `-jammy` = Ubuntu 22.04). If the image tag and the installed
`@playwright/test` drift apart, Playwright will redownload the matching
browser bundle at the start of the test run — slow and wasteful. The
`PLAYWRIGHT_VERSION` shell expansion in the command above keeps them in
sync automatically.

When you bump `@playwright/test`, pull the new image tag too.

## Why not Vitest 4's `toMatchScreenshot`?

Vitest 4 ships a `toMatchScreenshot` matcher in Browser Mode. It uses
pixelmatch under the hood (same algorithm Playwright uses) and supports
similar options. Two reasons we keep these tests in Playwright directly:

1. **Vitest Browser Mode runs on Playwright anyway.** It depends on
   `@vitest/browser-playwright` and spawns the same Chromium binary, so
   switching would not remove the Playwright dependency — it would just
   wrap it.
2. **These tests navigate to real Next.js routes** rather than mounting
   components into a bare test page. The `VisualTestPause` determinism
   contract lives on those routes. Reproducing that contract under
   Vitest Browser Mode would mean either spinning up a separate Next.js
   server for the browser to point at (recreating Playwright's
   `webServer` block) or duplicating the pause logic into a Vitest
   harness.

Vitest's matcher is the right tool for unit-level visual tests on
isolated Tier 2 primitives mounted bare into a test harness (no Next, no
docs route). If we ever add those, Vitest is the natural home.

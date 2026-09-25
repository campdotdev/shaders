# Visual regression testing

Playwright visual regression tests in [`apps/docs-tests/visual/`](../../apps/docs-tests/visual/) check the shader components. Most specs open a component's deterministic visual-test route on the docs site (`/components/<name>?visualTest=1`), screenshot the canvas, and compare the shot with a committed baseline PNG. The `cursor-ripple` and `wave-field` specs take their baselines from the `/dev/wave-field-probe` route instead.

Five specs keep no baseline. `color-space`, `dot-field-stack`, `hsl-gamut`, and `hue-arc` open a `/dev/*-probe` route and assert on sampled pixel colors. `gamut` checks that both of its canvases render, and takes no screenshot.

The Playwright config is [`apps/docs-tests/playwright.config.ts`](../../apps/docs-tests/playwright.config.ts). The tolerance is `maxDiffPixelRatio: 0.02`, so 2% of pixels may differ, with a per-pixel YIQ `threshold: 0.2`. [`VisualTestPause`](../../apps/docs/src/lib/VisualTestPause.tsx) makes the capture reproducible. It forces the scheduler out of idle, rewinds the renderer clock and the scheduler's phase accumulators on the first frame, and flags the page ready on the third scheduler tick.

## What the screenshot covers

Every baseline spec screenshots the canvas element through `page.locator('canvas').first()`, not the full page or the `[data-shader-demo]` container. The Playwright fixture stamps `data-visual-test` on `<html>` for any `?visualTest=1` page, and a rule in `globals.css` then pins `[data-shader-demo]` to the 560px width every baseline was captured at. You can restyle the sidebar, the shell, the gutters, or the control panel without touching a baseline. `DemoPoster`'s image sits inside `[data-shader-demo]` but outside the canvas, so no spec captures it.

Three changes do invalidate baselines: a change to the shader's output, to the aspect ratio of the demo wrapper, or to the fixture's 560px pin.

## Two platform baselines

Each baseline has two committed snapshots. `<spec>` is the spec file's name, and `<snapshot>` is the name the spec passes to `toHaveScreenshot`. That name is usually `<spec>-default`, but `cursor-ripple` and `wave-field` use `-probe` and `cursor-spotlight` uses `-lit`.

```
visual/<spec>.spec.ts-snapshots/
  <snapshot>-chromium-linux.png
  <snapshot>-chromium-darwin.png
```

CI runs on Linux, so the `-linux.png` is the one that gates merges. The `-darwin.png` keeps local `pnpm test:visual` runs green on macOS. The two files are not interchangeable. Chromium rasterizes fonts and applies sub-pixel anti-aliasing differently on each OS, so a Mac-generated PNG fails on Linux, and the reverse.

## When to regenerate

Only when you have intentionally changed how a component looks. A pixel diff over 2% means one of two things:

1. You wanted the visual change. Regenerate the baseline.
2. You introduced a regression. Fix the code, and leave the baseline alone.

If you are unsure which, open the diff artifact that CI uploads on failed runs, `visual-regression-diffs`, which it keeps for 7 days.

## Regenerate with `pnpm snap`

`pnpm snap <component>` regenerates both baselines for one spec when you run it on macOS. On Linux, the native run and the Docker run both write the `-linux.png`, so the `-darwin.png` still needs a run on a Mac. It needs Node 22 and a running Docker daemon. On macOS, [OrbStack](https://orbstack.dev/) (`brew install --cask orbstack`) starts faster and idles lighter than Docker Desktop, and both work. Run `docker info` once to confirm the daemon answers.

```bash
pnpm snap aurora
```

`scripts/snap.sh` runs the spec natively, which writes the baseline for the host OS, then inside Microsoft's Playwright image for the Linux baseline:

- The image tag comes from the installed `@playwright/test` version, so the image and the test runner stay in step. When you bump `@playwright/test`, the next run pulls the new image.
- It forces `--platform linux/amd64`, so a baseline made on Apple Silicon matches CI's amd64 runners. Without the flag Docker pulls the arm64 image, and its pixels drift from CI enough to push noise-heavy shaders such as Grain past the 2% threshold.
- It reads the pnpm version from `packageManager` in the root `package.json`.
- It masks every workspace `node_modules` with an anonymous volume, so the container's Linux install cannot overwrite the host's macOS binaries.

A cold run takes about 5 minutes, most of it the Next.js production build.

### Always pass a component name

Unscoped, `pnpm snap` runs the whole Playwright suite, including `a11y/component-pages.spec.ts`, and that suite is racy under emulation. The forced amd64 platform runs Chromium emulated and slow on Apple Silicon, so `waitForLoadState('networkidle')` fires before Base UI finishes associating its slider and button labels. axe then reports `button-name` and `label` violations on every component page. Two runs on 2026-07-30 failed on different subsets of pages, which is what marks it as a race rather than a regression. The suite passes natively on macOS and on CI.

### Never hand-roll the Docker command

Without exactly the `node_modules` masks in `snap.sh`, the container's `pnpm install --frozen-lockfile` writes Linux binaries into the host tree. `node_modules/node/bin/node` becomes an x86-64 ELF, and every later `pnpm` command fails with `cannot execute binary file`.

To recover, run `CI=true pnpm install`. The `CI` variable is required, because without a TTY pnpm refuses to remove the modules directory. Then run `git status pnpm-lock.yaml`, because a resolution step here can also degrade the `node@runtime` entry that `docs/agents/build-and-ci.md` describes.

## Verify before committing

```bash
git status apps/docs-tests/visual/<spec>.spec.ts-snapshots/
open apps/docs-tests/visual/<spec>.spec.ts-snapshots/<snapshot>-chromium-linux.png
```

Look at the PNG. It should show the new visual you intended, not a black canvas, a half-compiled frame, or a startup artifact. The test cannot check what the baseline contains. It can only check that future runs match it.

Commit both baselines together, so CI passes on Linux and local runs pass on macOS:

```bash
git add apps/docs-tests/visual/<spec>.spec.ts-snapshots/<snapshot>-chromium-{linux,darwin}.png
git commit -m "test(docs-tests): regenerate <spec> baselines after <reason>"
```

## Restart the dev server after any Playwright run

The Playwright `webServer` builds the production bundle into the same `apps/docs/.next` directory a running dev server serves from, and the Docker leg of `pnpm snap` does the same through the repo mount. The dev server then answers 500 for every chunk, with `Cannot find module './NNN.js'` from `webpack-runtime.js`.

Locally, `reuseExistingServer` is on, so the next Playwright run reuses that broken server, and every spec times out in `waitForShader`. That looks like a shader regression, and it is not one. The same happens with a wedged server, because `reuseExistingServer` only checks that the port accepts a connection.

After any `pnpm snap` or local Playwright run, restart the dev server before you trust the browser or a local test result. `docs/agents/docs-site.md` has the restart procedure.

## Open site chrome from a static route

A spec that tests site chrome, such as the search panel, opens it from a static route like `/getting-started`, not from a component page. Every `/components/*` route renders two scenes, the banner and the demo. CI's headless Chromium has no GPU, so both run on SwiftShader, and the page composites about once every 0.8 seconds. Every Playwright step waits on that main thread. From the retry traces on 2026-09-21, a click on the search trigger took 11 seconds, and the first results arrived 5.7 seconds after the fill, over the 5-second `expect` budget. That turned `main` red at #172 (SHA-163).

`docs/search.spec.ts` and the search block of `docs/scroll-fades.spec.ts` open from `/getting-started`. A spec that asserts on a component page's own chrome, such as the control panel's fades or the sidebar's pin, has to run on a component page, and it has to budget for that frame rate.

## Why not Vitest 4's `toMatchScreenshot`?

Vitest 4 ships a `toMatchScreenshot` matcher in Browser Mode. It uses pixelmatch, the same algorithm Playwright uses, and supports similar options. These tests stay in Playwright for two reasons:

1. Vitest Browser Mode runs on Playwright anyway. It depends on `@vitest/browser-playwright` and spawns the same Chromium binary, so switching would wrap the Playwright dependency rather than remove it.
2. These tests open real Next.js routes rather than mounting components into a bare test page, and the `VisualTestPause` determinism contract lives on those routes. Reproducing it under Vitest Browser Mode would mean either running a separate Next.js server for the browser, which recreates Playwright's `webServer` block, or copying the pause logic into a Vitest harness.

Vitest's matcher is the right tool for unit-level visual tests of isolated Tier 2 primitives, mounted bare into a test harness with no Next.js and no docs route. If the repo ever adds those, Vitest is their home.

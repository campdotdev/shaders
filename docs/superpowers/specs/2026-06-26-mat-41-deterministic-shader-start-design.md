# MAT-41 — Deterministic shader start (poster ↔ live alignment)

**Date:** 2026-06-26
**Branch:** `hunter/mat-41-fix-issue-with-posters-lining-up-with-shader-starts`
**Status:** Design approved, pending implementation plan

## Problem

When a shader demo loads, the static poster placeholder visibly "pops" as the live
WebGPU canvas paints over it. The poster frame doesn't match the shader's starting
frame.

## Root cause

The animation clock — `elapsedTime` in `packages/matter/src/primitives/time/time.ts` —
is built on three/tsl's built-in `time` node:

```ts
export const elapsedTime = _builtinTime.mul(getReducedMotionTimeScale());
```

`_builtinTime` reads the renderer-driven `nodeFrame.time` accumulator, which sums real
frame deltas from when the renderer first runs. The first painted frame therefore
includes the WebGPU init + shader-compile delta (tens to hundreds of ms, varying per
run and per machine), so the "starting" frame lands at a nondeterministic, nonzero time.

Three surfaces each land on a different frame:

- **Snap baselines** — `VisualTestPause` zeroes `nodeFrame.time` on the first tick,
  renders 2 settle frames, then pauses → deterministic t=0.
- **Posters (matter-cli)** — the harness waits for `__matterReady` (first frame) then
  screenshots → nondeterministic warmup t, rendered in headless SwiftShader.
- **Live shader at mount** — rides the warmup-inclusive accumulator → its own
  nondeterministic warmup t, on the real GPU.

## Key insight: the clock is per-renderer

`nodeFrame` lives on the renderer (`renderer.three._nodes.nodeFrame`), and each
`ShaderScene` creates its own renderer. So **per-renderer clock control gives free
per-scene isolation**: two scenes painting at different wall-clock moments each zero
their own clock without interfering.

This rules out the "first-paint offset uniform" shape the original issue floated.
`elapsedTime` is a single shared module-level node, so one offset uniform would be
global and multiple scenes would fight over it. Resetting the per-renderer
`nodeFrame.time` instead sidesteps that entirely.

It also confirms two mechanisms rather than one:

- **Live:** zero `nodeFrame.time` per-renderer at first paint.
- **Posters:** pin `elapsedTime` to 0 via the reduced-motion scale (see Phase 2), which
  is robust to the settle frames that advance `nodeFrame.time` before the screenshot.

## Two phases (Phase 1 first — it fixes the visible pop and enables Phase 2)

Phase 1 is the actual fix for the user-visible pop. Phase 2 makes posters
pixel-deterministic. Each phase ends at a runnable, observable validation gate.

### Phase 1 — live shaders start at t=0 (engine + React binding)

1. **New engine util** in `@lovo/matter`, e.g. `resetRendererClock(renderer)`, that
   encapsulates the `renderer.three._nodes.nodeFrame` private-field reach: zero `time`,
   `deltaTime`, and `lastTime`, behind the same defensive `typeof` guards
   `VisualTestPause` currently uses inline. This puts the one ugly private-field access
   behind a single tested boundary instead of duplicating it.

2. **`ShaderScene.renderFrame`** (`packages/matter-react/src/components/shader-scene/shader-scene.tsx`,
   ~line 126): on the frame where it first detects `scene.children.length > 0`, call
   `resetRendererClock(renderer)` **before** `postProcessing.render()`. Ordering is the
   crux: reset → render the t=0 frame → schedule the rAF → drop the fallback. The
   fallback covers the canvas until `firstFramePainted` flips, so the first frame the
   user actually sees must be the t=0 frame. Resetting *after* the fallback is already
   gone would make live pop backwards from warmup-time to 0 — a new glitch.

3. **Cleanup:** refactor `VisualTestPause` (`apps/docs/src/lib/VisualTestPause.tsx`,
   ~lines 42–72) to call the same util, removing its duplicated `getNodeFrame`
   accessor. Single source of truth for the private-field reach.

**Validation gate (stop-and-play):** run the docs dev server, load a shader page,
confirm the fallback hands off to a still t=0 frame that then animates forward — no
pop, no backwards jump. Confirm `pnpm snap` baselines are **unchanged** (snap already
renders t=0, so Phase 1 must not move them).

### Phase 2 — pixel-deterministic posters (matter-cli)

1. **Poster harness** (`packages/matter-cli/src/harness/index.tsx`): call
   `setReducedMotionPolicy('paused')` (from `@lovo/matter`) **before** rendering the
   user component. `setReducedMotionPolicy('paused')` sets the global scale uniform to
   0, so `elapsedTime = _builtinTime.mul(0)` is pinned at 0 regardless of how many
   settle frames pass before the screenshot. esbuild bundles the harness and the user
   module against the user's `node_modules`, so it resolves the same `@lovo/matter`
   singleton the component uses.

2. **`playwright.ts`** stays mostly as-is. The existing `timeSeconds` option remains an
   intentional escape hatch for capturing a non-zero frame, with the documented caveat
   that doing so reintroduces nondeterminism.

**Validation gate:** regenerate a poster for one component, confirm two consecutive
poster runs are pixel-identical (deterministic), and that the poster matches its t=0
snap baseline modulo the documented SwiftShader-vs-real-GPU sub-pixel delta. Poster
image assets that previously captured warmup-t **will** change and need regenerating.

## Scope notes / non-goals

- Targets `elapsedTime`-based components (everything Matter ships). Raw `three/tsl`
  `time` — the documented debug-overlay escape hatch — is not pinned by the paused
  policy. Acceptable; shipped components don't use it.
- The headless-SwiftShader vs real-GPU sub-pixel difference is **out of scope**. The
  phase pop is fixable; renderer differences mostly aren't without capturing on real
  hardware (the same reason snap forces DPR2/amd64 baselines).
- No offset-uniform on `elapsedTime` (would be module-global and break multiple
  `ShaderScene`s).
- Universal t=0 pinning for posters. Per-component `timeSeconds` defaults are not added.

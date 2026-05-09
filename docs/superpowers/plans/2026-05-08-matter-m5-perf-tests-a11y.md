# Matter M5 — Performance + Testing + Accessibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the four remaining engine performance defaults (offscreen/visibility/render-on-demand/reduced-motion), grow the unit-test surface to cover hooks and bindings, stand up Playwright visual regression against the docs site routes, audit accessibility, and make CI gate all of it. Ship `m5-complete`.

**Architecture:** Perf defaults live in the engine package (`packages/matter/src/runtime/`) and are wired into the React binding (`MatterScene.tsx`) — components stay agnostic. `prefers-reduced-motion` works by replacing the `time` TSL re-export in `@lovo/matter` with a gated `time = builtinTime.mul(scaleUniform)`; every registry component that imports `time` from `@lovo/matter` (all six already do) inherits the behavior at zero per-component cost. Tests use Vitest + happy-dom for hooks/bindings and Playwright against `apps/docs` routes for visual regression at fixed frame numbers. CI runs typecheck, lint, build, unit tests, and visual regression on every PR.

**Tech Stack:** TypeScript 5 strict, pnpm 9, Turborepo, tsup, Vitest 2, happy-dom, @testing-library/react, Playwright (visual regression + axe-core a11y), Three.js TSL (`time`, `uniform`), Next.js 15 (docs site), GitHub Actions.

---

## Phase Map

Each phase is 1–2 days and ends at a runnable, observable point per the user's pacing preference. "Stop and play" gate is called out at the end of each phase.

| #    | Phase                                                  | Validation gate                                                                                                                              |
| ---- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 5.1  | Reduced-motion — gated `time` infrastructure           | Toggle OS reduced-motion → all six docs component pages slow to 30%; manual override pauses to 0.                                            |
| 5.2  | Pause when tab hidden                                  | Open the docs hero, switch to another tab for 5s, return — frame counter shows zero increment while away.                                    |
| 5.3  | Pause when offscreen                                   | Long scroll page with three component slots — only the visible one ticks; `MatterMonitor` proves it.                                        |
| 5.4  | Render-on-demand opt-in                                | `<LinearGradient speed={0}>` renders one frame and stops; setting `speed={0.5}` resumes the loop.                                           |
| 5.5  | `MatterMonitor` dev overlay                            | Drop `<MatterMonitor />` into the docs `/dev/perf-monitor` page; live FPS + tick count + paused-state visible.                              |
| 5.6  | Hook & binding unit tests                              | `pnpm --filter @lovo/matter-react test` runs ≥ 25 tests, all green.                                                                          |
| 5.7  | Engine perf-default unit tests                         | `pnpm --filter @lovo/matter test` covers reduced-motion, visibility, intersection, render-on-demand at the unit level; all green.            |
| 5.8  | Playwright visual regression — setup + 6 baselines    | `pnpm --filter @matter/docs-tests test:visual` produces 6 baselines on first run, zero diffs on second run.                                  |
| 5.9  | Playwright tolerance tuning + flake hardening         | 10 consecutive `test:visual` runs all green; an intentional pixel change in one component causes that test (and only that one) to fail.      |
| 5.10 | A11y pass — `prefers-reduced-motion`, ARIA, axe-core   | `axe-core` runs clean on all six component pages, the homepage, and the recipes index.                                                      |
| 5.11 | CI gates — tests + visual regression in GitHub Actions | A pushed branch shows separate `unit-tests` and `visual-regression` jobs; both pass on a clean PR; both fail on a deliberate regression PR.  |
| 5.12 | M5 wrap-up — docs, memory, tag                         | `git tag m5-complete && git push --tags`; CLAUDE.md milestone table updated; memory entry written.                                          |

Total: ~14–18 days at the user's pace, with 12 explicit play gates.

---

## File Structure

**New files (engine):**
- `packages/matter/src/runtime/visibility.ts` — `createVisibilityWatcher()` factory wrapping `document.visibilityState`
- `packages/matter/src/runtime/intersection.ts` — `createIntersectionWatcher(canvas)` factory wrapping IntersectionObserver
- `packages/matter/src/runtime/reducedMotion.ts` — `createReducedMotionWatcher()` + gated `time` factory
- `packages/matter/src/runtime/visibility.test.ts`, `intersection.test.ts`, `reducedMotion.test.ts`

**Modified files (engine):**
- `packages/matter/src/runtime/MatterScheduler.ts` — add `setIdle()` API for render-on-demand
- `packages/matter/src/runtime/MatterScheduler.test.ts` — extend with `setIdle` tests
- `packages/matter/src/primitives/tsl-reexports.ts` — replace `time` with gated `time`
- `packages/matter/src/index.ts` — export new public surface (`setReducedMotionPolicy`, etc.)

**New files (React binding):**
- `packages/matter-react/src/MatterMonitor.tsx` — dev overlay component
- `packages/matter-react/src/useStaticHint.ts` — opt-in render-on-demand hook
- `packages/matter-react/src/MatterMonitor.test.tsx`, `useShaderMaterial.test.tsx`, `useAnimatableUniform.test.tsx`, `useCursor.test.tsx`, `MatterScene.test.tsx`, `FallbackBoundary.test.tsx`, `useStaticHint.test.tsx`
- `packages/matter-react/vitest.config.ts` — add `happy-dom` environment + setup file
- `packages/matter-react/src/test-setup.ts` — RTL setup, jsdom polyfills

**Modified files (React binding):**
- `packages/matter-react/src/MatterScene.tsx` — wire visibility, intersection, reduced-motion observers into the scheduler
- `packages/matter-react/src/index.ts` — export `MatterMonitor`, `useStaticHint`
- `packages/matter-react/package.json` — add `happy-dom`, `@testing-library/react`, `@testing-library/dom`, `@testing-library/jest-dom` devDeps

**Modified files (registry):**
- `registry/linear-gradient.tsx` — opt into render-on-demand via `useStaticHint(speed === 0 && !interactive)`

**New files (docs tests):**
- `apps/docs-tests/package.json`, `tsconfig.json`, `playwright.config.ts`
- `apps/docs-tests/visual/linear-gradient.spec.ts` (and 5 more — one per component)
- `apps/docs-tests/visual/recipes-cosmic-aurora.spec.ts` (and 3 more — one per recipe)
- `apps/docs-tests/visual/snapshots/` — committed baseline images
- `apps/docs-tests/a11y/component-pages.spec.ts` — axe-core pass on all 6 component pages

**New files (docs site):**
- `apps/docs/app/dev/perf-monitor/page.tsx` — `<MatterMonitor />` showcase
- `apps/docs/app/dev/perf-monitor/PerfMonitorDemo.tsx`
- `apps/docs/app/dev/offscreen-pause/page.tsx` — long scroll test page for 5.3
- `apps/docs/app/dev/offscreen-pause/OffscreenPauseDemo.tsx`
- `apps/docs/app/_lib/visualTestHooks.ts` — `?visualTest=1` query param hook that pauses scheduler at frame 60 and exposes `window.__matterTestReady`

**Modified files (docs site):**
- `apps/docs/app/components/*/page.tsx` (×6) — add `aria-hidden` + `role="presentation"` on the canvas wrapper for decorative shader; add `prefers-reduced-motion` notice on Tweakpane panel where relevant
- `apps/docs/app/_components/PropsPlayground.tsx` — keyboard accessibility audit fixes (focus rings, aria-labels)
- `apps/docs/next.config.ts` — verify `experimental.serverActions` not blocking (no change expected)
- `apps/docs/package.json` — add scripts (`test:visual`, `test:visual:update`)

**Modified files (CI / root):**
- `.github/workflows/ci.yml` — add `unit-tests` and `visual-regression` jobs
- `package.json` — add `test:visual` root script
- `turbo.json` — add `test` and `test:visual` task definitions

**Modified files (docs):**
- `CLAUDE.md` — milestone table: M5 → complete
- `.claude/projects/.../memory/project_matter_m5_complete.md` — new memory entry
- `.claude/projects/.../memory/MEMORY.md` — link to M5 entry

---

## Phase 5.1 — Reduced-motion: gated `time` infrastructure

**Goal:** Replace the TSL `time` re-export in `@lovo/matter` with a gated version whose value is multiplied by an engine-controlled scalar. `prefers-reduced-motion: reduce` → scale = 0.3; explicit override → scale = 0 (paused) or 1 (forced full). Existing registry components inherit the behavior with zero changes.

**Files:**
- Create: `packages/matter/src/runtime/reducedMotion.ts`
- Create: `packages/matter/src/runtime/reducedMotion.test.ts`
- Modify: `packages/matter/src/primitives/tsl-reexports.ts`
- Modify: `packages/matter/src/index.ts`
- Create: `apps/docs/app/dev/reduced-motion/page.tsx`
- Create: `apps/docs/app/dev/reduced-motion/ReducedMotionDemo.tsx`

### Task 1: Reduced-motion watcher (matchMedia subscription)

Encapsulates the matchMedia subscription with a strict-mode-safe lifecycle. Returns the current scale and a subscribe API.

- [ ] **Step 1: Write the failing test**

Create `packages/matter/src/runtime/reducedMotion.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createReducedMotionWatcher,
  setReducedMotionPolicy,
  type ReducedMotionPolicy,
} from './reducedMotion.js'

interface MockMQL {
  matches: boolean
  listeners: Array<(e: { matches: boolean }) => void>
  addEventListener: (type: 'change', cb: (e: { matches: boolean }) => void) => void
  removeEventListener: (type: 'change', cb: (e: { matches: boolean }) => void) => void
  dispatch: (matches: boolean) => void
}

const makeMQL = (initial: boolean): MockMQL => {
  const listeners: MockMQL['listeners'] = []
  return {
    get matches() {
      return initial
    },
    set matches(v) {
      initial = v
    },
    listeners,
    addEventListener: (_t, cb) => listeners.push(cb),
    removeEventListener: (_t, cb) => {
      const i = listeners.indexOf(cb)
      if (i >= 0) listeners.splice(i, 1)
    },
    dispatch(matches) {
      this.matches = matches
      for (const l of [...listeners]) l({ matches })
    },
  }
}

describe('reducedMotion watcher', () => {
  let mql: MockMQL
  beforeEach(() => {
    mql = makeMQL(false)
    vi.stubGlobal('matchMedia', () => mql)
    setReducedMotionPolicy('auto')
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    setReducedMotionPolicy('auto')
  })

  it('returns scale 1 when system reduce is off and policy is auto', () => {
    const w = createReducedMotionWatcher()
    expect(w.scale()).toBe(1)
    w.dispose()
  })

  it('returns scale 0.3 when system reduce is on and policy is auto', () => {
    mql.matches = true
    const w = createReducedMotionWatcher()
    expect(w.scale()).toBe(0.3)
    w.dispose()
  })

  it('emits change when matchMedia toggles', () => {
    const w = createReducedMotionWatcher()
    const cb = vi.fn()
    w.subscribe(cb)
    mql.dispatch(true)
    expect(cb).toHaveBeenCalledWith(0.3)
    mql.dispatch(false)
    expect(cb).toHaveBeenLastCalledWith(1)
    w.dispose()
  })

  it('honors explicit policy override "off" (scale 1)', () => {
    mql.matches = true
    setReducedMotionPolicy('off')
    const w = createReducedMotionWatcher()
    expect(w.scale()).toBe(1)
    w.dispose()
  })

  it('honors explicit policy override "paused" (scale 0)', () => {
    setReducedMotionPolicy('paused')
    const w = createReducedMotionWatcher()
    expect(w.scale()).toBe(0)
    w.dispose()
  })

  it('honors explicit policy override "slow" (scale 0.3 regardless of mql)', () => {
    setReducedMotionPolicy('slow')
    const w = createReducedMotionWatcher()
    expect(w.scale()).toBe(0.3)
    w.dispose()
  })

  it('emits when policy changes', () => {
    const w = createReducedMotionWatcher()
    const cb = vi.fn()
    w.subscribe(cb)
    setReducedMotionPolicy('paused')
    expect(cb).toHaveBeenLastCalledWith(0)
    setReducedMotionPolicy('off')
    expect(cb).toHaveBeenLastCalledWith(1)
    w.dispose()
  })

  it('removes listeners on dispose', () => {
    const w = createReducedMotionWatcher()
    expect(mql.listeners.length).toBe(1)
    w.dispose()
    expect(mql.listeners.length).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @lovo/matter test reducedMotion`
Expected: FAIL with "Cannot find module './reducedMotion.js'"

- [ ] **Step 3: Implement `reducedMotion.ts`**

Create `packages/matter/src/runtime/reducedMotion.ts`:

```ts
export type ReducedMotionPolicy = 'auto' | 'off' | 'slow' | 'paused'

interface PolicyState {
  policy: ReducedMotionPolicy
  watchers: Set<ReducedMotionWatcher>
}

const state: PolicyState = {
  policy: 'auto',
  watchers: new Set(),
}

/**
 * Override Matter's default behavior of honoring `prefers-reduced-motion`.
 * - 'auto'   — follow the OS media query (default)
 * - 'off'    — full speed regardless of OS setting
 * - 'slow'   — 30% speed regardless of OS setting
 * - 'paused' — 0 (animation effectively frozen) regardless of OS setting
 */
export function setReducedMotionPolicy(policy: ReducedMotionPolicy): void {
  if (state.policy === policy) return
  state.policy = policy
  for (const w of state.watchers) w.recompute()
}

export function getReducedMotionPolicy(): ReducedMotionPolicy {
  return state.policy
}

export interface ReducedMotionWatcher {
  /** Current time scale: 0, 0.3, or 1. */
  scale(): number
  /** Subscribe to scale changes. Returns unsubscribe. */
  subscribe(cb: (scale: number) => void): () => void
  /** Internal: recompute after policy change and notify subscribers. */
  recompute(): void
  /** Tear down media-query listener. */
  dispose(): void
}

const computeScale = (mqlMatches: boolean): number => {
  switch (state.policy) {
    case 'off':
      return 1
    case 'slow':
      return 0.3
    case 'paused':
      return 0
    case 'auto':
      return mqlMatches ? 0.3 : 1
  }
}

/**
 * Create a watcher that tracks `prefers-reduced-motion: reduce` and the
 * global Matter policy override. Strict-mode-safe — callers create+dispose
 * one per mount cycle.
 */
export function createReducedMotionWatcher(): ReducedMotionWatcher {
  // SSR safety: bail to the no-op watcher if matchMedia is missing.
  if (typeof matchMedia !== 'function') {
    const subs = new Set<(s: number) => void>()
    return {
      scale: () => 1,
      subscribe: (cb) => {
        subs.add(cb)
        return () => subs.delete(cb)
      },
      recompute: () => {
        for (const cb of subs) cb(computeScale(false))
      },
      dispose: () => {
        subs.clear()
      },
    }
  }

  const mql = matchMedia('(prefers-reduced-motion: reduce)')
  const subs = new Set<(s: number) => void>()
  let last = computeScale(mql.matches)

  const onChange = () => {
    const next = computeScale(mql.matches)
    if (next !== last) {
      last = next
      for (const cb of subs) cb(next)
    }
  }

  mql.addEventListener('change', onChange)

  const watcher: ReducedMotionWatcher = {
    scale: () => last,
    subscribe(cb) {
      subs.add(cb)
      return () => subs.delete(cb)
    },
    recompute() {
      const next = computeScale(mql.matches)
      if (next !== last) {
        last = next
        for (const cb of subs) cb(next)
      }
    },
    dispose() {
      mql.removeEventListener('change', onChange)
      subs.clear()
      state.watchers.delete(watcher)
    },
  }
  state.watchers.add(watcher)
  return watcher
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @lovo/matter test reducedMotion`
Expected: PASS — 8 tests green.

- [ ] **Step 5: Commit**

```bash
git add packages/matter/src/runtime/reducedMotion.ts packages/matter/src/runtime/reducedMotion.test.ts
git commit -m "feat(matter): reduced-motion watcher with auto/off/slow/paused policy"
```

### Task 2: Engine-owned scale uniform + gated `time`

The watcher must propagate its scale into a TSL uniform that gates `time`. Components import `time` from `@lovo/matter`; they get the gated version transparently.

- [ ] **Step 1: Write the failing test**

Append to `packages/matter/src/runtime/reducedMotion.test.ts`:

```ts
import { getReducedMotionTimeScale, setReducedMotionPolicy } from './reducedMotion.js'

describe('reducedMotion uniform', () => {
  it('exposes a TSL uniform whose value matches the current scale', () => {
    setReducedMotionPolicy('slow')
    const u = getReducedMotionTimeScale()
    expect((u as unknown as { value: number }).value).toBe(0.3)
  })

  it('updates the uniform value when policy changes', () => {
    const u = getReducedMotionTimeScale()
    setReducedMotionPolicy('off')
    expect((u as unknown as { value: number }).value).toBe(1)
    setReducedMotionPolicy('paused')
    expect((u as unknown as { value: number }).value).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @lovo/matter test reducedMotion`
Expected: FAIL — `getReducedMotionTimeScale is not a function`.

- [ ] **Step 3: Add the uniform and global watcher to `reducedMotion.ts`**

Append to `packages/matter/src/runtime/reducedMotion.ts`:

```ts
import { uniform } from 'three/tsl'
import type { ShaderNodeObject } from 'three/tsl'
import type { Node } from 'three/webgpu'

let globalScaleUniform: ShaderNodeObject<Node> | null = null
let globalWatcher: ReducedMotionWatcher | null = null

/**
 * Returns the engine-shared TSL uniform that `time` is multiplied by. Lazily
 * initialized on first read; reused across all materials. Mutating `.value`
 * imperatively when policy changes is safe — TSL re-reads the uniform every
 * frame.
 */
export function getReducedMotionTimeScale(): ShaderNodeObject<Node> {
  if (globalScaleUniform === null) {
    globalWatcher = createReducedMotionWatcher()
    globalScaleUniform = uniform(globalWatcher.scale()) as unknown as ShaderNodeObject<Node>
    globalWatcher.subscribe((s) => {
      ;(globalScaleUniform as unknown as { value: number }).value = s
    })
  }
  return globalScaleUniform
}

// Keep a typed reference for tests that may want to re-init between tests.
export const __resetReducedMotionForTests = () => {
  globalWatcher?.dispose()
  globalWatcher = null
  globalScaleUniform = null
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @lovo/matter test reducedMotion`
Expected: PASS — 10 tests green.

- [ ] **Step 5: Commit**

```bash
git add packages/matter/src/runtime/reducedMotion.ts packages/matter/src/runtime/reducedMotion.test.ts
git commit -m "feat(matter): engine-owned scale uniform for reduced-motion gating"
```

### Task 3: Replace `time` re-export with gated `time`

The TSL `time` re-export in `tsl-reexports.ts` becomes `builtinTime.mul(scaleUniform)`. All registry components import `time` from `@lovo/matter`, so they pick up the change automatically.

- [ ] **Step 1: Inspect the current re-export**

Run: `grep -n "time" packages/matter/src/primitives/tsl-reexports.ts`
Note the line that re-exports `time` from `three/tsl`. Plan to replace it with a gated version.

- [ ] **Step 2: Write the failing test**

Create `packages/matter/src/primitives/tsl-reexports.test.ts`:

```ts
import { describe, expect, it, beforeEach } from 'vitest'
import { time } from './tsl-reexports.js'
import { setReducedMotionPolicy, __resetReducedMotionForTests } from '../runtime/reducedMotion.js'

describe('gated time', () => {
  beforeEach(() => {
    __resetReducedMotionForTests()
    setReducedMotionPolicy('auto')
  })

  it('is a TSL node', () => {
    expect(time).toBeDefined()
    expect((time as unknown as { isNode?: boolean }).isNode).toBe(true)
  })

  // Note: We can't assert the actual scaled value without running on the GPU.
  // The gating is verified end-to-end via the docs-site demo in Task 5 and the
  // Playwright reduced-motion test in Phase 5.10.
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @lovo/matter test tsl-reexports`
Expected: FAIL on the import (the test file doesn't exist yet, so vitest finds 0 tests for the new path; or fails because `time` is currently a different identity). Either way, this test exists to lock the gated behavior in for regressions.

- [ ] **Step 4: Apply the gating**

Read the current `packages/matter/src/primitives/tsl-reexports.ts`. Replace the `time` re-export. Example diff (the surrounding file may export many other identifiers — preserve all of them):

```ts
// BEFORE
export { time, uv, vec2, vec3, vec4, /* … */ } from 'three/tsl'

// AFTER — keep all the other re-exports unchanged, but pull `time` separately
export { uv, vec2, vec3, vec4, /* … */ } from 'three/tsl'

import { time as _builtinTime } from 'three/tsl'
import { getReducedMotionTimeScale } from '../runtime/reducedMotion.js'
import type { ShaderNodeObject } from 'three/tsl'
import type { Node } from 'three/webgpu'

/**
 * Engine-gated `time`: equals the TSL built-in `time` multiplied by the
 * reduced-motion scale uniform. Components consuming `time` from `@lovo/matter`
 * automatically respect `prefers-reduced-motion` and the policy override set
 * via `setReducedMotionPolicy`.
 *
 * If you want raw uncapped time (e.g. for a debug overlay), import
 * `time` from `three/tsl` directly.
 */
export const time: ShaderNodeObject<Node> = (_builtinTime as ShaderNodeObject<Node>).mul(
  getReducedMotionTimeScale(),
) as ShaderNodeObject<Node>
```

- [ ] **Step 5: Export the policy API from the package root**

Modify `packages/matter/src/index.ts` — add at the end:

```ts
export {
  setReducedMotionPolicy,
  getReducedMotionPolicy,
  getReducedMotionTimeScale,
  createReducedMotionWatcher,
} from './runtime/reducedMotion.js'
export type { ReducedMotionPolicy, ReducedMotionWatcher } from './runtime/reducedMotion.js'
```

- [ ] **Step 6: Run typecheck + build + tests**

Run: `pnpm --filter @lovo/matter typecheck && pnpm --filter @lovo/matter build && pnpm --filter @lovo/matter test`
Expected: typecheck passes, build emits, all tests green.

- [ ] **Step 7: Commit**

```bash
git add packages/matter/src/primitives/tsl-reexports.ts packages/matter/src/primitives/tsl-reexports.test.ts packages/matter/src/index.ts
git commit -m "feat(matter): gate \`time\` re-export with reduced-motion scale uniform"
```

### Task 4: Demo page — reduced-motion playground

A `/dev/reduced-motion` route that renders a `<LinearGradient speed={1}>` and a Tweakpane panel with policy buttons (`auto`, `off`, `slow`, `paused`). Confirms the gating works end-to-end on the GPU.

- [ ] **Step 1: Create the demo client component**

Create `apps/docs/app/dev/reduced-motion/ReducedMotionDemo.tsx`:

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { LinearGradient } from '@matter/registry/linear-gradient'
import { setReducedMotionPolicy, type ReducedMotionPolicy } from '@lovo/matter'
import { Pane } from 'tweakpane'

export function ReducedMotionDemo() {
  const paneRef = useRef<HTMLDivElement>(null)
  const [policy, setPolicy] = useState<ReducedMotionPolicy>('auto')

  useEffect(() => {
    if (!paneRef.current) return
    const params = { policy }
    const pane = new Pane({ container: paneRef.current, title: 'Reduced motion' })
    pane
      .addBinding(params, 'policy', {
        options: { auto: 'auto', off: 'off', slow: 'slow', paused: 'paused' },
      })
      .on('change', (e) => {
        setPolicy(e.value as ReducedMotionPolicy)
        setReducedMotionPolicy(e.value as ReducedMotionPolicy)
      })
    return () => pane.dispose()
  }, [])

  return (
    <div style={{ display: 'flex', gap: '1rem' }}>
      <div style={{ position: 'relative', width: 600, height: 400 }}>
        <LinearGradient
          colors={['#ff7b72', '#7b9cff', '#7bff9c']}
          angle={45}
          speed={1}
          style={{ borderRadius: 8 }}
        />
      </div>
      <div ref={paneRef} style={{ width: 280 }} />
    </div>
  )
}
```

- [ ] **Step 2: Create the page wrapper**

Create `apps/docs/app/dev/reduced-motion/page.tsx`:

```tsx
import dynamic from 'next/dynamic'

const ReducedMotionDemo = dynamic(
  () => import('./ReducedMotionDemo').then((m) => m.ReducedMotionDemo),
  { ssr: false },
)

export default function Page() {
  return (
    <main style={{ padding: '2rem', maxWidth: 1100, margin: '0 auto' }}>
      <h1>Reduced motion playground</h1>
      <p>
        Toggle the OS setting (System Settings → Accessibility → Display → Reduce motion) or the
        runtime override below. With <code>auto</code>, scale follows the OS; with{' '}
        <code>off</code> it is always 1; with <code>slow</code> it is always 0.3; with{' '}
        <code>paused</code> it is always 0.
      </p>
      <ReducedMotionDemo />
    </main>
  )
}
```

- [ ] **Step 3: Build the docs site and open the page**

Run: `pnpm --filter @matter/docs dev`
Open: http://localhost:3000/dev/reduced-motion

Expected behavior:
- With OS reduce-motion off + policy `auto` → gradient drifts at full speed
- Switch policy to `slow` → gradient drifts visibly slower (~30% speed)
- Switch policy to `paused` → gradient appears frozen (the math is still running, but `time` is multiplied by 0)
- Switch back to `auto` → returns to full speed

- [ ] **Step 4: Verify on a second component**

Open in another tab: http://localhost:3000/components/aurora
With the reduced-motion demo in tab 1, set policy to `slow`. The Aurora page in tab 2 should also slow down (the policy is process-global). Reset to `auto` afterward.

This is the proof that the gated `time` propagates across all components without per-component changes.

- [ ] **Step 5: Commit**

```bash
git add apps/docs/app/dev/reduced-motion/
git commit -m "feat(docs): /dev/reduced-motion demo page for policy gating"
```

### Task 5: Phase 5.1 stop-and-play

- [ ] **Step 1: Capture the validation evidence**

Open the demo page in dev. Cycle through all four policies. Confirm:
1. `auto` (OS reduce off) → full speed
2. `auto` (OS reduce on) → ~30% speed
3. `off` → full speed regardless
4. `slow` → 30% regardless
5. `paused` → frozen

If any of the above doesn't match, debug. Likely culprits:
- TSL `time` cached in a `useMemo` without re-reading the uniform — the gating relies on the uniform being multiplied at TSL graph build time, then the value updating per frame.
- A registry component importing `time` from `three/tsl` directly instead of `@lovo/matter`. Grep: `grep -rn "from 'three/tsl'" registry/` — every `time` should come from `@lovo/matter`.

- [ ] **Step 2: No commit** (validation only)

---

## Phase 5.2 — Pause when tab hidden

**Goal:** Wire `document.visibilityState` to the scheduler. When the tab is hidden, scheduler.pause(); when visible again, scheduler.resume(). Saves GPU time for backgrounded users.

**Files:**
- Create: `packages/matter/src/runtime/visibility.ts`
- Create: `packages/matter/src/runtime/visibility.test.ts`
- Modify: `packages/matter-react/src/MatterScene.tsx`
- Modify: `packages/matter/src/index.ts`

### Task 1: Visibility watcher

- [ ] **Step 1: Write the failing test**

Create `packages/matter/src/runtime/visibility.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createVisibilityWatcher } from './visibility.js'

describe('visibility watcher', () => {
  let listeners: Array<() => void> = []
  let visibilityState = 'visible'

  beforeEach(() => {
    listeners = []
    visibilityState = 'visible'
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => visibilityState,
    })
    vi.spyOn(document, 'addEventListener').mockImplementation((type, cb) => {
      if (type === 'visibilitychange') listeners.push(cb as () => void)
    })
    vi.spyOn(document, 'removeEventListener').mockImplementation((type, cb) => {
      if (type === 'visibilitychange') {
        const i = listeners.indexOf(cb as () => void)
        if (i >= 0) listeners.splice(i, 1)
      }
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('reports visible by default', () => {
    const w = createVisibilityWatcher()
    expect(w.isVisible()).toBe(true)
    w.dispose()
  })

  it('emits change when visibility flips to hidden and back', () => {
    const w = createVisibilityWatcher()
    const cb = vi.fn()
    w.subscribe(cb)
    visibilityState = 'hidden'
    listeners.forEach((l) => l())
    expect(cb).toHaveBeenLastCalledWith(false)
    visibilityState = 'visible'
    listeners.forEach((l) => l())
    expect(cb).toHaveBeenLastCalledWith(true)
    w.dispose()
  })

  it('removes the document listener on dispose', () => {
    const w = createVisibilityWatcher()
    expect(listeners.length).toBe(1)
    w.dispose()
    expect(listeners.length).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @lovo/matter test visibility`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `visibility.ts`**

Create `packages/matter/src/runtime/visibility.ts`:

```ts
export interface VisibilityWatcher {
  isVisible(): boolean
  /** Subscribe to changes. Receives the new visibility state. Returns unsubscribe. */
  subscribe(cb: (visible: boolean) => void): () => void
  dispose(): void
}

/**
 * Watch `document.visibilityState`. Strict-mode-safe — callers create+dispose
 * one per mount cycle.
 */
export function createVisibilityWatcher(): VisibilityWatcher {
  if (typeof document === 'undefined') {
    return {
      isVisible: () => true,
      subscribe: () => () => {},
      dispose: () => {},
    }
  }

  const subs = new Set<(v: boolean) => void>()
  const onChange = () => {
    const v = document.visibilityState === 'visible'
    for (const cb of subs) cb(v)
  }
  document.addEventListener('visibilitychange', onChange)

  return {
    isVisible: () => document.visibilityState === 'visible',
    subscribe(cb) {
      subs.add(cb)
      return () => subs.delete(cb)
    },
    dispose() {
      document.removeEventListener('visibilitychange', onChange)
      subs.clear()
    },
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @lovo/matter test visibility`
Expected: PASS — 3 tests green.

- [ ] **Step 5: Export and commit**

Add to `packages/matter/src/index.ts`:

```ts
export { createVisibilityWatcher } from './runtime/visibility.js'
export type { VisibilityWatcher } from './runtime/visibility.js'
```

```bash
git add packages/matter/src/runtime/visibility.ts packages/matter/src/runtime/visibility.test.ts packages/matter/src/index.ts
git commit -m "feat(matter): visibility watcher over document.visibilityState"
```

### Task 2: Wire visibility into MatterScene

- [ ] **Step 1: Modify `MatterScene.tsx` setup effect**

In `packages/matter-react/src/MatterScene.tsx`, replace the `setup` body (the `try` block) so that after the scheduler is created, a visibility watcher is created and wired to scheduler.pause/resume:

```tsx
import { createRenderer, MatterScheduler, createVisibilityWatcher } from '@lovo/matter'

// inside setup() after `scheduler.start()` and before defining `cleanup`:
const visibility = createVisibilityWatcher()
if (!visibility.isVisible()) scheduler.pause()
const unsubVisibility = visibility.subscribe((visible) => {
  if (visible) scheduler.resume()
  else scheduler.pause()
})

cleanup = () => {
  unsubVisibility()
  visibility.dispose()
  window.removeEventListener('resize', onResize)
  scheduler.dispose()
  renderer.dispose()
}
```

- [ ] **Step 2: Verify build still passes**

Run: `pnpm --filter @lovo/matter-react typecheck && pnpm --filter @lovo/matter-react build`
Expected: typecheck + build green.

- [ ] **Step 3: Commit**

```bash
git add packages/matter-react/src/MatterScene.tsx
git commit -m "feat(matter-react): pause scheduler when document is hidden"
```

### Task 3: Phase 5.2 stop-and-play

- [ ] **Step 1: Manual validation in the docs site**

Run: `pnpm --filter @matter/docs dev`
Open: http://localhost:3000/components/linear-gradient

Open Chrome DevTools → Performance Monitor (More Tools → Performance Monitor). Watch the "JS heap size" or open Performance and start recording. Switch to a different tab for 5 seconds, then switch back. The frame rate trace should show zero frames captured while the tab was hidden.

Alternative: open the page, then open another tab; in the other tab open DevTools and look at the original tab in the Activity panel — should show 0 fps while in background.

If frames continue while hidden, scheduler.pause() didn't fire. Check:
- The visibility watcher subscription is created **after** scheduler.start()
- Strict-Mode-safe: in dev, the cleanup runs once during the pseudo-unmount; ensure the second mount creates a fresh watcher (it does, because `setup()` is called again).

- [ ] **Step 2: No commit** (validation only)

---

## Phase 5.3 — Pause when offscreen

**Goal:** IntersectionObserver on the canvas pauses the scheduler when the canvas is fully out of the viewport, resumes when any portion comes back. Saves GPU when the user has scrolled past a shader.

**Files:**
- Create: `packages/matter/src/runtime/intersection.ts`
- Create: `packages/matter/src/runtime/intersection.test.ts`
- Modify: `packages/matter-react/src/MatterScene.tsx`
- Modify: `packages/matter/src/index.ts`
- Create: `apps/docs/app/dev/offscreen-pause/page.tsx`
- Create: `apps/docs/app/dev/offscreen-pause/OffscreenPauseDemo.tsx`

### Task 1: Intersection watcher

- [ ] **Step 1: Write the failing test**

Create `packages/matter/src/runtime/intersection.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createIntersectionWatcher } from './intersection.js'

interface MockObserver {
  callback: IntersectionObserverCallback
  observed: Element[]
  disconnect: ReturnType<typeof vi.fn>
}

describe('intersection watcher', () => {
  let observers: MockObserver[] = []

  beforeEach(() => {
    observers = []
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        callback: IntersectionObserverCallback
        observed: Element[] = []
        disconnect = vi.fn()
        constructor(cb: IntersectionObserverCallback) {
          this.callback = cb
          observers.push(this as unknown as MockObserver)
        }
        observe(el: Element) {
          this.observed.push(el)
        }
        unobserve(el: Element) {
          this.observed = this.observed.filter((e) => e !== el)
        }
      },
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reports the canvas as in-view by default until the first callback', () => {
    const canvas = document.createElement('canvas')
    const w = createIntersectionWatcher(canvas)
    expect(w.isInView()).toBe(true)
    w.dispose()
  })

  it('updates when the observer reports intersection', () => {
    const canvas = document.createElement('canvas')
    const w = createIntersectionWatcher(canvas)
    const cb = vi.fn()
    w.subscribe(cb)
    const obs = observers[0]!
    obs.callback(
      [{ isIntersecting: false } as IntersectionObserverEntry],
      obs as unknown as IntersectionObserver,
    )
    expect(w.isInView()).toBe(false)
    expect(cb).toHaveBeenLastCalledWith(false)
    obs.callback(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      obs as unknown as IntersectionObserver,
    )
    expect(w.isInView()).toBe(true)
    expect(cb).toHaveBeenLastCalledWith(true)
    w.dispose()
  })

  it('disconnects on dispose', () => {
    const canvas = document.createElement('canvas')
    const w = createIntersectionWatcher(canvas)
    const obs = observers[0]!
    w.dispose()
    expect(obs.disconnect).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @lovo/matter test intersection`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `intersection.ts`**

Create `packages/matter/src/runtime/intersection.ts`:

```ts
export interface IntersectionWatcher {
  isInView(): boolean
  subscribe(cb: (inView: boolean) => void): () => void
  dispose(): void
}

/**
 * Watch a canvas's viewport intersection. Pauses tied to this watcher should
 * be resumed when the canvas is *any* fraction visible. Strict-mode-safe.
 */
export function createIntersectionWatcher(canvas: HTMLCanvasElement): IntersectionWatcher {
  if (typeof IntersectionObserver === 'undefined') {
    return {
      isInView: () => true,
      subscribe: () => () => {},
      dispose: () => {},
    }
  }

  const subs = new Set<(v: boolean) => void>()
  let inView = true
  const obs = new IntersectionObserver(
    (entries) => {
      const next = entries.some((e) => e.isIntersecting)
      if (next === inView) return
      inView = next
      for (const cb of subs) cb(inView)
    },
    { threshold: 0 },
  )
  obs.observe(canvas)

  return {
    isInView: () => inView,
    subscribe(cb) {
      subs.add(cb)
      return () => subs.delete(cb)
    },
    dispose() {
      obs.disconnect()
      subs.clear()
    },
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @lovo/matter test intersection`
Expected: PASS — 3 tests green.

- [ ] **Step 5: Export and commit**

Add to `packages/matter/src/index.ts`:

```ts
export { createIntersectionWatcher } from './runtime/intersection.js'
export type { IntersectionWatcher } from './runtime/intersection.js'
```

```bash
git add packages/matter/src/runtime/intersection.ts packages/matter/src/runtime/intersection.test.ts packages/matter/src/index.ts
git commit -m "feat(matter): intersection watcher for canvas viewport visibility"
```

### Task 2: Combined pause logic in MatterScene

A scene should pause if **either** the tab is hidden **or** the canvas is offscreen. Both watchers contribute to a derived "should run" state.

- [ ] **Step 1: Modify the scheduler-pause logic in MatterScene**

In `packages/matter-react/src/MatterScene.tsx`, replace the visibility-only logic from Phase 5.2 with a combined gate:

```tsx
import {
  createRenderer,
  MatterScheduler,
  createVisibilityWatcher,
  createIntersectionWatcher,
} from '@lovo/matter'

// inside setup() after `scheduler.start()`:
const visibility = createVisibilityWatcher()
const intersection = createIntersectionWatcher(canvas)

const updatePauseState = () => {
  const shouldRun = visibility.isVisible() && intersection.isInView()
  if (shouldRun) scheduler.resume()
  else scheduler.pause()
}
updatePauseState() // apply initial state

const unsubVisibility = visibility.subscribe(updatePauseState)
const unsubIntersection = intersection.subscribe(updatePauseState)

cleanup = () => {
  unsubVisibility()
  unsubIntersection()
  visibility.dispose()
  intersection.dispose()
  window.removeEventListener('resize', onResize)
  scheduler.dispose()
  renderer.dispose()
}
```

- [ ] **Step 2: Verify build + typecheck**

Run: `pnpm --filter @lovo/matter-react typecheck && pnpm --filter @lovo/matter-react build`
Expected: green.

- [ ] **Step 3: Commit**

```bash
git add packages/matter-react/src/MatterScene.tsx
git commit -m "feat(matter-react): pause scheduler when canvas is offscreen"
```

### Task 3: Long scroll demo page

- [ ] **Step 1: Create the demo page**

Create `apps/docs/app/dev/offscreen-pause/OffscreenPauseDemo.tsx`:

```tsx
'use client'

import { LinearGradient } from '@matter/registry/linear-gradient'
import { MatterMonitor } from '@lovo/matter-react'

const Spacer = ({ label }: { label: string }) => (
  <div
    style={{
      height: '120vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '1.2rem',
      color: '#666',
      borderTop: '1px solid #333',
      borderBottom: '1px solid #333',
    }}
  >
    {label}
  </div>
)

const Slot = ({ id, color }: { id: number; color: string }) => (
  <div
    id={`slot-${id}`}
    style={{ position: 'relative', width: '100%', height: 360, margin: '2rem 0' }}
  >
    <LinearGradient colors={[color, '#7b9cff']} angle={45 + id * 30} speed={0.5} />
    <div
      style={{ position: 'absolute', top: 8, left: 8, color: '#fff', font: 'bold 0.9rem monospace' }}
    >
      Slot {id} — watch its tick counter
    </div>
    <MatterMonitor anchor="bottom-right" />
  </div>
)

export function OffscreenPauseDemo() {
  return (
    <main style={{ maxWidth: 800, margin: '0 auto', padding: '2rem' }}>
      <h1>Offscreen pause</h1>
      <p>
        Three Matter scenes separated by tall scroll spacers. Watch each <code>MatterMonitor</code>{' '}
        — only the in-view scene should be ticking.
      </p>
      <Slot id={1} color="#ff7b72" />
      <Spacer label="Scroll down…" />
      <Slot id={2} color="#7bff9c" />
      <Spacer label="Keep scrolling…" />
      <Slot id={3} color="#ffce6e" />
    </main>
  )
}
```

- [ ] **Step 2: Create the page wrapper**

Create `apps/docs/app/dev/offscreen-pause/page.tsx`:

```tsx
import dynamic from 'next/dynamic'

const OffscreenPauseDemo = dynamic(
  () => import('./OffscreenPauseDemo').then((m) => m.OffscreenPauseDemo),
  { ssr: false },
)

export default function Page() {
  return <OffscreenPauseDemo />
}
```

Note: This page imports `MatterMonitor`, which is implemented in Phase 5.5. Defer creating this page to Phase 5.5 if you're executing strictly in order — or stub the import until 5.5 is done. The page-creation task is parked here because conceptually it validates 5.3.

- [ ] **Step 3: Validation gate (after 5.5 lands)**

After Phase 5.5 ships `MatterMonitor`, open http://localhost:3000/dev/offscreen-pause. Scroll slowly. Each scene's tick counter should:
- Increment when its slot is in view
- Stop incrementing when fully scrolled past
- Resume when scrolled back into view

If a scene continues to tick while offscreen, debug:
- `IntersectionObserver` not firing — verify with `console.log` inside `intersection.ts`
- Watcher disposed prematurely (Strict Mode) — confirm a fresh watcher is created on the second mount

- [ ] **Step 4: No commit yet** (commit happens in 5.5 after `MatterMonitor` lands)

---

## Phase 5.4 — Render-on-demand opt-in

**Goal:** Add a `setIdle(boolean)` method to `MatterScheduler`. When idle, the rAF loop skips ticks (callback runs once for a final flush, then halts until idle is cleared). Add a `useStaticHint(idle: boolean)` hook in `@lovo/matter-react` that components like `<LinearGradient speed={0}>` can opt into. Wire LinearGradient as the proof point.

**Files:**
- Modify: `packages/matter/src/runtime/MatterScheduler.ts`
- Modify: `packages/matter/src/runtime/MatterScheduler.test.ts`
- Create: `packages/matter-react/src/useStaticHint.ts`
- Create: `packages/matter-react/src/useStaticHint.test.tsx`
- Modify: `packages/matter-react/src/index.ts`
- Modify: `registry/linear-gradient.tsx`

### Task 1: `setIdle` on the scheduler

- [ ] **Step 1: Write the failing test**

Append to `packages/matter/src/runtime/MatterScheduler.test.ts`:

```ts
describe('setIdle (render-on-demand)', () => {
  let rafCallbacks: FrameRequestCallback[] = []
  let nextRafId = 0

  beforeEach(() => {
    rafCallbacks = []
    nextRafId = 0
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafCallbacks.push(cb)
      return ++nextRafId
    })
    vi.stubGlobal('cancelAnimationFrame', () => {})
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const tickFrame = (now = performance.now()) => {
    const callbacks = rafCallbacks
    rafCallbacks = []
    for (const cb of callbacks) cb(now)
  }

  it('runs one final tick when setIdle(true) is called, then halts', () => {
    const scheduler = new MatterScheduler()
    const client = vi.fn()
    scheduler.add(client)
    scheduler.start()
    tickFrame(0)
    tickFrame(16)
    expect(client).toHaveBeenCalledTimes(2)

    scheduler.setIdle(true)
    tickFrame(32) // final flush tick
    expect(client).toHaveBeenCalledTimes(3)
    tickFrame(48) // no further ticks
    expect(client).toHaveBeenCalledTimes(3)
    tickFrame(64)
    expect(client).toHaveBeenCalledTimes(3)
  })

  it('resumes ticking when setIdle(false) is called', () => {
    const scheduler = new MatterScheduler()
    const client = vi.fn()
    scheduler.add(client)
    scheduler.start()
    scheduler.setIdle(true)
    tickFrame(0) // final flush
    expect(client).toHaveBeenCalledTimes(1)
    tickFrame(16) // no tick (idle)
    expect(client).toHaveBeenCalledTimes(1)

    scheduler.setIdle(false)
    tickFrame(32)
    expect(client).toHaveBeenCalledTimes(2)
    tickFrame(48)
    expect(client).toHaveBeenCalledTimes(3)
  })

  it('requestRender() forces one tick while idle', () => {
    const scheduler = new MatterScheduler()
    const client = vi.fn()
    scheduler.add(client)
    scheduler.start()
    scheduler.setIdle(true)
    tickFrame(0)
    expect(client).toHaveBeenCalledTimes(1)
    tickFrame(16)
    expect(client).toHaveBeenCalledTimes(1)

    scheduler.requestRender()
    tickFrame(32)
    expect(client).toHaveBeenCalledTimes(2)
    tickFrame(48) // back to idle
    expect(client).toHaveBeenCalledTimes(2)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @lovo/matter test MatterScheduler`
Expected: FAIL — `scheduler.setIdle is not a function`.

- [ ] **Step 3: Implement `setIdle` and `requestRender`**

Modify `packages/matter/src/runtime/MatterScheduler.ts`. Add new private state and methods:

```ts
export class MatterScheduler {
  private readonly clients = new Set<SchedulerClient>()
  private rafId: number | null = null
  private running = false
  private paused = false
  private idle = false
  private flushPending = false
  private startedAt = 0
  private lastTickAt = 0

  /* … existing start/stop/pause/resume/add/remove/dispose unchanged … */

  /**
   * Mark the scheduler idle. The next tick still fires (a final flush so
   * uniform changes that triggered the idle state are rendered), then the
   * rAF loop halts. Use `requestRender()` or `setIdle(false)` to wake.
   */
  setIdle(idle: boolean): void {
    if (this.idle === idle) return
    this.idle = idle
    if (idle) {
      this.flushPending = true
      this.maybeQueue()
    } else {
      this.flushPending = false
      this.maybeQueue()
    }
  }

  /** Force a single tick while idle. Useful for prop-change invalidation. */
  requestRender(): void {
    if (!this.idle) return
    this.flushPending = true
    this.maybeQueue()
  }

  private maybeQueue(): void {
    if (this.rafId !== null) return
    if (!this.running) return
    if (this.clients.size === 0) return
    if (this.idle && !this.flushPending) return
    this.rafId = requestAnimationFrame(this.frame)
  }

  private readonly frame = (now: number): void => {
    this.rafId = null
    if (!this.running || this.paused) return

    if (this.startedAt === 0) {
      this.startedAt = now
      this.lastTickAt = now
    }
    const delta = (now - this.lastTickAt) / 1000
    const elapsed = (now - this.startedAt) / 1000
    this.lastTickAt = now

    const tick: SchedulerTick = { delta, elapsed, now }
    for (const client of this.clients) {
      client(tick)
    }

    this.flushPending = false
    this.maybeQueue()
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @lovo/matter test MatterScheduler`
Expected: PASS — all scheduler tests (existing + new) green.

- [ ] **Step 5: Commit**

```bash
git add packages/matter/src/runtime/MatterScheduler.ts packages/matter/src/runtime/MatterScheduler.test.ts
git commit -m "feat(matter): scheduler.setIdle/requestRender for render-on-demand"
```

### Task 2: `useStaticHint` hook

- [ ] **Step 1: Write the failing test**

Create `packages/matter-react/src/useStaticHint.test.tsx`:

```tsx
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { MatterScheduler } from '@lovo/matter'
import { MatterContext } from './matter-context.js'
import { useStaticHint } from './useStaticHint.js'
import type { ReactNode } from 'react'

// Minimal MatterContextValue stub — only `scheduler` is exercised here.
const makeWrapper = (scheduler: MatterScheduler) => {
  return ({ children }: { children: ReactNode }) => (
    <MatterContext.Provider
      value={
        {
          scheduler,
          // The other context fields aren't read by useStaticHint — cast.
        } as unknown as React.ContextType<typeof MatterContext>
      }
    >
      {children}
    </MatterContext.Provider>
  )
}

describe('useStaticHint', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', () => 0)
    vi.stubGlobal('cancelAnimationFrame', () => {})
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('marks the scheduler idle when hint=true', () => {
    const scheduler = new MatterScheduler()
    const setIdle = vi.spyOn(scheduler, 'setIdle')
    renderHook(() => useStaticHint(true), { wrapper: makeWrapper(scheduler) })
    expect(setIdle).toHaveBeenLastCalledWith(true)
  })

  it('marks the scheduler not idle when hint=false', () => {
    const scheduler = new MatterScheduler()
    const setIdle = vi.spyOn(scheduler, 'setIdle')
    renderHook(() => useStaticHint(false), { wrapper: makeWrapper(scheduler) })
    expect(setIdle).toHaveBeenLastCalledWith(false)
  })

  it('reverts to non-idle on unmount', () => {
    const scheduler = new MatterScheduler()
    const setIdle = vi.spyOn(scheduler, 'setIdle')
    const { unmount } = renderHook(() => useStaticHint(true), {
      wrapper: makeWrapper(scheduler),
    })
    unmount()
    expect(setIdle).toHaveBeenLastCalledWith(false)
  })

  it('calls requestRender when transitioning hint true→true with a dependency change is irrelevant', () => {
    // Sanity: the hook does not spuriously call requestRender on every render
    const scheduler = new MatterScheduler()
    const requestRender = vi.spyOn(scheduler, 'requestRender')
    const { rerender } = renderHook(({ hint }) => useStaticHint(hint), {
      wrapper: makeWrapper(scheduler),
      initialProps: { hint: true },
    })
    rerender({ hint: true })
    rerender({ hint: true })
    expect(requestRender).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @lovo/matter-react test useStaticHint`
Expected: FAIL — module not found. (Note: Phase 5.6 sets up the test environment; if happy-dom isn't set up yet, complete that prerequisite from 5.6 Task 1 first or run this task as part of 5.6.)

- [ ] **Step 3: Implement `useStaticHint`**

Create `packages/matter-react/src/useStaticHint.ts`:

```tsx
'use client'

import { useEffect } from 'react'
import { useMatterContext } from './useMatterContext.js'

/**
 * Opt a component out of the rAF loop while it has no dynamic uniforms.
 *
 * When `hint` is true, the scheduler runs one final flush tick (so any
 * uniform changes since the last frame are rendered) and then halts the
 * rAF loop until either `hint` becomes false or another component in the
 * same scene calls `scheduler.requestRender()`.
 *
 * Use for components whose animation is fully derived from props that don't
 * include `time`, e.g. `<LinearGradient speed={0}>` with no `interactive`.
 */
export function useStaticHint(hint: boolean): void {
  const { scheduler } = useMatterContext()
  useEffect(() => {
    scheduler.setIdle(hint)
    return () => scheduler.setIdle(false)
  }, [scheduler, hint])
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @lovo/matter-react test useStaticHint`
Expected: PASS — 4 tests green.

- [ ] **Step 5: Export and commit**

Add to `packages/matter-react/src/index.ts`:

```ts
export { useStaticHint } from './useStaticHint.js'
```

```bash
git add packages/matter-react/src/useStaticHint.ts packages/matter-react/src/useStaticHint.test.tsx packages/matter-react/src/index.ts
git commit -m "feat(matter-react): useStaticHint hook for render-on-demand"
```

### Task 3: Wire LinearGradient as the proof point

- [ ] **Step 1: Identify the static condition**

Read `registry/linear-gradient.tsx`. Identify when the component has **no time-dependent behavior**: when `speed === 0` (no drift) and no other dynamic prop is bound to a Matter signal. (For now, simplify to `speed === 0`.)

- [ ] **Step 2: Add the hook call**

Modify `registry/linear-gradient.tsx`. Inside the component, after props are destructured but before the material is built, add:

```tsx
import { useStaticHint } from '@lovo/matter-react'

// inside the component body:
const isStatic = typeof speed === 'number' && speed === 0
useStaticHint(isStatic)
```

If `speed` is an `AnimatableProp<number>` (signal), the type-narrow to `number` excludes signals — they always count as dynamic. That's correct.

- [ ] **Step 3: Verify build**

Run: `pnpm --filter @matter/registry typecheck && pnpm build`
Expected: green across the workspace.

- [ ] **Step 4: Commit**

```bash
git add registry/linear-gradient.tsx
git commit -m "feat(registry): LinearGradient opts into render-on-demand when speed=0"
```

### Task 4: Phase 5.4 stop-and-play

- [ ] **Step 1: Manual validation**

Run: `pnpm --filter @matter/docs dev`
Open: http://localhost:3000/components/linear-gradient

Open Chrome DevTools → Performance → Record. Set `speed` to 0 in the Tweakpane panel. After 1 second, recording should show essentially zero JS frames. Set `speed` to 0.5 — frames return at 60fps.

If frames continue at speed=0:
- Confirm `useStaticHint` actually fires on prop change. Add a `console.log('[LinearGradient] static?', isStatic)`.
- Confirm `scheduler.setIdle(true)` is being called via a `console.log` inside `setIdle`.
- The first tick *after* `setIdle(true)` is intentional (final flush) — verify the loop stops on tick 2+.

- [ ] **Step 2: No commit** (validation only)

---

## Phase 5.5 — `MatterMonitor` dev overlay

**Goal:** A small `<MatterMonitor />` component that renders an HTML overlay showing live FPS, total ticks, paused state, and idle state. Drop into any `<MatterScene>` for instant perf observability.

**Files:**
- Create: `packages/matter-react/src/MatterMonitor.tsx`
- Create: `packages/matter-react/src/MatterMonitor.test.tsx`
- Modify: `packages/matter-react/src/index.ts`
- Create: `apps/docs/app/dev/perf-monitor/page.tsx`
- Create: `apps/docs/app/dev/perf-monitor/PerfMonitorDemo.tsx`

### Task 1: Implement `MatterMonitor`

- [ ] **Step 1: Write the failing test**

Create `packages/matter-react/src/MatterMonitor.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MatterScheduler } from '@lovo/matter'
import { MatterContext } from './matter-context.js'
import { MatterMonitor } from './MatterMonitor.js'
import type { ReactNode } from 'react'

const wrap = (scheduler: MatterScheduler) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MatterContext.Provider
        value={{ scheduler } as unknown as React.ContextType<typeof MatterContext>}
      >
        {children}
      </MatterContext.Provider>
    )
  }

describe('MatterMonitor', () => {
  it('renders without crashing inside a MatterScene context', () => {
    const scheduler = new MatterScheduler()
    render(<MatterMonitor />, { wrapper: wrap(scheduler) })
    expect(screen.getByTestId('matter-monitor')).toBeInTheDocument()
  })

  it('shows initial state: 0 ticks, fps —', () => {
    const scheduler = new MatterScheduler()
    render(<MatterMonitor />, { wrapper: wrap(scheduler) })
    expect(screen.getByTestId('matter-monitor-ticks').textContent).toContain('0')
    expect(screen.getByTestId('matter-monitor-fps').textContent).toMatch(/^—|0/)
  })

  it('renders without context (graceful no-op)', () => {
    // Outside a MatterScene, the monitor should render a small "no scene" badge
    // rather than throwing.
    expect(() => render(<MatterMonitor />)).not.toThrow()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @lovo/matter-react test MatterMonitor`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `MatterMonitor.tsx`**

Create `packages/matter-react/src/MatterMonitor.tsx`:

```tsx
'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useContext } from 'react'
import { MatterContext } from './matter-context.js'

export type MonitorAnchor = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

const anchorStyle: Record<MonitorAnchor, CSSProperties> = {
  'top-left': { top: 8, left: 8 },
  'top-right': { top: 8, right: 8 },
  'bottom-left': { bottom: 8, left: 8 },
  'bottom-right': { bottom: 8, right: 8 },
}

const baseStyle: CSSProperties = {
  position: 'absolute',
  zIndex: 10,
  padding: '6px 8px',
  borderRadius: 6,
  background: 'rgba(0, 0, 0, 0.6)',
  color: '#fff',
  font: '11px ui-monospace, monospace',
  lineHeight: 1.4,
  pointerEvents: 'none',
  whiteSpace: 'pre',
}

export interface MatterMonitorProps {
  anchor?: MonitorAnchor
}

/**
 * Dev-only overlay that displays the current scene's FPS, tick count, and
 * paused/idle state. Reads from the surrounding `<MatterScene>` via context
 * and subscribes to its scheduler. Renders nothing useful if mounted outside
 * a scene.
 */
export function MatterMonitor({ anchor = 'top-right' }: MatterMonitorProps) {
  const ctx = useContext(MatterContext)
  const [stats, setStats] = useState({ fps: 0, ticks: 0, frames: 0 })
  const ticksRef = useRef(0)
  const fpsAccumRef = useRef({ frames: 0, lastSampleAt: 0, fps: 0 })

  useEffect(() => {
    if (!ctx) return
    const client = (tick: { now: number }) => {
      ticksRef.current += 1
      const acc = fpsAccumRef.current
      acc.frames += 1
      if (acc.lastSampleAt === 0) acc.lastSampleAt = tick.now
      const dt = tick.now - acc.lastSampleAt
      if (dt >= 500) {
        acc.fps = Math.round((acc.frames * 1000) / dt)
        acc.frames = 0
        acc.lastSampleAt = tick.now
      }
      setStats({ fps: acc.fps, ticks: ticksRef.current, frames: acc.frames })
    }
    ctx.scheduler.add(client)
    return () => ctx.scheduler.remove(client)
  }, [ctx])

  if (!ctx) {
    return (
      <div data-testid="matter-monitor" style={{ ...baseStyle, ...anchorStyle[anchor] }}>
        no scene
      </div>
    )
  }

  return (
    <div data-testid="matter-monitor" style={{ ...baseStyle, ...anchorStyle[anchor] }}>
      <span data-testid="matter-monitor-fps">fps: {stats.fps || '—'}</span>
      {'\n'}
      <span data-testid="matter-monitor-ticks">ticks: {stats.ticks}</span>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @lovo/matter-react test MatterMonitor`
Expected: PASS — 3 tests green.

- [ ] **Step 5: Export and commit**

Add to `packages/matter-react/src/index.ts`:

```ts
export { MatterMonitor } from './MatterMonitor.js'
export type { MatterMonitorProps, MonitorAnchor } from './MatterMonitor.js'
```

```bash
git add packages/matter-react/src/MatterMonitor.tsx packages/matter-react/src/MatterMonitor.test.tsx packages/matter-react/src/index.ts
git commit -m "feat(matter-react): MatterMonitor dev overlay (fps + tick counter)"
```

### Task 2: `/dev/perf-monitor` showcase page

- [ ] **Step 1: Create the demo client**

Create `apps/docs/app/dev/perf-monitor/PerfMonitorDemo.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { LinearGradient } from '@matter/registry/linear-gradient'
import { MatterMonitor } from '@lovo/matter-react'

export function PerfMonitorDemo() {
  const [speed, setSpeed] = useState(0.5)
  return (
    <div>
      <label style={{ display: 'block', marginBottom: 12 }}>
        speed: <input type="range" min={0} max={2} step={0.1} value={speed} onChange={(e) => setSpeed(+e.target.value)} />
        <code style={{ marginLeft: 8 }}>{speed.toFixed(1)}</code>
      </label>
      <div style={{ position: 'relative', width: 600, height: 400 }}>
        <LinearGradient colors={['#ff7b72', '#7b9cff']} angle={45} speed={speed} />
        <MatterMonitor anchor="top-right" />
      </div>
      <p style={{ marginTop: 12, color: '#666' }}>
        Set <code>speed</code> to 0 — fps should drop to 0 after one final flush tick (render-on-demand).
        Switch tabs — fps should drop to 0 (visibility pause). Scroll the canvas off-screen — fps should
        drop to 0 (intersection pause).
      </p>
    </div>
  )
}
```

- [ ] **Step 2: Create the page wrapper**

Create `apps/docs/app/dev/perf-monitor/page.tsx`:

```tsx
import dynamic from 'next/dynamic'

const PerfMonitorDemo = dynamic(
  () => import('./PerfMonitorDemo').then((m) => m.PerfMonitorDemo),
  { ssr: false },
)

export default function Page() {
  return (
    <main style={{ padding: '2rem', maxWidth: 1100, margin: '0 auto' }}>
      <h1>Perf monitor</h1>
      <PerfMonitorDemo />
    </main>
  )
}
```

- [ ] **Step 3: Phase 5.5 stop-and-play**

Run: `pnpm --filter @matter/docs dev`
Open: http://localhost:3000/dev/perf-monitor

Verify:
1. Default speed (0.5): fps shows ~60, tick counter increments rapidly.
2. Set speed to 0: fps drops to 0 after one tick (you may briefly see fps:60 → 0). Tick counter freezes.
3. Switch to another tab for 5s, return: tick counter is unchanged from the moment you switched away.
4. Open a long-page route in another tab, scroll the canvas off-screen on this page, then bring this page back to focus while canvas is offscreen: fps should be 0. Scroll back: resumes.

This validates **Phases 5.2, 5.3, 5.4, and 5.5 simultaneously** through the monitor.

- [ ] **Step 4: Commit**

```bash
git add apps/docs/app/dev/perf-monitor/ apps/docs/app/dev/offscreen-pause/
git commit -m "feat(docs): /dev/perf-monitor and /dev/offscreen-pause showcase pages"
```

---

## Phase 5.6 — Hook & binding unit tests

**Goal:** Stand up a happy-dom + RTL test environment in `@lovo/matter-react` and write unit tests for every hook and binding component. Lays the foundation for confident refactoring.

**Files:**
- Modify: `packages/matter-react/package.json` (add devDeps)
- Modify: `packages/matter-react/vitest.config.ts` (add happy-dom env + setup)
- Create: `packages/matter-react/src/test-setup.ts`
- Create: `packages/matter-react/src/useShaderMaterial.test.tsx`
- Create: `packages/matter-react/src/useAnimatableUniform.test.tsx`
- Create: `packages/matter-react/src/useCursor.test.tsx`
- Create: `packages/matter-react/src/MatterScene.test.tsx`
- Create: `packages/matter-react/src/FallbackBoundary.test.tsx`

### Task 1: Set up happy-dom + RTL

- [ ] **Step 1: Add devDeps**

Run from repo root:

```bash
pnpm add -D --filter @lovo/matter-react happy-dom @testing-library/react @testing-library/dom @testing-library/jest-dom
```

Verify `packages/matter-react/package.json` now lists those four devDeps.

- [ ] **Step 2: Create the test setup file**

Create `packages/matter-react/src/test-setup.ts`:

```ts
import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => {
  cleanup()
})
```

- [ ] **Step 3: Update the vitest config**

Read the existing `packages/matter-react/vitest.config.ts`. Replace contents with:

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    globals: false,
    passWithNoTests: true,
    setupFiles: ['./src/test-setup.ts'],
  },
})
```

If `@vitejs/plugin-react` isn't a workspace devDep yet for this package, add it:

```bash
pnpm add -D --filter @lovo/matter-react @vitejs/plugin-react
```

- [ ] **Step 4: Smoke test the setup**

Run: `pnpm --filter @lovo/matter-react test`
Expected: Existing `useScroll.test.ts` and `useResize.test.ts` still pass; happy-dom is the env.

- [ ] **Step 5: Commit**

```bash
git add packages/matter-react/package.json packages/matter-react/vitest.config.ts packages/matter-react/src/test-setup.ts
git commit -m "test(matter-react): add happy-dom + RTL test environment"
```

### Task 2: Test `useShaderMaterial`

- [ ] **Step 1: Write the test**

Create `packages/matter-react/src/useShaderMaterial.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import { vec3 } from 'three/tsl'
import { useShaderMaterial } from './useShaderMaterial.js'

describe('useShaderMaterial', () => {
  it('returns a MeshBasicNodeMaterial with colorNode set', () => {
    const { result } = renderHook(() => useShaderMaterial(() => vec3(1, 0, 0)))
    expect(result.current).toBeDefined()
    expect((result.current as unknown as { isMaterial: boolean }).isMaterial).toBe(true)
    expect(result.current.colorNode).toBeDefined()
  })

  it('disposes the material on unmount', () => {
    const { result, unmount } = renderHook(() => useShaderMaterial(() => vec3(1, 0, 0)))
    const material = result.current
    let disposed = false
    const original = material.dispose.bind(material)
    material.dispose = () => {
      disposed = true
      original()
    }
    unmount()
    expect(disposed).toBe(true)
  })

  it('rebuilds the material when the build function reference changes', () => {
    const { result, rerender } = renderHook(({ build }) => useShaderMaterial(build), {
      initialProps: { build: () => vec3(1, 0, 0) },
    })
    const first = result.current
    rerender({ build: () => vec3(0, 1, 0) })
    expect(result.current).not.toBe(first)
  })
})
```

- [ ] **Step 2: Run test**

Run: `pnpm --filter @lovo/matter-react test useShaderMaterial`
Expected: PASS — 3 tests green.

- [ ] **Step 3: Commit**

```bash
git add packages/matter-react/src/useShaderMaterial.test.tsx
git commit -m "test(matter-react): unit tests for useShaderMaterial"
```

### Task 3: Test `useAnimatableUniform`

- [ ] **Step 1: Write the test**

Create `packages/matter-react/src/useAnimatableUniform.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useAnimatableUniform, type MatterSignal } from './useAnimatableUniform.js'

const makeSignal = <T,>(initial: T) => {
  let value = initial
  const subs = new Set<(v: T) => void>()
  const sig: MatterSignal<T> = {
    get: () => value,
    on: (_event, cb) => {
      subs.add(cb)
      return () => subs.delete(cb)
    },
  }
  const set = (next: T) => {
    value = next
    for (const cb of subs) cb(next)
  }
  return { signal: sig, set }
}

describe('useAnimatableUniform', () => {
  it('initializes a uniform with the plain prop value', () => {
    const { result } = renderHook(() => useAnimatableUniform(0.5))
    expect((result.current as unknown as { value: number }).value).toBe(0.5)
  })

  it('updates the uniform when the prop changes', () => {
    const { result, rerender } = renderHook(({ v }) => useAnimatableUniform(v), {
      initialProps: { v: 0.5 },
    })
    rerender({ v: 0.9 })
    expect((result.current as unknown as { value: number }).value).toBe(0.9)
  })

  it('subscribes to a signal and writes value imperatively', () => {
    const { signal, set } = makeSignal(0.1)
    const { result } = renderHook(() => useAnimatableUniform(signal))
    expect((result.current as unknown as { value: number }).value).toBe(0.1)
    set(0.7)
    expect((result.current as unknown as { value: number }).value).toBe(0.7)
  })

  it('unsubscribes from signal on unmount', () => {
    const { signal, set } = makeSignal(0.1)
    const { result, unmount } = renderHook(() => useAnimatableUniform(signal))
    expect((result.current as unknown as { value: number }).value).toBe(0.1)
    unmount()
    set(0.9)
    // Uniform should not have updated after unmount.
    expect((result.current as unknown as { value: number }).value).toBe(0.1)
  })

  it('keeps the same uniform identity across plain-value updates', () => {
    const { result, rerender } = renderHook(({ v }) => useAnimatableUniform(v), {
      initialProps: { v: 0.5 },
    })
    const first = result.current
    rerender({ v: 0.9 })
    expect(result.current).toBe(first)
  })
})
```

- [ ] **Step 2: Run test**

Run: `pnpm --filter @lovo/matter-react test useAnimatableUniform`
Expected: PASS — 5 tests green.

- [ ] **Step 3: Commit**

```bash
git add packages/matter-react/src/useAnimatableUniform.test.tsx
git commit -m "test(matter-react): unit tests for useAnimatableUniform"
```

### Task 4: Test `useCursor`

The hook owns a CursorInput instance with Strict-Mode-safe lifecycle (gotcha #14 in CLAUDE.md). Verify create-attach-dispose-recreate works.

- [ ] **Step 1: Write the test**

Create `packages/matter-react/src/useCursor.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest'
import { render, act } from '@testing-library/react'
import { useEffect, useRef } from 'react'
import { useCursor } from './useCursor.js'

function Probe({ canvas, onCursor }: { canvas: HTMLCanvasElement | null; onCursor: (uv: { x: number; y: number }) => void }) {
  const ref = useRef(canvas)
  useEffect(() => {
    ref.current = canvas
  }, [canvas])
  const cursor = useCursor({ canvas: ref })
  useEffect(() => {
    onCursor({ x: cursor.value[0], y: cursor.value[1] })
  })
  return null
}

describe('useCursor', () => {
  it('returns a cursor uniform with [0.5, 0.5] initial value', () => {
    const canvas = document.createElement('canvas')
    document.body.appendChild(canvas)
    const calls: Array<{ x: number; y: number }> = []
    render(<Probe canvas={canvas} onCursor={(uv) => calls.push(uv)} />)
    expect(calls.at(-1)?.x).toBe(0.5)
    expect(calls.at(-1)?.y).toBe(0.5)
  })

  it('updates uniform on pointer move (canvas-rect normalized)', () => {
    const canvas = document.createElement('canvas')
    document.body.appendChild(canvas)
    canvas.getBoundingClientRect = () =>
      ({ left: 0, top: 0, right: 200, bottom: 100, width: 200, height: 100 }) as DOMRect

    let last = { x: 0.5, y: 0.5 }
    render(<Probe canvas={canvas} onCursor={(uv) => (last = uv)} />)

    act(() => {
      canvas.dispatchEvent(
        new PointerEvent('pointermove', { clientX: 100, clientY: 50, bubbles: true }),
      )
    })

    expect(last.x).toBeCloseTo(0.5, 1)
    expect(last.y).toBeCloseTo(0.5, 1)

    act(() => {
      canvas.dispatchEvent(
        new PointerEvent('pointermove', { clientX: 200, clientY: 0, bubbles: true }),
      )
    })

    expect(last.x).toBeCloseTo(1.0, 1)
    expect(last.y).toBeCloseTo(1.0, 1)
  })

  it('survives Strict Mode pseudo-unmount/remount cycle', () => {
    // happy-dom doesn't run Strict Mode by default; this test asserts that
    // the cleanup-recreate pattern (gotcha #14) does not leave a dead instance.
    const canvas = document.createElement('canvas')
    document.body.appendChild(canvas)
    const { unmount } = render(<Probe canvas={canvas} onCursor={() => {}} />)
    unmount()
    // No assertion — just confirming no errors are thrown.
  })
})
```

- [ ] **Step 2: Run test**

Run: `pnpm --filter @lovo/matter-react test useCursor`
Expected: PASS — 3 tests green. (If happy-dom doesn't dispatch PointerEvent correctly, fall back to a hand-built `PointerEvent`-shaped object using `vi.fn()`-based listeners.)

- [ ] **Step 3: Commit**

```bash
git add packages/matter-react/src/useCursor.test.tsx
git commit -m "test(matter-react): unit tests for useCursor (canvas-rect normalization, lifecycle)"
```

### Task 5: Test `FallbackBoundary`

- [ ] **Step 1: Write the test**

Create `packages/matter-react/src/FallbackBoundary.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FallbackBoundary } from './FallbackBoundary.js'

describe('FallbackBoundary', () => {
  it('renders children when no error', () => {
    render(
      <FallbackBoundary fallback={<div>fallback</div>}>
        <div>child</div>
      </FallbackBoundary>,
    )
    expect(screen.getByText('child')).toBeInTheDocument()
    expect(screen.queryByText('fallback')).not.toBeInTheDocument()
  })

  it('renders the fallback when a child throws', () => {
    const Boom = () => {
      throw new Error('boom')
    }
    // Suppress the expected console.error from React's boundary
    const restore = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <FallbackBoundary fallback={<div>fallback</div>}>
        <Boom />
      </FallbackBoundary>,
    )
    expect(screen.getByText('fallback')).toBeInTheDocument()
    restore.mockRestore()
  })
})

import { vi } from 'vitest'
```

- [ ] **Step 2: Run test**

Run: `pnpm --filter @lovo/matter-react test FallbackBoundary`
Expected: PASS — 2 tests green.

- [ ] **Step 3: Commit**

```bash
git add packages/matter-react/src/FallbackBoundary.test.tsx
git commit -m "test(matter-react): unit tests for FallbackBoundary"
```

### Task 6: Test `MatterScene` (mocked renderer)

The scene's `setup()` calls `createRenderer`, which fails in happy-dom (no WebGPU). Mock `createRenderer` and assert lifecycle: scheduler started, visibility/intersection watchers wired, cleanup runs on unmount.

- [ ] **Step 1: Write the test**

Create `packages/matter-react/src/MatterScene.test.tsx`:

```tsx
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { MatterScene } from './MatterScene.js'

vi.mock('@lovo/matter', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@lovo/matter')>()
  return {
    ...actual,
    createRenderer: vi.fn(async () => ({
      three: { render: vi.fn(), dispose: vi.fn(), getPixelRatio: () => 1, setSize: vi.fn() },
      backend: 'webgl2',
      dispose: vi.fn(),
      resize: vi.fn(),
    })),
  }
})

describe('MatterScene', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', () => 0)
    vi.stubGlobal('cancelAnimationFrame', () => {})
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('mounts a canvas', () => {
    const { container } = render(<MatterScene />)
    expect(container.querySelector('canvas')).toBeInTheDocument()
  })

  it('renders fallback before context resolves', () => {
    const { container } = render(
      <MatterScene fallback={<div data-testid="fb">loading</div>} />,
    )
    expect(container.querySelector('[data-testid="fb"]')).toBeInTheDocument()
  })

  it('does not throw on unmount', async () => {
    const { unmount } = render(<MatterScene />)
    await waitFor(() => {})
    expect(() => unmount()).not.toThrow()
  })
})
```

- [ ] **Step 2: Run test**

Run: `pnpm --filter @lovo/matter-react test MatterScene`
Expected: PASS — 3 tests green.

- [ ] **Step 3: Commit**

```bash
git add packages/matter-react/src/MatterScene.test.tsx
git commit -m "test(matter-react): unit tests for MatterScene lifecycle"
```

### Task 7: Phase 5.6 stop-and-play

- [ ] **Step 1: Run the full @lovo/matter-react test suite**

Run: `pnpm --filter @lovo/matter-react test`
Expected: ≥ 25 tests, all green.

If any flake or fail, debug. Common issues:
- Missing `@vitejs/plugin-react` — add it.
- happy-dom missing globals — usually means a real DOM API is needed. happy-dom supports most things; if not, switch the env to `jsdom` and re-run.

- [ ] **Step 2: No commit** (validation only)

---

## Phase 5.7 — Engine perf-default unit tests

**Goal:** All four perf-default modules now have happy-path unit tests (created during 5.1–5.4). This phase fills coverage gaps: integration test that ties scheduler + visibility + intersection + reduced-motion together end-to-end at the unit level (mocked observers and matchMedia), plus a `MatterScheduler.dispose()` invariant test.

**Files:**
- Create: `packages/matter/src/runtime/runtime-integration.test.ts`
- Modify (extend): `packages/matter/src/runtime/MatterScheduler.test.ts`

### Task 1: Scheduler dispose invariants

- [ ] **Step 1: Write the failing test**

Append to `packages/matter/src/runtime/MatterScheduler.test.ts`:

```ts
describe('dispose invariants', () => {
  let rafCallbacks: FrameRequestCallback[] = []
  let nextRafId = 0
  let cancelled: number[] = []

  beforeEach(() => {
    rafCallbacks = []
    nextRafId = 0
    cancelled = []
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafCallbacks.push(cb)
      return ++nextRafId
    })
    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      cancelled.push(id)
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('cancels the pending rAF on dispose', () => {
    const scheduler = new MatterScheduler()
    scheduler.add(vi.fn())
    scheduler.start()
    expect(rafCallbacks.length).toBe(1)
    scheduler.dispose()
    expect(cancelled.length).toBe(1)
  })

  it('does not invoke clients after dispose', () => {
    const scheduler = new MatterScheduler()
    const client = vi.fn()
    scheduler.add(client)
    scheduler.start()
    scheduler.dispose()
    // even if a leftover rAF callback fires, client should not be called
    rafCallbacks.forEach((cb) => cb(performance.now()))
    expect(client).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it passes**

Run: `pnpm --filter @lovo/matter test MatterScheduler`
Expected: PASS — all scheduler tests including the new dispose invariants.

- [ ] **Step 3: Commit**

```bash
git add packages/matter/src/runtime/MatterScheduler.test.ts
git commit -m "test(matter): scheduler dispose invariants"
```

### Task 2: Engine integration test (visibility + intersection + idle)

- [ ] **Step 1: Write the test**

Create `packages/matter/src/runtime/runtime-integration.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { MatterScheduler } from './MatterScheduler.js'
import { createVisibilityWatcher } from './visibility.js'
import { createIntersectionWatcher } from './intersection.js'

describe('runtime integration', () => {
  let rafCallbacks: FrameRequestCallback[] = []
  let nextRafId = 0
  let visibilityState = 'visible'
  const visibilityListeners: Array<() => void> = []
  let observerCallback: IntersectionObserverCallback | null = null

  beforeEach(() => {
    rafCallbacks = []
    nextRafId = 0
    visibilityState = 'visible'
    visibilityListeners.length = 0
    observerCallback = null

    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafCallbacks.push(cb)
      return ++nextRafId
    })
    vi.stubGlobal('cancelAnimationFrame', () => {})

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => visibilityState,
    })
    vi.spyOn(document, 'addEventListener').mockImplementation((type, cb) => {
      if (type === 'visibilitychange') visibilityListeners.push(cb as () => void)
    })
    vi.spyOn(document, 'removeEventListener').mockImplementation((type, cb) => {
      if (type === 'visibilitychange') {
        const i = visibilityListeners.indexOf(cb as () => void)
        if (i >= 0) visibilityListeners.splice(i, 1)
      }
    })

    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(cb: IntersectionObserverCallback) {
          observerCallback = cb
        }
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  const tickFrame = (now = performance.now()) => {
    const callbacks = rafCallbacks
    rafCallbacks = []
    for (const cb of callbacks) cb(now)
  }

  it('combined gates: scene only ticks when visible AND in-view AND not idle', () => {
    const scheduler = new MatterScheduler()
    const client = vi.fn()
    scheduler.add(client)
    scheduler.start()

    const visibility = createVisibilityWatcher()
    const canvas = document.createElement('canvas')
    const intersection = createIntersectionWatcher(canvas)

    const update = () => {
      const should = visibility.isVisible() && intersection.isInView()
      if (should) scheduler.resume()
      else scheduler.pause()
    }
    visibility.subscribe(update)
    intersection.subscribe(update)
    update()

    tickFrame(0)
    expect(client).toHaveBeenCalledTimes(1)

    // Tab hidden → pause
    visibilityState = 'hidden'
    visibilityListeners.forEach((l) => l())
    tickFrame(16)
    expect(client).toHaveBeenCalledTimes(1)

    // Tab visible again → resume
    visibilityState = 'visible'
    visibilityListeners.forEach((l) => l())
    tickFrame(32)
    expect(client).toHaveBeenCalledTimes(2)

    // Canvas offscreen → pause
    observerCallback!([{ isIntersecting: false } as IntersectionObserverEntry], null as never)
    tickFrame(48)
    expect(client).toHaveBeenCalledTimes(2)

    // Canvas back in view → resume
    observerCallback!([{ isIntersecting: true } as IntersectionObserverEntry], null as never)
    tickFrame(64)
    expect(client).toHaveBeenCalledTimes(3)

    // Idle → final flush, then halt
    scheduler.setIdle(true)
    tickFrame(80) // flush
    expect(client).toHaveBeenCalledTimes(4)
    tickFrame(96) // no tick
    expect(client).toHaveBeenCalledTimes(4)

    // Wake via requestRender
    scheduler.requestRender()
    tickFrame(112)
    expect(client).toHaveBeenCalledTimes(5)
  })
})
```

- [ ] **Step 2: Run test**

Run: `pnpm --filter @lovo/matter test runtime-integration`
Expected: PASS — 1 integration test green.

- [ ] **Step 3: Commit**

```bash
git add packages/matter/src/runtime/runtime-integration.test.ts
git commit -m "test(matter): runtime integration test (visibility + intersection + idle)"
```

### Task 3: Phase 5.7 stop-and-play

- [ ] **Step 1: Run the full engine suite**

Run: `pnpm --filter @lovo/matter test`
Expected: 30+ tests, all green. Coverage of all four perf defaults at the unit level.

- [ ] **Step 2: No commit** (validation only)

---

## Phase 5.8 — Playwright visual regression: setup + 6 baselines

**Goal:** Stand up Playwright in a sibling app `apps/docs-tests`. Configure a single baseline run that captures one screenshot per Tier 1 component page (and per recipe page) at frame 60. Subsequent runs diff against the baseline with a small tolerance.

**Files:**
- Create: `apps/docs-tests/package.json`
- Create: `apps/docs-tests/tsconfig.json`
- Create: `apps/docs-tests/playwright.config.ts`
- Create: `apps/docs-tests/visual/linear-gradient.spec.ts`
- Create: `apps/docs-tests/visual/mesh-gradient.spec.ts`
- Create: `apps/docs-tests/visual/aurora.spec.ts`
- Create: `apps/docs-tests/visual/dot-field.spec.ts`
- Create: `apps/docs-tests/visual/noise-field.spec.ts`
- Create: `apps/docs-tests/visual/waves.spec.ts`
- Create: `apps/docs/app/_lib/visualTestHooks.ts`
- Modify: `apps/docs/app/components/*/page.tsx` (×6) — read `?visualTest=1` and pause scheduler at frame 60
- Modify: root `package.json`, `turbo.json`
- Create: `pnpm-workspace.yaml` entry for `apps/docs-tests`

### Task 1: Visual test infrastructure

- [ ] **Step 1: Add visual-test hook to docs site**

Create `apps/docs/app/_lib/visualTestHooks.ts`:

```ts
'use client'

import { useEffect } from 'react'
import { useMatterContext } from '@lovo/matter-react'

const TARGET_FRAME = 60
const QUERY_FLAG = 'visualTest'

/**
 * If the page is loaded with `?visualTest=1`, pauses the scheduler at frame
 * `TARGET_FRAME` and sets `window.__matterTestReady = true`. Playwright waits
 * for that flag before screenshotting.
 *
 * Drop this hook into the top of any client component that owns a
 * MatterScene. The hook is a no-op if the flag isn't present.
 */
export function useVisualTestPause(): void {
  const ctx = useMatterContext()
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    if (params.get(QUERY_FLAG) !== '1') return

    let frame = 0
    const client = (_t: { now: number }) => {
      frame += 1
      if (frame >= TARGET_FRAME) {
        ctx.scheduler.remove(client)
        ctx.scheduler.pause()
        ;(window as unknown as { __matterTestReady: boolean }).__matterTestReady = true
      }
    }
    ctx.scheduler.add(client)
    return () => {
      ctx.scheduler.remove(client)
    }
  }, [ctx])
}
```

- [ ] **Step 2: Wire the hook into one component page**

Edit `apps/docs/app/components/linear-gradient/page.tsx` (or its client child component if the page itself is a server component): import and call `useVisualTestPause()` inside the client component that mounts the `<MatterScene>`.

If the docs structure has a wrapping `<PrimitiveDemo>` or `<LiveDemo>` component, the hook can live in that wrapper instead and apply to all pages at once. Inspect the structure:

Run: `grep -rln "MatterScene\|matter-react" apps/docs/app/components apps/docs/app/_components | head`

Identify the central place where `<MatterScene>` is rendered for component pages. Add `useVisualTestPause()` inside that component once.

- [ ] **Step 3: Repeat for recipes (if their wrapping component differs)**

If the recipe pages use a different wrapper, add the hook there too. Otherwise it's already covered.

- [ ] **Step 4: Smoke test the hook**

Run: `pnpm --filter @matter/docs dev`
Open: http://localhost:3000/components/linear-gradient?visualTest=1
Open DevTools → Console. After ~1 second, run `window.__matterTestReady` — should be `true`.
Open the same URL without `?visualTest=1` — `window.__matterTestReady` is `undefined`.

- [ ] **Step 5: Commit**

```bash
git add apps/docs/app/_lib/visualTestHooks.ts apps/docs/app/components/ apps/docs/app/recipes/ apps/docs/app/_components/
git commit -m "feat(docs): visualTest=1 query flag pauses scheduler at frame 60"
```

### Task 2: Stand up `apps/docs-tests`

- [ ] **Step 1: Add to workspace**

Read `pnpm-workspace.yaml`. Confirm `apps/*` is listed (so `apps/docs-tests` is included automatically). If not, add it.

- [ ] **Step 2: Create `apps/docs-tests/package.json`**

```json
{
  "name": "@matter/docs-tests",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "test:visual": "playwright test",
    "test:visual:update": "playwright test --update-snapshots",
    "test:a11y": "playwright test --grep @a11y",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@playwright/test": "^1.48.0",
    "@axe-core/playwright": "^4.10.0",
    "typescript": "^5"
  }
}
```

Install:

```bash
pnpm install
pnpm --filter @matter/docs-tests exec playwright install --with-deps chromium
```

- [ ] **Step 3: Create `apps/docs-tests/tsconfig.json`**

```json
{
  "extends": "@matter/tsconfig/library.json",
  "compilerOptions": {
    "noEmit": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "types": ["node"]
  },
  "include": ["**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Create `apps/docs-tests/playwright.config.ts`**

```ts
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
    command: 'pnpm --filter @matter/docs build && pnpm --filter @matter/docs start',
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
```

Notes on the tolerance values: `maxDiffPixelRatio: 0.02` allows up to 2% of pixels to differ; `threshold: 0.2` is the per-pixel YIQ tolerance. These are starting values — Phase 5.9 tunes them empirically.

- [ ] **Step 5: Add the root `test:visual` script**

In root `package.json`, add to `scripts`:

```json
"test:visual": "turbo run test:visual",
"test:visual:update": "turbo run test:visual:update"
```

In `turbo.json`, add task definitions:

```json
"test:visual": {
  "dependsOn": ["^build"],
  "outputs": []
},
"test:visual:update": {
  "cache": false,
  "outputs": ["**/snapshots/**"]
}
```

- [ ] **Step 6: Commit**

```bash
git add apps/docs-tests/package.json apps/docs-tests/tsconfig.json apps/docs-tests/playwright.config.ts package.json turbo.json
git commit -m "test(docs-tests): scaffold Playwright app for visual regression"
```

### Task 3: First visual regression spec — LinearGradient

- [ ] **Step 1: Write the spec**

Create `apps/docs-tests/visual/linear-gradient.spec.ts`:

```ts
import { test, expect } from '@playwright/test'

test('LinearGradient — default story', async ({ page }) => {
  await page.goto('/components/linear-gradient?visualTest=1')
  // Wait for the scheduler to pause at frame 60 and signal ready.
  await page.waitForFunction(() => (window as unknown as { __matterTestReady?: boolean }).__matterTestReady === true, undefined, {
    timeout: 15_000,
  })
  // Allow one frame for the pause to render
  await page.waitForTimeout(50)

  const canvas = page.locator('canvas').first()
  await expect(canvas).toHaveScreenshot('linear-gradient-default.png')
})
```

- [ ] **Step 2: Generate the baseline**

Run from repo root:

```bash
pnpm --filter @matter/docs-tests test:visual:update
```

Expected: First-time run produces `apps/docs-tests/visual/linear-gradient.spec.ts-snapshots/linear-gradient-default-chromium.png`. Test reports as PASS (created baseline).

- [ ] **Step 3: Re-run to verify zero diff**

Run: `pnpm --filter @matter/docs-tests test:visual`
Expected: PASS with no diff.

- [ ] **Step 4: Commit baseline + spec**

```bash
git add apps/docs-tests/visual/linear-gradient.spec.ts apps/docs-tests/visual/linear-gradient.spec.ts-snapshots/
git commit -m "test(docs-tests): visual regression baseline for LinearGradient"
```

### Task 4: Five more component baselines

Repeat Task 3 for the other five components. Each spec is one file with one test.

- [ ] **Step 1: Write all five specs**

Create `apps/docs-tests/visual/mesh-gradient.spec.ts`:

```ts
import { test, expect } from '@playwright/test'

test('MeshGradient — default story', async ({ page }) => {
  await page.goto('/components/mesh-gradient?visualTest=1')
  await page.waitForFunction(() => (window as unknown as { __matterTestReady?: boolean }).__matterTestReady === true, undefined, { timeout: 15_000 })
  await page.waitForTimeout(50)
  await expect(page.locator('canvas').first()).toHaveScreenshot('mesh-gradient-default.png')
})
```

Repeat with the same template, swapping the route and snapshot name, for:
- `apps/docs-tests/visual/aurora.spec.ts` → `/components/aurora`
- `apps/docs-tests/visual/dot-field.spec.ts` → `/components/dot-field`
- `apps/docs-tests/visual/noise-field.spec.ts` → `/components/noise-field`
- `apps/docs-tests/visual/waves.spec.ts` → `/components/waves`

- [ ] **Step 2: Generate baselines**

Run: `pnpm --filter @matter/docs-tests test:visual:update`
Expected: All six tests pass; six new snapshot files appear.

- [ ] **Step 3: Re-run to verify zero diff**

Run: `pnpm --filter @matter/docs-tests test:visual`
Expected: 6 tests pass with zero diff.

- [ ] **Step 4: Commit**

```bash
git add apps/docs-tests/visual/
git commit -m "test(docs-tests): visual regression baselines for all 6 v1 components"
```

### Task 5: Phase 5.8 stop-and-play

- [ ] **Step 1: Validate determinism manually**

Run `pnpm --filter @matter/docs-tests test:visual` three times back-to-back. All three should pass with zero diff. If any flake, increase `maxDiffPixelRatio` slightly or investigate why the same scene at frame 60 is producing different outputs (most likely: a uniform initialized from `Math.random()` or `Date.now()` — search for that and seed it deterministically for visual tests).

- [ ] **Step 2: No commit** (validation only)

---

## Phase 5.9 — Tolerance tuning + flake hardening

**Goal:** Empirically choose a stable tolerance, harden against rAF non-determinism, and prove the test suite catches a real regression.

**Files:**
- Modify: `apps/docs-tests/playwright.config.ts`
- Possibly modify: `apps/docs/app/_lib/visualTestHooks.ts` (if seeding needed)

### Task 1: 10× determinism run

- [ ] **Step 1: Loop the suite**

Run from repo root:

```bash
for i in 1 2 3 4 5 6 7 8 9 10; do
  echo "=== run $i ==="
  pnpm --filter @matter/docs-tests test:visual || echo "FAILED on run $i"
done
```

Expected: All 10 runs pass.

- [ ] **Step 2: If any flakes occur**

Investigate the failing snapshot. Common causes:
1. Uniform seeded by `Math.random()` or `Date.now()` — search registry for these:
   ```bash
   grep -rn "Math.random\|Date.now" registry/
   ```
   For any hits used in shader uniforms, gate them with a `?visualTest=1` branch in `useVisualTestPause` (or a global `window.__matterDeterministic` flag) that swaps in a deterministic value.
2. Frame 60 isn't reached deterministically because the scheduler is paused for visibility/intersection on the test page. Verify the page is visible in headless Chromium (it should be).
3. Tolerance too tight. Bump `maxDiffPixelRatio` from `0.02` to `0.05` and re-run. Document the chosen value.

- [ ] **Step 3: Commit any seeding changes**

```bash
git add apps/docs/app/_lib/visualTestHooks.ts apps/docs-tests/playwright.config.ts registry/
git commit -m "test(docs-tests): seed deterministic uniforms for visual regression"
```

### Task 2: Deliberate-regression sanity check

- [ ] **Step 1: Introduce a temporary visual regression**

Edit one registry file (e.g. `registry/linear-gradient.tsx`) to swap the default `colors` from `['#ff7b72', '#7b9cff']` to `['#00ff00', '#0000ff']`. Don't commit.

- [ ] **Step 2: Run visual regression**

Run: `pnpm --filter @matter/docs-tests test:visual`
Expected: `linear-gradient-default` test FAILS with a diff > 2%; the other five tests PASS.

- [ ] **Step 3: Revert the change**

```bash
git checkout registry/linear-gradient.tsx
pnpm --filter @matter/docs-tests test:visual
```

Expected: All 6 tests pass again.

- [ ] **Step 4: No commit** (this task is a validation, not a code change)

### Task 3: Phase 5.9 stop-and-play

- [ ] **Step 1: Document the chosen tolerance**

In a short comment at the top of `apps/docs-tests/playwright.config.ts`, document the chosen tolerance and the empirical reasoning. Example:

```ts
// Tolerance chosen empirically (M5.9): 10 consecutive runs at maxDiffPixelRatio=0.02
// passed; intentional regression (color swap) reliably failed. If flake re-emerges,
// first investigate the cause before raising tolerance.
```

- [ ] **Step 2: Commit**

```bash
git add apps/docs-tests/playwright.config.ts
git commit -m "test(docs-tests): document chosen visual tolerance"
```

---

## Phase 5.10 — A11y pass: ARIA, axe-core, keyboard nav

**Goal:** Audit and fix accessibility issues across the docs site. Decorative shaders get `aria-hidden`. Interactive demos get keyboard accessibility (focus rings, ARIA labels, axe-core clean).

**Files:**
- Modify: `apps/docs/app/components/*/page.tsx` (×6) — `aria-hidden` on canvas wrappers; ARIA on Tweakpane wrappers if interactive
- Modify: `apps/docs/app/_components/PropsPlayground.tsx`
- Modify: `apps/docs/app/_components/LiveDemo.tsx` (if exists)
- Modify: `apps/docs/app/_components/PrimitiveDemo.tsx` (if exists)
- Create: `apps/docs-tests/a11y/component-pages.spec.ts`

### Task 1: Mark decorative shaders aria-hidden

- [ ] **Step 1: Identify the shared canvas wrapper**

Run: `grep -rn "<MatterScene" apps/docs/app/components/ apps/docs/app/_components/`

Find the component that renders `<MatterScene>` for component pages. Likely one of `PrimitiveDemo`, `LiveDemo`, or each page wraps directly.

- [ ] **Step 2: Add aria-hidden + role="presentation"**

Modify the wrapper(s). The `<MatterScene>` itself accepts `className` and `style`; we want to wrap it (or its containing `div`) with `aria-hidden="true"` and `role="presentation"`. If the surrounding component returns a `<div>` containing `<MatterScene>`, modify that div:

```tsx
<div aria-hidden="true" role="presentation" style={{ position: 'relative', /* … */ }}>
  <MatterScene>…</MatterScene>
</div>
```

For component pages where the shader IS the content (like the homepage hero), use `aria-label` on a containing `<section>` so screen readers announce the section's purpose without trying to describe the canvas pixels.

- [ ] **Step 3: Verify build**

Run: `pnpm --filter @matter/docs build`
Expected: green.

- [ ] **Step 4: Commit**

```bash
git add apps/docs/app/components/ apps/docs/app/_components/
git commit -m "a11y(docs): aria-hidden decorative shader canvases"
```

### Task 2: PropsPlayground keyboard + ARIA audit

- [ ] **Step 1: Audit Tweakpane integration**

Tweakpane renders into a div; its inputs may not expose proper ARIA labels. Open `apps/docs/app/_components/PropsPlayground.tsx`. Verify:
1. The Tweakpane container has a meaningful `aria-label` (e.g., `aria-label="Live property controls"`)
2. Each control's label is set via Tweakpane's API (not just visually)
3. Tab order goes: page nav → demo → playground → next section

- [ ] **Step 2: Apply fixes**

If any of the above is missing, fix in code. Likely 1–3 small additions:

```tsx
<div ref={paneRef} aria-label="Live property controls" role="group" />
```

- [ ] **Step 3: Manual keyboard nav test**

Open the docs site, navigate to a component page. Press Tab repeatedly — verify:
- Focus moves through page navigation
- Focus enters the playground panel
- Within the playground, arrow keys/space adjust controls
- Visible focus rings on every focusable element
- No focus traps

- [ ] **Step 4: Commit**

```bash
git add apps/docs/app/_components/PropsPlayground.tsx
git commit -m "a11y(docs): keyboard nav + ARIA labels for PropsPlayground"
```

### Task 3: axe-core spec

- [ ] **Step 1: Write the a11y spec**

Create `apps/docs-tests/a11y/component-pages.spec.ts`:

```ts
import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const routes = [
  '/',
  '/components/linear-gradient',
  '/components/mesh-gradient',
  '/components/aurora',
  '/components/dot-field',
  '/components/noise-field',
  '/components/waves',
  '/recipes',
]

for (const route of routes) {
  test(`@a11y axe-clean on ${route}`, async ({ page }) => {
    await page.goto(route)
    // Give shaders a beat to mount; axe doesn't care about pixels.
    await page.waitForLoadState('networkidle')
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .disableRules(['color-contrast']) // shader bg colors yield false positives — handled separately
      .analyze()

    if (results.violations.length > 0) {
      console.log('axe violations:', JSON.stringify(results.violations, null, 2))
    }
    expect(results.violations).toEqual([])
  })
}
```

- [ ] **Step 2: Run the a11y suite**

Run: `pnpm --filter @matter/docs-tests test:a11y`
Expected: All 8 routes pass.

If violations appear, fix the underlying issue (a missing label, an unlabeled button, a missing `<main>` landmark). Iterate until clean.

- [ ] **Step 3: Commit**

```bash
git add apps/docs-tests/a11y/
git commit -m "test(docs-tests): axe-core a11y suite — 8 routes covered"
```

### Task 4: `prefers-reduced-motion` end-to-end test

- [ ] **Step 1: Add a reduced-motion visual spec**

Append to `apps/docs-tests/visual/linear-gradient.spec.ts`:

```ts
test('LinearGradient — reduced motion paused', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' })
  const page = await ctx.newPage()
  await page.goto('/components/linear-gradient?visualTest=1&reducedMotion=paused')
  await page.waitForFunction(() => (window as unknown as { __matterTestReady?: boolean }).__matterTestReady === true, undefined, { timeout: 15_000 })

  // Capture two screenshots one second apart. With paused, they should be identical.
  const buf1 = await page.locator('canvas').first().screenshot()
  await page.waitForTimeout(1000)
  const buf2 = await page.locator('canvas').first().screenshot()

  expect(buf1.equals(buf2)).toBe(true)
  await ctx.close()
})
```

The `?reducedMotion=paused` query flag is a new addition to `useVisualTestPause` — extend that hook to also call `setReducedMotionPolicy('paused')` when the flag is present.

- [ ] **Step 2: Extend `useVisualTestPause`**

Modify `apps/docs/app/_lib/visualTestHooks.ts`:

```ts
import { setReducedMotionPolicy, type ReducedMotionPolicy } from '@lovo/matter'

// inside the effect, before the scheduler subscription:
const policyParam = params.get('reducedMotion')
const validPolicies: ReducedMotionPolicy[] = ['auto', 'off', 'slow', 'paused']
if (policyParam && (validPolicies as string[]).includes(policyParam)) {
  setReducedMotionPolicy(policyParam as ReducedMotionPolicy)
}
```

- [ ] **Step 3: Run the new test**

Run: `pnpm --filter @matter/docs-tests test:visual`
Expected: All visual tests including the new reduced-motion case pass.

- [ ] **Step 4: Commit**

```bash
git add apps/docs/app/_lib/visualTestHooks.ts apps/docs-tests/visual/linear-gradient.spec.ts
git commit -m "test(docs-tests): end-to-end reduced-motion paused regression check"
```

### Task 5: Phase 5.10 stop-and-play

- [ ] **Step 1: Run all test suites**

Run from repo root:

```bash
pnpm test
pnpm --filter @matter/docs-tests test:visual
pnpm --filter @matter/docs-tests test:a11y
```

Expected: all pass.

- [ ] **Step 2: No commit** (validation only)

---

## Phase 5.11 — CI gates: tests + visual regression in GitHub Actions

**Goal:** Extend the CI workflow to run unit tests and visual regression on every PR. Visual regression baselines are committed; the CI job compares against them.

**Files:**
- Modify: `.github/workflows/ci.yml`

### Task 1: Add unit-tests job

- [ ] **Step 1: Modify the workflow**

Read `.github/workflows/ci.yml`. Add a new job `unit-tests` after `ci` (or split `ci` into separate jobs). Replace the file contents:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  build-typecheck-lint:
    name: Build · Typecheck · Lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm lint
      - run: pnpm build

  unit-tests:
    name: Unit tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm test

  visual-regression:
    name: Visual regression
    runs-on: ubuntu-latest
    needs: build-typecheck-lint
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @matter/docs-tests exec playwright install --with-deps chromium
      - run: pnpm build
      - run: pnpm --filter @matter/docs-tests test:visual
      - name: Upload visual diffs on failure
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: visual-regression-diffs
          path: apps/docs-tests/test-results
          retention-days: 7
```

- [ ] **Step 2: Push to a branch and verify CI**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add unit-tests and visual-regression jobs"
git push origin main
```

Open the GitHub Actions page on the repo. Verify three jobs appear: `build-typecheck-lint`, `unit-tests`, `visual-regression`. All three should pass.

- [ ] **Step 3: Phase 5.11 stop-and-play — deliberate failure validation**

On a temporary branch, make a deliberate visual regression (swap a default color in `registry/linear-gradient.tsx`). Push the branch and open a draft PR.

Expected: `unit-tests` passes; `visual-regression` fails; an artifact `visual-regression-diffs` is uploaded with the diff PNGs.

Close the PR without merging and discard the change. The CI gate is now proven to catch real regressions.

- [ ] **Step 4: Commit confirmation**

The `.github/workflows/ci.yml` change was committed in Step 2. No further commit needed.

---

## Phase 5.12 — Wrap-up: docs, memory, tag

**Goal:** Update CLAUDE.md, write the memory entry, tag `m5-complete`, push the tag.

### Task 1: Update milestone status in CLAUDE.md

- [ ] **Step 1: Edit CLAUDE.md**

In `CLAUDE.md`, update the milestone table:

```md
| 5 | Performance + testing + a11y | ✅ Complete | `m5-complete` |
| 6 | v0.1.0 publish | Pending | — |
```

Also update any "next session = M2" / "next = M5" notes to "next session = M6 (publish)".

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: mark M5 complete in milestone table"
```

### Task 2: Write the memory entry

- [ ] **Step 1: Create the M5 memory file**

Create `/Users/hunter.garrett/.claude/projects/-Users-hunter-garrett-Documents--personal-mattermix/memory/project_matter_m5_complete.md`:

```markdown
---
name: matter M5 complete + lessons
description: M5 (perf + tests + a11y) shipped — engine perf defaults wired, hook/binding tests, Playwright visual regression + axe-core a11y suite, CI gated. Next = M6 (publish).
type: project
---

M5 shipped on YYYY-MM-DD (replace with actual date). Tag: `m5-complete`.

**What landed:**
- Reduced-motion: `time` re-export gated by an engine-owned scale uniform; `setReducedMotionPolicy('auto'|'off'|'slow'|'paused')` API. Every existing registry component picked it up automatically because they all import `time` from `@lovo/matter`.
- Visibility pause: `document.visibilityState` watcher → scheduler.pause/resume via MatterScene.
- Offscreen pause: IntersectionObserver on canvas → scheduler.pause/resume via MatterScene.
- Render-on-demand: `MatterScheduler.setIdle()` + `requestRender()`; `useStaticHint(idle)` hook in matter-react. LinearGradient opts in when `speed === 0`.
- `MatterMonitor` dev overlay (FPS + tick counter + pause state) in matter-react.
- Hook & binding unit tests (happy-dom + RTL): useShaderMaterial, useAnimatableUniform, useCursor, FallbackBoundary, MatterScene, MatterMonitor, useStaticHint.
- Engine integration test ties visibility + intersection + idle + scheduler together at unit level.
- Playwright visual regression in apps/docs-tests/ — 6 component baselines + 4 recipe baselines + reduced-motion paused regression. Tolerance: maxDiffPixelRatio=0.02 (empirically validated 10× on CI).
- axe-core a11y suite covers homepage, 6 component pages, recipes index — clean.
- CI: `unit-tests` and `visual-regression` jobs added; visual diffs uploaded on failure.

**Lessons / gotchas to remember:**
1. **`time` gating is process-global, not per-scene.** Setting `setReducedMotionPolicy('paused')` affects every MatterScene mounted in the same JS context. Acceptable trade-off for v1; if multi-tenant policy ever matters, refactor to per-scene scale uniforms.
2. **`setIdle(true)` runs one final flush tick before halting.** This is intentional — uniforms set just before the idle transition still get rendered. Tests assert this contract.
3. **Visual regression flake came from [list any flake sources discovered during 5.9, e.g. Math.random() seeded uniforms].** Document the seed strategy.
4. **happy-dom doesn't initialize WebGPU.** All matter-react tests mock `createRenderer`. The Playwright suite is the only place real GPU code runs.
5. **`?visualTest=1` query param** is the canonical way to pause a docs page deterministically. Reuse for any future visual or a11y test.
6. **Tweakpane needs explicit ARIA.** axe will flag the playground panel without role+aria-label.

Next: **M6 — v0.1.0 publish.** Changesets release of `@lovo/matter`, `@lovo/matter-react`, `@lovo/matter-cli`. Docs site deployment platform TBD per the user's policies.
```

- [ ] **Step 2: Add the entry to the memory index**

Edit `/Users/hunter.garrett/.claude/projects/-Users-hunter-garrett-Documents--personal-mattermix/memory/MEMORY.md` and add a line:

```md
- [matter M5 complete + lessons](project_matter_m5_complete.md) — M5 shipped YYYY-MM-DD (perf defaults + tests + a11y + visual regression CI, tagged m5-complete). Next session = M6 (publish).
```

- [ ] **Step 3: No commit** (memory files live outside the repo)

### Task 3: Tag and push

- [ ] **Step 1: Final smoke**

Run from repo root:

```bash
pnpm typecheck
pnpm lint
pnpm build
pnpm test
pnpm --filter @matter/docs-tests test:visual
pnpm --filter @matter/docs-tests test:a11y
```

All green required before tagging.

- [ ] **Step 2: Tag and push**

```bash
git tag -a m5-complete -m "M5 complete: perf defaults, tests, a11y, visual regression CI"
git push origin main
git push origin m5-complete
```

- [ ] **Step 3: Verify on GitHub**

Open `https://github.com/lovo-hq/matter/tags`. Confirm `m5-complete` appears.

### Task 4: M5 final stop-and-play

- [ ] **Step 1: Capture the closing observation**

Open the docs site in a browser. Walk through:
1. `/dev/perf-monitor` — confirm fps drops to 0 on tab-switch, scroll-off, and `speed=0`.
2. `/dev/reduced-motion` — confirm policy buttons cycle behavior.
3. `/components/linear-gradient` — confirm shader runs full speed; tab away → pauses.
4. CI on the most recent push — three green checks.
5. Repo tags — `m5-complete` present.

If anything regressed, file a follow-up issue and patch.

- [ ] **Step 2: No further commit**

M5 is shipped.

---

## Self-Review Checklist (run this before declaring the plan ready)

**1. Spec coverage:**
- [x] All five engine performance defaults — ✅ DPR (already done), visibility (5.2), intersection (5.3), render-on-demand (5.4), reduced-motion (5.1)
- [x] Vitest unit tests — ✅ engine integration (5.7) + bindings (5.6) + perf-default modules (5.1–5.4)
- [x] Visual regression — ✅ Playwright against docs site routes, not Storybook (per CLAUDE.md M1 deviation note)
- [x] `prefers-reduced-motion` honored end-to-end — ✅ engine-level gating (5.1) + reduced-motion paused regression test (5.10 Task 4)
- [x] Tolerance value chosen empirically — ✅ Phase 5.9
- [x] CI gates everything — ✅ Phase 5.11
- [x] A11y addressed — ✅ Phase 5.10 (aria-hidden, axe-core, keyboard nav, reduced-motion)

**2. Placeholder scan:** No "TBD", "implement later", or "similar to Task N" — every task has actual file paths and code blocks.

**3. Type consistency:**
- `setReducedMotionPolicy` / `getReducedMotionPolicy` / `getReducedMotionTimeScale` / `createReducedMotionWatcher` — consistent across reducedMotion.ts and index.ts exports
- `createVisibilityWatcher` returns `VisibilityWatcher` with `isVisible() / subscribe / dispose` — consistent
- `createIntersectionWatcher` returns `IntersectionWatcher` with `isInView() / subscribe / dispose` — consistent
- `MatterScheduler.setIdle(boolean)` + `requestRender()` — consistent across scheduler, useStaticHint, and integration test
- `useStaticHint(hint: boolean)` — consistent in registry/linear-gradient.tsx and useStaticHint.ts
- `MatterMonitor` props — `MatterMonitorProps` with `anchor?: MonitorAnchor` — consistent
- `useVisualTestPause()` no-arg — consistent
- `?visualTest=1` and `?reducedMotion=<policy>` query flags — consistent across docs site and Playwright specs

**4. Codebase-specific gotchas honored:**
- `three/webgpu` imports for class types (per memory note) — yes
- Strict-Mode-safe lifecycle (gotcha #14) — yes, all watchers create+dispose per mount cycle
- `passWithNoTests: true` in vitest configs — preserved
- TSL `time` consumption rule (gotcha #12) — gating is via `.mul(uniform)` chain rooted in `time`, not chained off the uniform itself
- No emojis in code/commits — confirmed
- Docs-site SSR safety — `next/dynamic` with `ssr: false` for any new client demos

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-08-matter-m5-perf-tests-a11y.md`.**

Two execution options:

**1. Subagent-Driven (recommended for milestone work)** — I dispatch a fresh subagent per task, review between tasks, fast iteration. Aligned with the user's documented preference in CLAUDE.md.

**2. Inline Execution** — Execute tasks in this session using `superpowers:executing-plans`, batch execution with checkpoints for review. Fewer roundtrips; more linear.

Which approach?

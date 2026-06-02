# API Vocabulary Rename Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Matter-prefixed symbols in the public API with domain-accurate names (`ShaderScene`, `FrameScheduler`, etc.) while keeping one-release deprecated aliases so existing users aren't broken mid-air.

**Architecture:** In-place symbol renames in the four layers that carry the old names (engine, React binding, registry, docs/playground). The `@lovo/matter` package and `matter-cli` brand names are **not** changed — only TypeScript exports and their usages change. Deprecated aliases (`export { FrameScheduler as MatterScheduler }`) ship in the same release so runtime and type consumers can migrate on their own schedule; aliases are removed no earlier than 0.5.0.

**Tech Stack:** TypeScript 5 strict, pnpm 9 workspaces, tsup (build), Vitest 4, `@changesets/cli` (version + changelog).

---

## Rename table (locked)

| Old name | New name | Location |
|---|---|---|
| `MatterScheduler` | `FrameScheduler` | `packages/matter/src/runtime/MatterScheduler.ts` |
| `MatterRenderer` | `GpuRenderer` | `packages/matter/src/runtime/createRenderer.ts` |
| `MatterBackend` | `GpuBackend` | `packages/matter/src/runtime/createRenderer.ts` |
| `MatterScene` | `ShaderScene` | `packages/matter-react/src/components/matter-scene/matter-scene.tsx` |
| `MatterSceneProps` | `ShaderSceneProps` | same |
| `MatterContext` | `ShaderContext` | `packages/matter-react/src/context/matter-context.ts` |
| `MatterContextValue` | `ShaderContextValue` | same |
| `useMatterContext` | `useShaderContext` | `packages/matter-react/src/hooks/use-matter-context/use-matter-context.ts` |
| `MatterMonitor` | `ShaderMonitor` | `packages/matter-react/src/components/matter-monitor/matter-monitor.tsx` |
| `MatterMonitorProps` | `ShaderMonitorProps` | same |
| `MatterSignal` | `AnimatableSignal` | `packages/matter-react/src/hooks/use-animatable-uniform/use-animatable-uniform.ts` |

Unchanged: `createRenderer`, `SchedulerTick`, `SchedulerClient`, `AnimatableProp`, `useShaderMaterial`, `useOverlayPass`, `OverlayTransform`, `FallbackBoundary`, signal types (`CursorSignal`, `ScrollSignal`, `ResizeSignal`), `MatterConfig` (CLI brand config), npm package names, CLI binary name.

---

## Task 1: Engine package — `FrameScheduler`, `GpuRenderer`, `GpuBackend`

**Files:**
- Modify: `packages/matter/src/runtime/MatterScheduler.ts`
- Modify: `packages/matter/src/runtime/createRenderer.ts`
- Modify: `packages/matter/src/index.ts`
- Modify: `packages/matter/src/runtime/MatterScheduler.test.ts`
- Modify: `packages/matter/src/runtime/runtime-integration.test.ts`

- [ ] **Step 1: Rename the class and add deprecated alias in `MatterScheduler.ts`**

The exported class name changes to `FrameScheduler`. A deprecated `MatterScheduler` alias is added at the bottom so JS consumers that import the old name at runtime still get a working value.

Replace the `export class MatterScheduler` declaration with `export class FrameScheduler`, then append the alias at the end of the file:

```ts
// bottom of packages/matter/src/runtime/MatterScheduler.ts
// (all existing method bodies remain exactly as they are)

/** @deprecated Use FrameScheduler — alias removed in 0.5.0 */
export { FrameScheduler as MatterScheduler }
```

The file still lives at `MatterScheduler.ts`; no file rename needed.

- [ ] **Step 2: Rename the types in `createRenderer.ts`**

Rename `MatterBackend` → `GpuBackend` and `MatterRenderer` → `GpuRenderer` throughout the file. All usages inside the file (parameter types, return types) update automatically. Append deprecated type aliases at the end:

```ts
// bottom of packages/matter/src/runtime/createRenderer.ts

/** @deprecated Use GpuBackend — alias removed in 0.5.0 */
export type MatterBackend = GpuBackend
/** @deprecated Use GpuRenderer — alias removed in 0.5.0 */
export type MatterRenderer = GpuRenderer
```

- [ ] **Step 3: Update `packages/matter/src/index.ts` exports**

Replace the current `MatterScheduler` and renderer exports with the new primary names; the deprecated aliases in the source files will be re-exported automatically by the wildcard or need explicit re-export. Keep it explicit:

```ts
// packages/matter/src/index.ts  (full file — replace existing)
// @lovo/matter — engine package public API.

export { createRenderer } from './runtime/createRenderer.js'
export type {
  GpuRenderer,
  GpuBackend,
  CreateRendererOptions,
  // deprecated aliases
  MatterRenderer,
  MatterBackend,
} from './runtime/createRenderer.js'

export { FrameScheduler, MatterScheduler } from './runtime/MatterScheduler.js'
export type { SchedulerTick, SchedulerClient } from './runtime/MatterScheduler.js'

export { CursorInput } from './inputs/CursorInput.js'
export type { CursorInputOptions, Vec2 } from './inputs/CursorInput.js'

export { colorRamp } from './primitives/colorRamp.js'
export type { ColorRampStop, TSLNode } from './primitives/colorRamp.js'

export { noise } from './primitives/noise.js'

export { fbm } from './primitives/fbm.js'
export type { FBMOptions } from './primitives/fbm.js'

export { voronoi } from './primitives/voronoi.js'

export { quantize } from './primitives/quantize.js'

export { sdfCircle } from './primitives/sdfCircle.js'

export { displace } from './primitives/displace.js'

export { cursorRipple } from './primitives/cursorRipple.js'
export type { CursorRippleOptions } from './primitives/cursorRipple.js'

export { time } from './primitives/time.js'

export { filmGrain } from './primitives/filmGrain.js'

export {
  setReducedMotionPolicy,
  getReducedMotionPolicy,
  getReducedMotionTimeScale,
  createReducedMotionWatcher,
} from './runtime/reducedMotion.js'
export type { ReducedMotionPolicy, ReducedMotionWatcher } from './runtime/reducedMotion.js'

export { createVisibilityWatcher } from './runtime/visibility.js'
export type { VisibilityWatcher } from './runtime/visibility.js'

export { createIntersectionWatcher } from './runtime/intersection.js'
export type { IntersectionWatcher } from './runtime/intersection.js'
```

- [ ] **Step 4: Update `MatterScheduler.test.ts` to import `FrameScheduler`**

```ts
// packages/matter/src/runtime/MatterScheduler.test.ts — change the import line
import { FrameScheduler } from './MatterScheduler.js'
```

Then replace every occurrence of `new MatterScheduler()` with `new FrameScheduler()` and every `MatterScheduler` type annotation with `FrameScheduler` in that file. All test logic stays identical.

- [ ] **Step 5: Update `runtime-integration.test.ts`**

```ts
// packages/matter/src/runtime/runtime-integration.test.ts — change the import
import { FrameScheduler } from './MatterScheduler.js'
```

Replace `new MatterScheduler()` → `new FrameScheduler()` throughout the file.

- [ ] **Step 6: Run engine tests and build**

```bash
pnpm --filter @lovo/matter test
pnpm --filter @lovo/matter build
```

Expected: all tests pass, build produces `dist/`.

- [ ] **Step 7: Commit**

```bash
git add packages/matter/src/runtime/MatterScheduler.ts \
        packages/matter/src/runtime/createRenderer.ts \
        packages/matter/src/index.ts \
        packages/matter/src/runtime/MatterScheduler.test.ts \
        packages/matter/src/runtime/runtime-integration.test.ts
git commit -m "feat(matter): rename MatterScheduler→FrameScheduler, MatterRenderer→GpuRenderer; add deprecated aliases"
```

---

## Task 2: React binding — `ShaderScene`, `ShaderContext`, `useShaderContext`, `ShaderMonitor`, `AnimatableSignal`

**Files:**
- Modify: `packages/matter-react/src/context/matter-context.ts`
- Modify: `packages/matter-react/src/components/matter-scene/matter-scene.tsx`
- Modify: `packages/matter-react/src/components/matter-monitor/matter-monitor.tsx`
- Modify: `packages/matter-react/src/hooks/use-matter-context/use-matter-context.ts`
- Modify: `packages/matter-react/src/hooks/use-animatable-uniform/use-animatable-uniform.ts`
- Modify: `packages/matter-react/src/hooks/use-static-hint/use-static-hint.ts`
- Modify: `packages/matter-react/src/hooks/use-resize/use-resize.ts`
- Modify: `packages/matter-react/src/hooks/use-cursor/use-cursor.ts`
- Modify: `packages/matter-react/src/hooks/use-overlay-pass/use-overlay-pass.ts`
- Modify: `packages/matter-react/src/components/index.ts`
- Modify: `packages/matter-react/src/hooks/index.ts`
- Modify: `packages/matter-react/src/index.ts`
- Modify: `packages/matter-react/src/components/matter-scene/matter-scene.test.tsx`
- Modify: `packages/matter-react/src/components/matter-monitor/matter-monitor.test.tsx`
- Modify: `packages/matter-react/src/hooks/use-overlay-pass/use-overlay-pass.test.tsx`
- Modify: `packages/matter-react/src/hooks/use-static-hint/use-static-hint.test.tsx`

- [ ] **Step 1: Rename context types in `matter-context.ts`**

```ts
// packages/matter-react/src/context/matter-context.ts  (full file)
import type { FrameScheduler, GpuRenderer } from '@lovo/matter'
import { createContext } from 'react'
import type { Camera, Scene } from 'three'
import type { ShaderNodeObject } from 'three/tsl'
import type { Node } from 'three/webgpu'

export type OverlayTransform = (input: ShaderNodeObject<Node>) => ShaderNodeObject<Node>

export interface ShaderContextValue {
  renderer: GpuRenderer
  scene: Scene
  camera: Camera
  scheduler: FrameScheduler
  registerOverlay: (transform: OverlayTransform) => () => void
}

export const ShaderContext = createContext<ShaderContextValue | null>(null)

/** @deprecated Use ShaderContextValue — alias removed in 0.5.0 */
export type MatterContextValue = ShaderContextValue
/** @deprecated Use ShaderContext — alias removed in 0.5.0 */
export const MatterContext = ShaderContext
```

- [ ] **Step 2: Rename `MatterScene` → `ShaderScene` in `matter-scene.tsx`**

Update the import at the top (use `FrameScheduler` and the renamed context):

```ts
// packages/matter-react/src/components/matter-scene/matter-scene.tsx
// change lines 1-20 to:
'use client'

import {
  createIntersectionWatcher,
  createRenderer,
  createVisibilityWatcher,
  FrameScheduler,
} from '@lovo/matter'
import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from 'react'
import { OrthographicCamera, Scene } from 'three'
import { pass } from 'three/tsl'
import type { ShaderNodeObject } from 'three/tsl'
import { PostProcessing } from 'three/webgpu'
import type { Node } from 'three/webgpu'

import {
  ShaderContext,
  type ShaderContextValue,
  type OverlayTransform,
} from '../../context/matter-context.js'
```

Rename the props interface and component:

```ts
export interface ShaderSceneProps {
  children?: ReactNode
  fallback?: ReactNode
  className?: string
  style?: CSSProperties
  maxDPR?: number
}
```

```ts
export function ShaderScene(props: ShaderSceneProps) {
```

Inside the function body, replace:
- `new MatterScheduler()` → `new FrameScheduler()`
- `MatterContextValue` → `ShaderContextValue`
- `<MatterContext.Provider value={ctx}>` → `<ShaderContext.Provider value={ctx}>`
- The error string `'[MatterScene] renderer init failed:'` → `'[ShaderScene] renderer init failed:'`
- The error display text `MatterScene init failed:` → `ShaderScene init failed:`

At the end of the file, add the deprecated alias:

```ts
/** @deprecated Use ShaderScene — alias removed in 0.5.0 */
export const MatterScene = ShaderScene
/** @deprecated Use ShaderSceneProps — alias removed in 0.5.0 */
export type MatterSceneProps = ShaderSceneProps
```

- [ ] **Step 3: Rename `MatterMonitor` → `ShaderMonitor` in `matter-monitor.tsx`**

Update the context import:

```ts
import { ShaderContext } from '../../context/matter-context.js'
```

Rename the props interface and component function (keep `data-testid` strings unchanged — test IDs are stable):

```ts
export interface ShaderMonitorProps {
  anchor?: MonitorAnchor
}

export function ShaderMonitor({ anchor = 'top-right' }: ShaderMonitorProps) {
  const ctx = useContext(ShaderContext)
  // ... rest of body unchanged ...
}
```

The JSX `data-testid="matter-monitor"` strings stay as-is (they're not part of the public TS API and tests depend on them).

Append deprecated aliases:

```ts
/** @deprecated Use ShaderMonitor — alias removed in 0.5.0 */
export const MatterMonitor = ShaderMonitor
/** @deprecated Use ShaderMonitorProps — alias removed in 0.5.0 */
export type MatterMonitorProps = ShaderMonitorProps
```

- [ ] **Step 4: Rename `useMatterContext` → `useShaderContext` in `use-matter-context.ts`**

```ts
// packages/matter-react/src/hooks/use-matter-context/use-matter-context.ts  (full file)
import { useContext } from 'react'

import { ShaderContext, type ShaderContextValue } from '../../context/matter-context.js'

/**
 * Read the shader scene context. Returns null when called outside a
 * <ShaderScene>; useShaderMaterial and similar hooks check this.
 */
export function useShaderContext(): ShaderContextValue | null {
  return useContext(ShaderContext)
}

/** @deprecated Use useShaderContext — alias removed in 0.5.0 */
export const useMatterContext = useShaderContext
```

- [ ] **Step 5: Rename `MatterSignal` → `AnimatableSignal` in `use-animatable-uniform.ts`**

Change the interface name on line 8:

```ts
export interface AnimatableSignal<T> {
  get(): T
  on(event: 'change', cb: (value: T) => void): () => void
}

export type AnimatableProp<T> = T | AnimatableSignal<T>
```

Update the `isSignal` guard's type predicate:

```ts
const isSignal = <T>(value: AnimatableProp<T>): value is AnimatableSignal<T> => {
```

Append the deprecated alias at the end of the file:

```ts
/** @deprecated Use AnimatableSignal — alias removed in 0.5.0 */
export type MatterSignal<T> = AnimatableSignal<T>
```

- [ ] **Step 6: Update the four internal hooks that call `useMatterContext`**

In each of the four files below, change the import line from `useMatterContext` to `useShaderContext` and update the call site:

**`use-static-hint.ts`** — change line 5:
```ts
import { useShaderContext } from '../use-matter-context/use-matter-context.js'
```
Change line 19: `const ctx = useShaderContext()`

**`use-resize.ts`** — same import pattern, change `useMatterContext()` → `useShaderContext()`

**`use-cursor.ts`** — same

**`use-overlay-pass.ts`** — change import:
```ts
import type { OverlayTransform } from '../../context/matter-context.js'
import { useShaderContext } from '../use-matter-context/use-matter-context.js'
```
Change line 24: `const ctx = useShaderContext()`

- [ ] **Step 7: Update `components/index.ts`**

```ts
// packages/matter-react/src/components/index.ts  (full file)
export { FallbackBoundary } from './fallback-boundary/fallback-boundary.js'
export type { FallbackBoundaryProps } from './fallback-boundary/fallback-boundary.js'

export { ShaderMonitor, MatterMonitor } from './matter-monitor/matter-monitor.js'
export type { ShaderMonitorProps, MonitorAnchor, MatterMonitorProps } from './matter-monitor/matter-monitor.js'

export { ShaderScene, MatterScene } from './matter-scene/matter-scene.js'
export type { ShaderSceneProps, MatterSceneProps } from './matter-scene/matter-scene.js'
```

- [ ] **Step 8: Update `hooks/index.ts`**

```ts
// packages/matter-react/src/hooks/index.ts  (full file)
export { useAnimatableUniform } from './use-animatable-uniform/use-animatable-uniform.js'
export type {
  AnimatableProp,
  AnimatableSignal,
  // deprecated
  MatterSignal,
} from './use-animatable-uniform/use-animatable-uniform.js'

export { useCursor } from './use-cursor/use-cursor.js'
export type { CursorSignal } from './use-cursor/use-cursor.js'

export { useShaderContext, useMatterContext } from './use-matter-context/use-matter-context.js'

export { useOverlayPass } from './use-overlay-pass/use-overlay-pass.js'

export { useResize } from './use-resize/use-resize.js'
export type { ResizeSignal, ResizeValue } from './use-resize/use-resize.js'

export { useScroll } from './use-scroll/use-scroll.js'
export type { ScrollSignal, ScrollValue } from './use-scroll/use-scroll.js'

export { useShaderMaterial } from './use-shader-material/use-shader-material.js'

export { useStaticHint } from './use-static-hint/use-static-hint.js'
```

- [ ] **Step 9: Update `index.ts` (package root)**

```ts
// packages/matter-react/src/index.ts  (full file)
// @lovo/matter-react — React binding for Matter.

export * from './components/index.js'
export * from './hooks/index.js'

export type {
  ShaderContextValue,
  OverlayTransform,
  // deprecated
  MatterContextValue,
} from './context/matter-context.js'
```

- [ ] **Step 10: Update `matter-scene.test.tsx`**

Change the import and every reference inside the test file:

```ts
import { ShaderScene } from './matter-scene.js'
```

Replace `<MatterScene` → `<ShaderScene`, `MatterScene` type references → `ShaderScene`. The mock comment that says `MatterScheduler` can stay as a comment — it's not a type reference. The `vi.mock('@lovo/matter', ...)` body doesn't need changes since it mocks `createRenderer`, not the scheduler.

Also update the describe block title: `describe('ShaderScene', () => {`

- [ ] **Step 11: Update `matter-monitor.test.tsx`**

```ts
import { FrameScheduler } from '@lovo/matter'
// ...
import { ShaderContext } from '../../context/matter-context.js'
import { ShaderMonitor } from './matter-monitor.js'
```

Replace:
- `MatterScheduler` → `FrameScheduler`
- `MatterContext` → `ShaderContext`
- `MatterMonitor` → `ShaderMonitor` (function call and `describe` title)

- [ ] **Step 12: Update `use-overlay-pass.test.tsx`**

```ts
import {
  ShaderContext,
  type ShaderContextValue,
  type OverlayTransform,
} from '../../context/matter-context.js'
```

Replace every `MatterContext` → `ShaderContext`, `MatterContextValue` → `ShaderContextValue`. The `makeCtx()` helper's fields (`renderer`, `scene`, `camera`, `scheduler`) don't change names.

- [ ] **Step 13: Update `use-static-hint.test.tsx`**

Check the file for any `MatterContext` / `useMatterContext` references. If present, update to `ShaderContext` / `useShaderContext`.

- [ ] **Step 14: Run React binding tests and build**

```bash
pnpm --filter @lovo/matter-react test
pnpm --filter @lovo/matter-react build
```

Expected: all tests pass, `dist/` builds cleanly.

- [ ] **Step 15: Commit**

```bash
git add packages/matter-react/src/
git commit -m "feat(matter-react): rename MatterScene→ShaderScene, MatterContext→ShaderContext, useMatterContext→useShaderContext, MatterMonitor→ShaderMonitor, MatterSignal→AnimatableSignal; add deprecated aliases"
```

---

## Task 3: Registry — update six component files

All six registry components import `useMatterContext`. Replace with `useShaderContext`. No other public-API change is needed in these files (they don't export `MatterScene` — they live inside one).

**Files:**
- Modify: `registry/linear-gradient.tsx`
- Modify: `registry/waves.tsx`
- Modify: `registry/noise-field.tsx`
- Modify: `registry/dot-field.tsx`
- Modify: `registry/aurora/shader.tsx`
- Modify: `registry/mesh-gradient/shader.tsx`

- [ ] **Step 1: Replace `useMatterContext` with `useShaderContext` in all six files**

In each file, change the named import:

```ts
// before
import {
  useMatterContext,
  // ...other imports...
} from '@lovo/matter-react'

// after
import {
  useShaderContext,
  // ...other imports...
} from '@lovo/matter-react'
```

And change the call site from `useMatterContext()` → `useShaderContext()`.

The variable name can stay `ctx` — only the hook name changes.

- [ ] **Step 2: Verify the docs dev server still loads**

```bash
pnpm --filter @lovo/matter-react build
pnpm --filter docs dev
```

Open http://localhost:3000/components/linear-gradient in a browser. Confirm the gradient renders. This is the visual gate — if the component mounts and renders the canvas, the hook plumbing is wired correctly.

- [ ] **Step 3: Commit**

```bash
git add registry/
git commit -m "fix(registry): use useShaderContext instead of useMatterContext in all component templates"
```

---

## Task 4: Docs site and playground

**Files (docs — 20 files):**
- `apps/docs/src/components/LiveDemo.tsx`
- `apps/docs/src/components/RecipeScene.tsx`
- `apps/docs/src/components/RecipeViewer.tsx`
- `apps/docs/src/components/PrimitiveScene.tsx`
- `apps/docs/src/components/PrimitiveDemo.tsx`
- `apps/docs/src/lib/VisualTestPause.tsx`
- `apps/docs/src/lib/visualTestHooks.ts`
- `apps/docs/src/app/dev/perf-monitor/PerfMonitorDemo.tsx`
- `apps/docs/src/app/dev/offscreen-pause/OffscreenPauseDemo.tsx`
- `apps/docs/src/app/dev/overlay-test/page.tsx`
- `apps/docs/src/app/dev/fbm-playground/FbmScene.tsx`
- `apps/docs/src/app/dev/reduced-motion/ReducedMotionDemo.tsx`
- `apps/docs/src/app/components/linear-gradient/PageBody.tsx`
- `apps/docs/src/app/components/aurora/page.tsx`
- `apps/docs/src/app/components/mesh-gradient/page.tsx`
- `apps/docs/src/app/components/dot-field/page.tsx`
- `apps/docs/src/app/components/noise-field/page.tsx`
- `apps/docs/src/app/components/waves/page.tsx`
- `apps/docs/src/app/components/film-grain/page.tsx`
- `apps/docs/src/app/components/vignette/page.tsx`

**Files (playground — 2 files):**
- `apps/playground/src/3-scheduler.ts`
- `apps/playground/src/4-react-scene.tsx`

- [ ] **Step 1: Update docs files — apply the rename table mechanically**

For each file in the docs list, apply these substitutions:

| Find | Replace |
|---|---|
| `import { MatterScene` | `import { ShaderScene` |
| `import { MatterMonitor` | `import { ShaderMonitor` |
| `import { MatterScheduler` | `import { FrameScheduler` |
| `import { useMatterContext` | `import { useShaderContext` |
| `import type { MatterContextValue` | `import type { ShaderContextValue` |
| `import type { MatterRenderer` | `import type { GpuRenderer` |
| `<MatterScene` | `<ShaderScene` |
| `</MatterScene>` | `</ShaderScene>` |
| `<MatterMonitor` | `<ShaderMonitor` |
| `new MatterScheduler()` | `new FrameScheduler()` |
| `MatterScheduler` (type annotation) | `FrameScheduler` |
| `useMatterContext()` | `useShaderContext()` |
| `MatterContextValue` (type) | `ShaderContextValue` |
| `MatterRenderer` (type) | `GpuRenderer` |

Props docs strings in MDX/component description text (e.g., `"Uses <MatterScene>"` in a prose paragraph) can be left as-is for now — prose is updated in Task 5.

- [ ] **Step 2: Update playground files**

**`apps/playground/src/3-scheduler.ts`** — change the import:

```ts
import { createRenderer, FrameScheduler } from '@lovo/matter'
```

Replace `new MatterScheduler()` → `new FrameScheduler()`.

**`apps/playground/src/4-react-scene.tsx`** — change the import:

```ts
import { ShaderScene, useShaderContext } from '@lovo/matter-react'
```

Replace `<MatterScene>` / `</MatterScene>` and `useMatterContext()` call.

- [ ] **Step 3: Build docs and smoke-check**

```bash
pnpm --filter docs build
```

Expected: Next.js static build completes with no TypeScript errors. If any type errors appear, they will be from missed rename sites — fix them before committing.

- [ ] **Step 4: Commit**

```bash
git add apps/docs/ apps/playground/
git commit -m "fix(docs): use ShaderScene, ShaderMonitor, FrameScheduler, useShaderContext throughout"
```

---

## Task 5: Changeset, README, and CLAUDE.md

**Files:**
- Create: `.changeset/<auto-named>.md` (via `pnpm changeset`)
- Modify: `packages/matter/README.md`
- Modify: `packages/matter-react/README.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Create a changeset**

```bash
pnpm changeset
```

In the interactive prompt:
- Select `@lovo/matter` as a **minor** change (new exports `FrameScheduler`, `GpuRenderer`, `GpuBackend`)
- Select `@lovo/matter-react` as a **minor** change (new exports `ShaderScene`, `ShaderContext`, etc.)
- Leave `@lovo/matter-cli` unchanged

Changeset summary to paste when prompted:

```
Rename public API symbols to domain-accurate names.

New primary names: FrameScheduler, GpuRenderer, GpuBackend (engine); ShaderScene, ShaderSceneProps, ShaderContext, ShaderContextValue, useShaderContext, ShaderMonitor, ShaderMonitorProps, AnimatableSignal (React binding).

Old names (MatterScheduler, MatterRenderer, MatterScene, MatterContext, MatterContextValue, useMatterContext, MatterMonitor, MatterSignal, MatterBackend) are deprecated with @deprecated JSDoc and continue to work. They will be removed no earlier than 0.5.0.

Migration: replace old names with new ones in your imports and JSX. A one-pass find-and-replace is sufficient — no behavioral changes.
```

- [ ] **Step 2: Update `packages/matter/README.md`**

In the usage examples, replace `MatterScheduler` → `FrameScheduler`. Add a brief Migration note at the bottom:

```md
## Migration from 0.3.x

`MatterScheduler`, `MatterRenderer`, and `MatterBackend` have been renamed to `FrameScheduler`, `GpuRenderer`, and `GpuBackend`. The old names are deprecated and still work — remove them at your leisure before 0.5.0.
```

- [ ] **Step 3: Update `packages/matter-react/README.md`**

Replace `MatterScene` → `ShaderScene`, `useMatterContext` → `useShaderContext`, `MatterMonitor` → `ShaderMonitor` in all code examples and prose. Add the same migration note.

- [ ] **Step 4: Update CLAUDE.md**

In the "Gotchas to remember" section (gotcha #9 and any other inline symbol names), replace the old API names with the new primary names. This ensures future sessions use the right names without confusion.

Specifically update any `MatterScene`/`MatterScheduler` references in examples to `ShaderScene`/`FrameScheduler`.

- [ ] **Step 5: Full monorepo build + test**

```bash
pnpm build
pnpm typecheck
pnpm test
```

Expected:
- `pnpm build` exits 0, all three packages emit `dist/`
- `pnpm typecheck` exits 0, no TS errors anywhere
- `pnpm test` exits 0, all suites pass

If any failures appear, fix them before committing.

- [ ] **Step 6: Final commit**

```bash
git add .changeset/ packages/matter/README.md packages/matter-react/README.md CLAUDE.md
git commit -m "docs: add changeset for 0.4.0 API rename + update READMEs and CLAUDE.md"
```

---

## Self-review

**Spec coverage:**
- ✅ Every symbol in the rename table has a task + step
- ✅ Deprecated aliases added for every renamed symbol so runtime compat is preserved
- ✅ All import sites updated: engine tests, React tests, registry (6 files), docs (20 files), playground (2 files)
- ✅ Changeset targets both packages as minor
- ✅ Docs and CLAUDE.md updated so future sessions start clean

**Placeholder scan:** No "TBD" or "implement later" entries. Every step shows the exact code or command.

**Type consistency:**
- `ShaderContextValue` is defined in Task 2 Step 1 and used in `matter-scene.tsx` (Task 2 Step 2) and `index.ts` (Task 2 Step 9) — consistent.
- `FrameScheduler` is defined in Task 1 Step 1 and imported by `matter-context.ts` (Task 2 Step 1) and `matter-scene.tsx` (Task 2 Step 2) — consistent.
- `AnimatableSignal` is defined in Task 2 Step 5 and re-exported in `hooks/index.ts` (Task 2 Step 8) — consistent.

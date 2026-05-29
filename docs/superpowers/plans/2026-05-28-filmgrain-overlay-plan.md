# FilmGrain + Overlay Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Matter's overlay-component category architecture (three/webgpu PostProcessing + `useOverlayPass` hook) plus the first two overlays, `<FilmGrain>` and `<Vignette>`, while removing MeshGradient's bundled grain in favor of the standalone overlay.

**Architecture:** Replace `MatterScene`'s direct `renderer.render(scene, camera)` call with a `PostProcessing` pipeline whose `outputNode` starts at `pass(scene, camera)`. Overlay components register a TSL transform `(input) => modifiedInput` via a new `registerOverlay` method on `MatterContext`; a new `useOverlayPass(transform, deps)` hook in `@lovo/matter-react` wraps registration with `useEffect` semantics. Six phases, each ending at a runnable, observable stop-and-play beat. Branch: `hunter/mat-16-standalone-filmgrain-component`. Design spec: `docs/superpowers/specs/2026-05-28-filmgrain-overlay-design.md`.

**Tech Stack:** TypeScript 5 strict, three 0.170+ (`three/webgpu` `PostProcessing`, `three/tsl` `pass`, `uv`, `vec2`, `vec4`, `mix`, `smoothstep`, `length`, `floor`, `sin`, `cos`, `uniform`), `@lovo/matter` (already-shipped `filmGrain` primitive, `time`), `@lovo/matter-react` (`useMatterContext`, `useAnimatableUniform`, `useResize`, new `useOverlayPass`), Vitest 4 (under `vite-plus/test`), Tweakpane 4 (docs playgrounds), Playwright (visual baselines regenerated in Phase 6).

**Critical user preferences to respect:**
- **Shader co-write:** for shader files in the `registry/` folder, the user writes the TSL code chunk-by-chunk. Tasks that touch `registry/film-grain/shader.tsx`, `registry/vignette/shader.tsx`, and the shader edit in `registry/mesh-gradient/shader.tsx` must DESCRIBE what to write and explain the TSL concepts, but must NOT call `Edit` or `Write` on those files. The user will run the dev server, paste/type each chunk, and react.
- **Phase gates:** after each phase, stop, summarize the diff in conversation, explain any new TSL concepts, and wait for the user to run the dev server and react. Do NOT plow into the next phase.
- **vp surface:** prefer `vp` commands (`vp run dev:docs`, `vp test`, `vp lint`) over their pnpm equivalents when both work.
- **Destructure props at the function signature** (never `props.X` access in component bodies).
- **No Claude attribution** in commit messages or PRs.

---

## File Structure

**Created:**
- `packages/matter-react/src/useOverlayPass.ts` — new public hook.
- `packages/matter-react/src/useOverlayPass.test.tsx` — Vitest tests for the hook.
- `apps/docs/src/app/dev/overlay-test/page.tsx` — dev-only validation page for the pipeline.
- `apps/docs/src/app/dev/overlay-test/TintOverlay.tsx` — dev-only component, not exported.
- `registry/film-grain/film-grain.tsx` — thin wrapper with default props.
- `registry/film-grain/shader.tsx` — shader/uniform plumbing (user-written).
- `apps/docs/src/app/components/film-grain/page.tsx` — Tweakpane playground.
- `registry/vignette/vignette.tsx` — thin wrapper with default props.
- `registry/vignette/shader.tsx` — shader/uniform plumbing (user-written).
- `apps/docs/src/app/components/vignette/page.tsx` — Tweakpane playground.
- `.changeset/<random>.md` — minor bumps for `@lovo/matter-react` and `@matter/registry`.

**Modified:**
- `packages/matter-react/src/matter-context.ts` — add `registerOverlay` to context value.
- `packages/matter-react/src/MatterScene.tsx` — swap to `PostProcessing`, manage overlay registry.
- `packages/matter-react/src/MatterScene.test.tsx` — extend mock to support PostProcessing, assert registration behavior.
- `packages/matter-react/src/index.ts` — export `useOverlayPass`, `OverlayTransform` type.
- `registry/package.json` — add `./film-grain` and `./vignette` exports.
- `registry/registry.json` — add `film-grain` and `vignette` entries.
- `registry/mesh-gradient/shader.tsx` — remove `grain`, `grainSpeed`, and the `filmGrain` call (user-edited).
- `registry/mesh-gradient/mesh-gradient.tsx` — remove `grain` and `grainSpeed` props (user-edited).
- `apps/docs/src/app/components/mesh-gradient/page.tsx` — move grain Tweakpane controls into a labeled `<FilmGrain>` overlay section.
- `apps/docs-tests/visual/*-snapshots/*.png` — re-baseline every page after Phase 5.
- `docs/superpowers/ideas-backlog.md` — mark `<FilmGrain>` entry as shipped.

**Deleted:**
- None (existing snapshot PNGs get re-baselined, not deleted).

---

## Phase 1 — MatterScene → PostProcessing swap (invisible-by-design)

**Stop-and-play beat at phase end:** open every existing docs page (Aurora, LinearGradient, NoiseField, DotField, Waves, MeshGradient). Each should render identically to today. The user feels: "pipeline swapped under the hood, nothing visible changed."

**Learning beat:** what `pass(scene, camera)` is — a TSL node that evaluates to the rendered scene as a texture sample. Why post-process always-on costs ~one fullscreen quad per frame (negligible).

### Task 1.1: Swap MatterScene's render call to PostProcessing

**Files:**
- Modify: `packages/matter-react/src/MatterScene.tsx`

- [ ] **Step 1: Read the current implementation**

Read `packages/matter-react/src/MatterScene.tsx` end to end. Note the structure:
- `createRenderer` returns a `MatterRenderer` whose `.three` field is the underlying `WebGPURenderer`.
- The scheduler is given a single callback: `() => renderer.three.render(scene, camera)`.
- On cleanup, `renderer.dispose()` is called.

- [ ] **Step 2: Add PostProcessing instantiation alongside the renderer**

In the imports block at the top, add:

```ts
import { PostProcessing } from 'three/webgpu'
import { pass } from 'three/tsl'
```

In the `setup` async function, immediately after `const renderer = await createRenderer(canvas, { maxDPR })` and the cancellation check, before `const scene = new Scene()`, plan to construct PostProcessing once `scene` and `camera` exist. After the existing line:

```ts
const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 10)
camera.position.z = 1
```

add:

```ts
const postProcessing = new PostProcessing(renderer.three)
postProcessing.outputNode = pass(scene, camera)
```

- [ ] **Step 3: Replace the render call**

Change this line:

```ts
scheduler.add(() => renderer.three.render(scene, camera))
```

to:

```ts
scheduler.add(() => postProcessing.render())
```

- [ ] **Step 4: Confirm no extra disposal needed**

`PostProcessing` does not expose an explicit `dispose()` method (see `node_modules/.pnpm/three@0.170.0/node_modules/three/src/renderers/common/PostProcessing.js`). Its internal `_quadMesh` and `_material` are module-level singletons and get GC'd with the surrounding scene. No additional cleanup beyond the existing `renderer.dispose()` is required. Leave the cleanup block unchanged.

- [ ] **Step 5: Typecheck the package**

Run: `pnpm --filter @lovo/matter-react typecheck`
Expected: PASS, no errors.

- [ ] **Step 6: Run the existing test suite**

Run: `pnpm --filter @lovo/matter-react test`
Expected: 3 existing MatterScene tests still pass. (The `createRenderer` mock returns a `three` object with a `render` method we no longer call; PostProcessing also takes the renderer and reads `toneMapping`/`outputColorSpace`. The mock's `three` may need additional fields — see Task 1.2 if tests fail.)

- [ ] **Step 7: If the test failed because the renderer mock lacks fields PostProcessing reads, jump to Task 1.2**

If tests pass, skip to Step 8.

- [ ] **Step 8: Commit**

```bash
git add packages/matter-react/src/MatterScene.tsx
git commit -m "feat(matter-react): swap MatterScene to three/webgpu PostProcessing pipeline (MAT-16 phase 1)

Replaces the single renderer.render(scene, camera) call with a
PostProcessing instance whose outputNode starts at pass(scene, camera).
No public API change yet — overlay registration arrives in phase 2.

Visual output unchanged for every existing base component."
```

### Task 1.2: Extend the test renderer mock to support PostProcessing

**Files:**
- Modify: `packages/matter-react/src/MatterScene.test.tsx`

Only execute this task if Task 1.1 Step 6 failed because PostProcessing reads fields the mock doesn't provide.

- [ ] **Step 1: Identify the missing fields**

Read the `vi.mock('@lovo/matter', ...)` block at the top of `MatterScene.test.tsx`. The current mock returns:

```ts
{
  three: { render: vi.fn(), dispose: vi.fn(), domElement: ..., getPixelRatio: () => 1, setSize: vi.fn() },
  backend: 'webgl2' as const,
  dispose: vi.fn(),
  resize: vi.fn(),
}
```

`PostProcessing` reads `renderer.toneMapping` and `renderer.outputColorSpace` (both gettable and settable) during `render()`. It also calls `_quadMesh.render(renderer)` which, in turn, drives the renderer. With happy-dom + WebGPU mocked, the simplest fix is to add the two missing fields and stub `_quadMesh.render` indirectly by adding any methods our test asserts against.

- [ ] **Step 2: Add the missing fields to the mock**

Inside the `three:` object literal in the mock, add:

```ts
toneMapping: 0,           // NoToneMapping
outputColorSpace: 'srgb', // LinearSRGBColorSpace string
```

The exact values don't matter for the test — PostProcessing reads them, sets temporary values, and restores them. The mock just needs them to be present and reassignable.

- [ ] **Step 3: Verify**

Run: `pnpm --filter @lovo/matter-react test`
Expected: all tests pass.

- [ ] **Step 4: Commit (if a separate commit makes sense; otherwise amend 1.1)**

```bash
git add packages/matter-react/src/MatterScene.test.tsx
git commit -m "test(matter-react): extend renderer mock for PostProcessing fields"
```

### Phase 1 stop-and-play gate

Run: `pnpm run dev:docs` (or `vp run dev:docs`).

Open each of these pages and visually confirm the output looks identical to before the swap:
- `/components/aurora`
- `/components/linear-gradient`
- `/components/noise-field`
- `/components/dot-field`
- `/components/waves`
- `/components/mesh-gradient`

**Do not proceed to Phase 2 until the user confirms.**

---

## Phase 2 — `useOverlayPass` hook + dev tint overlay

**Stop-and-play beat at phase end:** navigate to `/dev/overlay-test`. See MeshGradient rendered, with a red tint overlay on top. Toggle the JSX order via an on-page button — feel the stacking work. User feels: "pipeline composes; I can now plug overlays in arbitrarily."

**Learning beat:** how TSL nodes compose. Why uniforms captured in the transform closure flow through automatically (uniform value mutates in place) but structural changes (like a `mode: 'centered' | 'subtractive'` toggle) need to be in deps to force a re-register.

### Task 2.1: Add `registerOverlay` to MatterContext type

**Files:**
- Modify: `packages/matter-react/src/matter-context.ts`

- [ ] **Step 1: Replace the file's contents with the extended interface**

```ts
import { createContext } from 'react'
import type { Scene, Camera } from 'three'
import type { Node } from 'three/webgpu'
import type { ShaderNodeObject } from 'three/tsl'
import type { MatterRenderer, MatterScheduler } from '@lovo/matter'

export type OverlayTransform = (
  input: ShaderNodeObject<Node>,
) => ShaderNodeObject<Node>

export interface MatterContextValue {
  renderer: MatterRenderer
  scene: Scene
  camera: Camera
  scheduler: MatterScheduler
  registerOverlay: (transform: OverlayTransform) => () => void
}

export const MatterContext = createContext<MatterContextValue | null>(null)
```

- [ ] **Step 2: Typecheck — expect failures**

Run: `pnpm --filter @lovo/matter-react typecheck`
Expected: FAIL. `MatterScene.tsx` constructs a `MatterContextValue` without `registerOverlay`. We'll fix that in Task 2.2.

### Task 2.2: Implement overlay registration in MatterScene

**Files:**
- Modify: `packages/matter-react/src/MatterScene.tsx`

- [ ] **Step 1: Add an overlay-map ref and the rebuild function in `setup`**

Inside the `setup` async function, after `const postProcessing = new PostProcessing(...)` and before `scheduler.add(...)`, add:

```ts
const overlays = new Map<symbol, OverlayTransform>()

const rebuildOutputNode = () => {
  const basePass = pass(scene, camera)
  const transforms = Array.from(overlays.values())
  postProcessing.outputNode = transforms.reduce(
    (node, transform) => transform(node),
    basePass as unknown as ShaderNodeObject<Node>,
  )
  postProcessing.needsUpdate = true
}

rebuildOutputNode()  // initial: just basePass, no overlays
```

Imports needed at the top of the file:

```ts
import type { Node } from 'three/webgpu'
import type { ShaderNodeObject } from 'three/tsl'
import type { OverlayTransform } from './matter-context.js'
```

- [ ] **Step 2: Define `registerOverlay`**

Immediately after the `rebuildOutputNode()` call, add:

```ts
const registerOverlay = (transform: OverlayTransform): (() => void) => {
  const key = Symbol('overlay')
  overlays.set(key, transform)
  rebuildOutputNode()
  return () => {
    overlays.delete(key)
    rebuildOutputNode()
  }
}
```

- [ ] **Step 3: Include `registerOverlay` in the context value**

Change:

```ts
setCtx({ renderer, scene, camera, scheduler })
```

to:

```ts
setCtx({ renderer, scene, camera, scheduler, registerOverlay })
```

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @lovo/matter-react typecheck`
Expected: PASS.

- [ ] **Step 5: Run the existing tests**

Run: `pnpm --filter @lovo/matter-react test`
Expected: existing MatterScene tests still pass. Registration isn't exercised yet — that comes in Task 2.4.

- [ ] **Step 6: Commit**

```bash
git add packages/matter-react/src/matter-context.ts packages/matter-react/src/MatterScene.tsx
git commit -m "feat(matter-react): add overlay registration to MatterContext (MAT-16 phase 2)

Adds registerOverlay(transform) to MatterContextValue. MatterScene keeps
an ordered Map<symbol, OverlayTransform> and rebuilds postProcessing.outputNode
on every registration change. No public hook yet — useOverlayPass arrives in
the next task."
```

### Task 2.3: Write `useOverlayPass` hook with failing test

**Files:**
- Create: `packages/matter-react/src/useOverlayPass.test.tsx`
- Test command: `pnpm --filter @lovo/matter-react test useOverlayPass`

- [ ] **Step 1: Create the test file**

Write `packages/matter-react/src/useOverlayPass.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vite-plus/test'
import { render, cleanup } from '@testing-library/react'
import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import type { ShaderNodeObject } from 'three/tsl'
import type { Node } from 'three/webgpu'
import { MatterContext, type MatterContextValue, type OverlayTransform } from './matter-context.js'
import { useOverlayPass } from './useOverlayPass.js'

function makeCtx(): { ctx: MatterContextValue; registered: OverlayTransform[]; cleanups: number } {
  const registered: OverlayTransform[] = []
  let cleanups = 0
  const ctx = {
    renderer: {} as MatterContextValue['renderer'],
    scene: {} as MatterContextValue['scene'],
    camera: {} as MatterContextValue['camera'],
    scheduler: {} as MatterContextValue['scheduler'],
    registerOverlay: (transform: OverlayTransform) => {
      registered.push(transform)
      return () => {
        cleanups++
      }
    },
  } as unknown as MatterContextValue
  return { ctx, registered, cleanups }
}

function Wrapper({ ctx, children }: { ctx: MatterContextValue | null; children: ReactNode }) {
  return <MatterContext.Provider value={ctx}>{children}</MatterContext.Provider>
}

const identityTransform: OverlayTransform = (input) => input

describe('useOverlayPass', () => {
  it('registers the transform on mount', () => {
    const { ctx, registered } = makeCtx()
    function Probe() {
      useOverlayPass(identityTransform, [])
      return null
    }
    render(
      <Wrapper ctx={ctx}>
        <Probe />
      </Wrapper>,
    )
    expect(registered).toHaveLength(1)
    cleanup()
  })

  it('calls the cleanup returned by registerOverlay on unmount', () => {
    const cleanupFn = vi.fn()
    const ctx = {
      renderer: {} as MatterContextValue['renderer'],
      scene: {} as MatterContextValue['scene'],
      camera: {} as MatterContextValue['camera'],
      scheduler: {} as MatterContextValue['scheduler'],
      registerOverlay: () => cleanupFn,
    } as unknown as MatterContextValue

    function Probe() {
      useOverlayPass(identityTransform, [])
      return null
    }
    const { unmount } = render(
      <Wrapper ctx={ctx}>
        <Probe />
      </Wrapper>,
    )
    unmount()
    expect(cleanupFn).toHaveBeenCalledTimes(1)
  })

  it('re-registers when a value in deps changes', () => {
    const { ctx, registered } = makeCtx()
    function Probe({ mode }: { mode: 'a' | 'b' }) {
      useOverlayPass(identityTransform, [mode])
      return null
    }
    const { rerender } = render(
      <Wrapper ctx={ctx}>
        <Probe mode="a" />
      </Wrapper>,
    )
    expect(registered).toHaveLength(1)
    rerender(
      <Wrapper ctx={ctx}>
        <Probe mode="b" />
      </Wrapper>,
    )
    expect(registered).toHaveLength(2)
    cleanup()
  })

  it('is a no-op when called outside a MatterScene provider', () => {
    function Probe() {
      useOverlayPass(identityTransform, [])
      return null
    }
    // Render without a provider. No throw expected.
    expect(() => render(<Probe />)).not.toThrow()
    cleanup()
  })
})
```

- [ ] **Step 2: Run the test — expect failure**

Run: `pnpm --filter @lovo/matter-react test useOverlayPass`
Expected: FAIL with "Cannot find module './useOverlayPass.js'".

### Task 2.4: Implement `useOverlayPass`

**Files:**
- Create: `packages/matter-react/src/useOverlayPass.ts`

- [ ] **Step 1: Implement the hook**

Write `packages/matter-react/src/useOverlayPass.ts`:

```ts
'use client'

import { useContext, useEffect, type DependencyList } from 'react'
import { MatterContext, type OverlayTransform } from './matter-context.js'

/**
 * Register a TSL transform as an overlay pass on the parent <MatterScene>.
 *
 * The transform takes the "color so far" — base scene + any earlier
 * overlays as a TSL vec4 node — and returns a modified vec4. Registration
 * happens on mount; unregistration on unmount. The hook re-registers
 * whenever any value in `deps` changes (useEffect semantics): use this
 * for structural changes (e.g., a `mode: 'centered' | 'subtractive'`
 * toggle) that swap the transform function itself. Uniforms captured
 * inside the transform mutate in place, so uniform value changes do
 * NOT need to be in deps.
 *
 * When called outside a <MatterScene> provider, this hook is a no-op.
 * Matches the existing useMatterContext convention.
 */
export function useOverlayPass(transform: OverlayTransform, deps: DependencyList): void {
  const ctx = useContext(MatterContext)

  useEffect(() => {
    if (!ctx) return
    const unregister = ctx.registerOverlay(transform)
    return unregister
    // The transform captures the latest values via the deps array; we re-register
    // when deps change. ctx is included so a remounted MatterScene re-attaches.
    // oxlint-disable-next-line react/exhaustive-deps
  }, [ctx, ...deps])
}
```

- [ ] **Step 2: Run the test — expect pass**

Run: `pnpm --filter @lovo/matter-react test useOverlayPass`
Expected: 4 tests PASS.

- [ ] **Step 3: Export the hook from the package**

Edit `packages/matter-react/src/index.ts`. After the existing `useAnimatableUniform` exports, add:

```ts
export { useOverlayPass } from './useOverlayPass.js'
export type { OverlayTransform } from './matter-context.js'
```

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @lovo/matter-react typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/matter-react/src/useOverlayPass.ts packages/matter-react/src/useOverlayPass.test.tsx packages/matter-react/src/index.ts
git commit -m "feat(matter-react): add useOverlayPass hook (MAT-16 phase 2)

useOverlayPass(transform, deps) registers a TSL transform with the
parent MatterScene's overlay registry. Same lifecycle semantics as
useEffect: register on mount, unregister on unmount, re-register on
deps change. No-op outside a MatterScene provider."
```

### Task 2.5: Build the dev tint overlay validation page

**Files:**
- Create: `apps/docs/src/app/dev/overlay-test/TintOverlay.tsx`
- Create: `apps/docs/src/app/dev/overlay-test/page.tsx`

- [ ] **Step 1: Write the dev TintOverlay component**

Create `apps/docs/src/app/dev/overlay-test/TintOverlay.tsx`:

```tsx
'use client'

import { vec4, uniform, mix as tslMix } from 'three/tsl'
import { useOverlayPass, useAnimatableUniform } from '@lovo/matter-react'
import { useMemo } from 'react'
import { Color } from 'three'

export interface TintOverlayProps {
  color: string
  intensity: number
}

/**
 * Dev-only validation overlay. NOT exported from the registry.
 * Mixes the input color toward `color` by `intensity`.
 */
export function TintOverlay({ color, intensity }: TintOverlayProps) {
  const tintColor = useMemo(() => {
    const c = new Color(color)
    return vec4(c.r, c.g, c.b, 1)
  }, [color])
  const intensityU = useAnimatableUniform<number>(intensity)

  useOverlayPass(
    (input) => tslMix(input, tintColor, intensityU),
    [tintColor, intensityU],
  )

  return null
}
```

- [ ] **Step 2: Write the dev overlay-test page**

Create `apps/docs/src/app/dev/overlay-test/page.tsx`:

```tsx
'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { TintOverlay } from './TintOverlay'

const MatterScene = dynamic(() => import('@lovo/matter-react').then((m) => m.MatterScene), {
  ssr: false,
})
const MeshGradient = dynamic(
  () => import('@matter/registry/mesh-gradient').then((m) => m.MeshGradient),
  { ssr: false },
)

export default function OverlayTestPage() {
  const [tintAbove, setTintAbove] = useState(true)
  const [intensity, setIntensity] = useState(0.3)

  return (
    <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <h1>Overlay test (dev only)</h1>
      <p style={{ color: 'var(--fg-muted)' }}>
        Validation page for the overlay registration pipeline. The tint overlay should
        visibly mix MeshGradient&apos;s output toward red. Toggle the order to feel the
        stacking work.
      </p>
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <button onClick={() => setTintAbove((v) => !v)}>
          Order: {tintAbove ? 'gradient → tint' : 'tint → gradient (same render result)'}
        </button>
        <label>
          Intensity:{' '}
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={intensity}
            onChange={(e) => setIntensity(Number(e.target.value))}
          />
        </label>
      </div>
      <div style={{ position: 'relative', width: '100%', height: '400px' }}>
        <MatterScene>
          <MeshGradient />
          {tintAbove ? (
            <TintOverlay color="#ff0000" intensity={intensity} />
          ) : null}
        </MatterScene>
      </div>
    </div>
  )
}
```

Note: only one ordering combination is rendered in this test page (single overlay) — true ordering-with-multiple-overlays is exercised in Phase 4 once Vignette exists.

- [ ] **Step 3: Run the dev server and visit the page**

Run: `vp run dev:docs` (background) or `pnpm --filter docs dev`.

Navigate to `http://localhost:3000/dev/overlay-test`. The MeshGradient base should render, tinted red. Dragging the intensity slider should change the red intensity smoothly.

- [ ] **Step 4: Commit**

```bash
git add apps/docs/src/app/dev/overlay-test
git commit -m "feat(docs): dev-only overlay-test validation page (MAT-16 phase 2)

Validates the useOverlayPass + registerOverlay pipeline end-to-end with
a TintOverlay component (dev-only, not exported from the registry).
MeshGradient base + red tint overlay; intensity slider proves uniform
mutation flows through without re-registering the transform."
```

### Phase 2 stop-and-play gate

The user opens `/dev/overlay-test`, drags the slider, toggles the order, confirms the pipeline behaves. **Do not proceed to Phase 3 until the user confirms.**

---

## Phase 3 — `<FilmGrain>` standalone component

**Stop-and-play beat at phase end:** open `/components/film-grain`. Drag intensity, drag speed, toggle mode. Open `/components/mesh-gradient` side by side and confirm the standalone FilmGrain visually matches the MeshGradient-bundled grain at equivalent intensity/speed/mode settings. User feels: "OK, FilmGrain is real and standalone; it composes onto anything."

**Learning beat:** color-space implications of in-shader vs post-process grain. Why centered grain (default) preserves the tonal midpoint (mean = 0 → no net brightness shift). Why subtractive crushes blacks.

### Task 3.1: Scaffold FilmGrain folder and wrapper

**Files:**
- Create: `registry/film-grain/film-grain.tsx`
- Create: `registry/film-grain/shader.tsx` (initial placeholder; user-written in 3.2)
- Modify: `registry/package.json`
- Modify: `registry/registry.json`

- [ ] **Step 1: Create the wrapper file**

Write `registry/film-grain/film-grain.tsx`:

```tsx
'use client'

import { FilmGrainShader, type FilmGrainMode } from './shader'
import type { AnimatableProp } from '@lovo/matter-react'

export type { FilmGrainMode } from './shader'

export interface FilmGrainProps {
  /** Grain strength. 0 = clean, 1 = heavy. Default 0.08. */
  intensity?: AnimatableProp<number>
  /** Twinkle rate. 0 = static, 1 = ~60Hz, 0.4 = ~24Hz film cadence. Default 1. */
  speed?: AnimatableProp<number>
  /**
   * 'centered' (default): brightens half, darkens half, mean-preserving.
   * 'subtractive': only darkens (silver-emulsion film-stock look).
   */
  mode?: FilmGrainMode
}

export function FilmGrain({
  intensity = 0.08,
  speed = 1,
  mode = 'centered',
}: FilmGrainProps) {
  return <FilmGrainShader intensity={intensity} speed={speed} mode={mode} />
}
```

- [ ] **Step 2: Create the shader placeholder**

Create `registry/film-grain/shader.tsx` with minimal scaffolding so the wrapper typechecks:

```tsx
'use client'

import type { AnimatableProp } from '@lovo/matter-react'

export type FilmGrainMode = 'centered' | 'subtractive'

export interface FilmGrainShaderProps {
  intensity: AnimatableProp<number>
  speed: AnimatableProp<number>
  mode: FilmGrainMode
}

// Implementation lands in Task 3.2 (user-written).
export function FilmGrainShader(_props: FilmGrainShaderProps) {
  return null
}
```

- [ ] **Step 3: Register the component in `registry/package.json`**

Open `registry/package.json`. In the `exports` block, add (alphabetical order):

```json
"./film-grain": "./film-grain/film-grain.tsx",
```

The final exports should include both the existing entries and the new one.

- [ ] **Step 4: Register the component in `registry/registry.json`**

Open `registry/registry.json`. Inside the `components` object, add the entry (the catalog and nav auto-derive from this file):

```json
"film-grain": {
  "file": "film-grain/film-grain.tsx",
  "description": "Centered or subtractive film grain overlay. Stacks on top of any base component inside <MatterScene>.",
  "dependencies": ["@lovo/matter", "@lovo/matter-react", "react", "three"],
  "uses_primitives": ["filmGrain", "uv", "vec4", "uniform", "time", "floor"],
  "tier": 1
}
```

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter @matter/registry typecheck` (and the docs app if it pulls registry types). Expected: PASS — the placeholder shader is a valid component that renders null.

- [ ] **Step 6: Confirm the docs sidebar lists it**

Run `vp run dev:docs` and visit `/components`. The "Film Grain" entry should appear in the list (auto-derived from `registry.json`). Visiting `/components/film-grain` will 404 until Task 3.3.

- [ ] **Step 7: Commit**

```bash
git add registry/film-grain registry/package.json registry/registry.json
git commit -m "feat(registry): scaffold FilmGrain folder + wrapper (MAT-16 phase 3)

Empty shader (renders null) so the docs sidebar entry and component
package export resolve. Shader implementation lands in the next task."
```

### Task 3.2: Write the FilmGrain shader (USER-WRITTEN, chunk-by-chunk)

**Files:**
- Modify: `registry/film-grain/shader.tsx`

**IMPORTANT:** Per the user's `feedback_shader_co_write` preference, the agent describes what to write and explains the TSL concepts but does NOT call `Edit` or `Write` on `registry/film-grain/shader.tsx`. The user writes each chunk, runs the dev server, and reacts before the next chunk.

The shader should end up looking like this (give this to the user as the target, broken into the chunks below):

```tsx
'use client'

import { useEffect, useMemo } from 'react'
import { uv, vec4, floor, uniform, type ShaderNodeObject } from 'three/tsl'
import type { Node } from 'three/webgpu'

import { time, filmGrain } from '@lovo/matter'
import {
  useOverlayPass,
  useAnimatableUniform,
  type AnimatableProp,
} from '@lovo/matter-react'

export type FilmGrainMode = 'centered' | 'subtractive'

export interface FilmGrainShaderProps {
  intensity: AnimatableProp<number>
  speed: AnimatableProp<number>
  mode: FilmGrainMode
}

export function FilmGrainShader({ intensity, speed, mode }: FilmGrainShaderProps) {
  const intensityU = useAnimatableUniform<number>(intensity)
  const speedU = useAnimatableUniform<number>(speed)

  useOverlayPass(
    (input) => {
      // Quantize time so the grain re-randomizes at a discrete shutter rate
      // instead of every frame. speed=1 → 60Hz; speed=0.4 → ~24Hz film cadence.
      const grainTime = floor(time.mul(speedU).mul(60))
      const grain = filmGrain(uv(), intensityU, grainTime)

      if (mode === 'centered') {
        // Centered grain has mean = 0 → adding it to the input is brightness-preserving.
        return input.add(vec4(grain, grain, grain, 0))
      }
      // Subtractive (silver-emulsion look): only darkens. Use the absolute value
      // so the centered output's negative half also pulls down.
      const positive = grain.abs()
      return input.sub(vec4(positive, positive, positive, 0))
    },
    [intensityU, speedU, mode],
  )

  return null
}
```

The agent's job is to GUIDE the user through writing this. Steps:

- [ ] **Step 1: Describe the file shape to the user**

Tell the user (in conversation, not in an Edit call):
"The shader file owns three things: uniform plumbing for `intensity` and `speed`, a `useOverlayPass` call with the TSL transform, and a `return null` (overlays don't render React tree). It's smaller than MeshGradient because no scene mesh is created — overlays live in the PostProcessing pipeline, not the scene graph."

- [ ] **Step 2: Walk through chunk 1 — imports and prop interface**

Describe what to import and why each is needed:
- `uv`, `vec4`, `floor`, `uniform` from `three/tsl` — TSL helpers.
- `time`, `filmGrain` from `@lovo/matter` — global time node and the centered-grain primitive shipped in MAT-8 phase 6b.
- `useOverlayPass`, `useAnimatableUniform`, `AnimatableProp` from `@lovo/matter-react` — the new hook + existing uniform binder.
- `ShaderNodeObject`, `Node` from `three/tsl` and `three/webgpu` — TSL types.

The user types these. Pause for them to confirm the file compiles (placeholder body is fine).

- [ ] **Step 3: Walk through chunk 2 — uniform bindings**

Explain: `useAnimatableUniform` binds an `AnimatableProp<number>` (a plain number OR a signal) to a TSL uniform node. The returned node is a mutable handle; when the user drags a slider, the underlying value updates in place without rebuilding the shader. This is the same hook MeshGradient uses for `speed`, `frequency`, etc.

The user types:

```ts
const intensityU = useAnimatableUniform<number>(intensity)
const speedU = useAnimatableUniform<number>(speed)
```

Pause for the user to confirm. Run typecheck.

- [ ] **Step 4: Walk through chunk 3 — the centered-mode transform first**

Explain the simpler mode first:
- `time` is a TSL node that ticks every frame (driven by MatterScheduler).
- `time.mul(speedU).mul(60)` scales time by speed and then by 60 (so speed=1 → 60Hz). `floor(...)` quantizes to integer ticks — each tick re-randomizes the grain. This is what gives film grain its "shutter" feel rather than continuous animation.
- `filmGrain(uv(), intensityU, grainTime)` returns a centered scalar TSL node in `[-intensityU, +intensityU]` (mean ≈ 0).
- `input.add(vec4(grain, grain, grain, 0))` adds the same grain value to R, G, B, and 0 to A so we don't mess with alpha.

The user types the centered branch only first (no `mode` toggle yet):

```ts
useOverlayPass(
  (input) => {
    const grainTime = floor(time.mul(speedU).mul(60))
    const grain = filmGrain(uv(), intensityU, grainTime)
    return input.add(vec4(grain, grain, grain, 0))
  },
  [intensityU, speedU],
)
```

Pause. The user runs `vp run dev:docs` and visits `/dev/overlay-test` (Phase 2's page) — but first swaps the `TintOverlay` import for `FilmGrain`. They drag intensity and confirm grain appears. **Stop and play.**

- [ ] **Step 5: Walk through chunk 4 — adding the mode toggle**

Now explain subtractive:
- Subtractive grain only darkens — it simulates silver-emulsion physics where exposed grains BLOCK light.
- `grain.abs()` takes the absolute value so the centered output's negative half ALSO contributes to darkening (instead of darkening half the time and brightening the other half).
- `input.sub(...)` subtracts the positive grain. Result: image only gets darker per pixel.
- CLAUDE.md gotcha #12 (build TSL expressions from `uv()`/`vec2(...)`/literals; uniforms only as arguments) does NOT apply here because `grain` is itself the output of a TSL chain (`filmGrain(...)` builds the chain from `uv()`). Subsequent `.abs()` on that chain is safe.

The user replaces the static `return input.add(...)` with the conditional:

```ts
if (mode === 'centered') {
  return input.add(vec4(grain, grain, grain, 0))
}
const positive = grain.abs()
return input.sub(vec4(positive, positive, positive, 0))
```

And adds `mode` to the deps array: `[intensityU, speedU, mode]`. The `mode` dep is structural — when it toggles, the transform function changes shape and must be re-registered.

Pause. User toggles the mode (currently hardcoded in `/dev/overlay-test` — they can edit the page to add a mode toggle, or wait until Task 3.3 brings real Tweakpane controls). **Stop and play.**

- [ ] **Step 6: Run typecheck and confirm**

Run: `pnpm --filter @matter/registry typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add registry/film-grain/shader.tsx
git commit -m "feat(film-grain): centered + subtractive grain via useOverlayPass (MAT-16 phase 3)

Standalone <FilmGrain> shader that wraps the centered filmGrain primitive
(shipped in MAT-8 6b) in an overlay-pass transform. Centered mode (default)
is brightness-preserving; subtractive mode crushes blacks for a silver-
emulsion film-stock look."
```

### Task 3.3: Build the `<FilmGrain>` docs playground page

**Files:**
- Create: `apps/docs/src/app/components/film-grain/page.tsx`

- [ ] **Step 1: Read Aurora's docs page as the template**

Read `apps/docs/src/app/components/aurora/page.tsx` in full. The pattern: a Tweakpane-driven playground with params state, a "Copy JSX" / "Copy params" / "Reset all" set of buttons, and a `<VisualTestPause>` for the Playwright snapshot lifecycle.

- [ ] **Step 2: Write the FilmGrain docs page**

Create `apps/docs/src/app/components/film-grain/page.tsx`. Follow Aurora's structure but simpler — FilmGrain has only three props. Use a LinearGradient base for clarity so the grain is the visible variable. Outline:

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { Pane } from 'tweakpane'
import dynamic from 'next/dynamic'
import { VisualTestPause } from '@/lib/visualTestHooks'
import type { FilmGrainMode } from '@matter/registry/film-grain'

const MatterScene = dynamic(() => import('@lovo/matter-react').then((m) => m.MatterScene), {
  ssr: false,
})
const LinearGradient = dynamic(
  () => import('@matter/registry/linear-gradient').then((m) => m.LinearGradient),
  { ssr: false },
)
const FilmGrain = dynamic(
  () => import('@matter/registry/film-grain').then((m) => m.FilmGrain),
  { ssr: false },
)

interface FilmGrainParams {
  intensity: number
  speed: number
  mode: FilmGrainMode
}

const INITIAL: FilmGrainParams = { intensity: 0.08, speed: 1, mode: 'centered' }

const fmtNum = (n: number) => String(Math.round(n * 10000) / 10000)

const fmtJsx = (p: FilmGrainParams) =>
  `<MatterScene>
  <LinearGradient />
  <FilmGrain
    intensity={${fmtNum(p.intensity)}}
    speed={${fmtNum(p.speed)}}
    mode={'${p.mode}'}
  />
</MatterScene>`

export default function FilmGrainPage() {
  const paneHostRef = useRef<HTMLDivElement>(null)
  const [params, setParams] = useState<FilmGrainParams>(INITIAL)

  useEffect(() => {
    if (!paneHostRef.current) return
    const pane = new Pane({ container: paneHostRef.current, title: 'FilmGrain' })
    const state = { ...INITIAL }
    pane.addBinding(state, 'intensity', { min: 0, max: 1, step: 0.001 })
    pane.addBinding(state, 'speed', { min: 0, max: 4, step: 0.01 })
    pane.addBinding(state, 'mode', { options: { centered: 'centered', subtractive: 'subtractive' } })
    pane.on('change', () => setParams({ ...state }))

    pane.addButton({ title: 'Reset all' }).on('click', () => {
      Object.assign(state, INITIAL)
      pane.refresh()
      setParams({ ...INITIAL })
    })
    pane.addButton({ title: 'Copy JSX' }).on('click', () => {
      void navigator.clipboard?.writeText(fmtJsx(state))
    })

    return () => pane.dispose()
  }, [])

  return (
    <article style={{ lineHeight: 1.65 }}>
      <h1 style={{ marginTop: 0 }}>FilmGrain</h1>
      <p style={{ color: 'var(--fg-muted)' }}>
        Standalone film grain overlay. Stacks inside any <code>&lt;MatterScene&gt;</code>.
        Centered mode brightens half the pixels and darkens the other half (mean-preserving);
        subtractive mode only darkens (silver-emulsion film-stock look).
      </p>
      <VisualTestPause>
        <div style={{ position: 'relative', width: '100%', height: '400px' }}>
          <MatterScene>
            <LinearGradient />
            <FilmGrain intensity={params.intensity} speed={params.speed} mode={params.mode} />
          </MatterScene>
        </div>
      </VisualTestPause>
      <div ref={paneHostRef} style={{ marginTop: '1rem' }} />
    </article>
  )
}
```

- [ ] **Step 3: Visit the page and confirm**

Run: `vp run dev:docs`.
Visit `/components/film-grain`. Drag intensity, drag speed, toggle mode. Confirm visually.

- [ ] **Step 4: Confirm sidebar entry resolves**

The sidebar should already list "Film Grain" (auto-derived from `registry.json` in 3.1 Step 4). Clicking it should now land on this page without a 404.

- [ ] **Step 5: Lint**

Run: `vp lint` (or `pnpm lint`). Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/docs/src/app/components/film-grain
git commit -m "feat(docs): FilmGrain playground page (MAT-16 phase 3)

Tweakpane-driven demo on a LinearGradient base so the grain is the
visible variable. Mirrors the Aurora page pattern (params state,
Copy JSX button, VisualTestPause for Playwright snapshots)."
```

### Phase 3 stop-and-play gate

User opens `/components/film-grain`, plays with the controls, opens `/components/mesh-gradient` side by side, confirms the standalone FilmGrain at the same params reads visually equivalent to MeshGradient's bundled grain. **Do not proceed to Phase 4 until the user confirms.**

---

## Phase 4 — `<Vignette>` standalone component

**Stop-and-play beat at phase end:** open `/components/vignette`. See vignette darken the edges. Toggle a button that swaps `<FilmGrain>` and `<Vignette>` order via JSX — see the difference: grain-then-vignette darkens the *grainy* output; vignette-then-grain leaves grain bright in dark corners. User feels: "stacking order matters, and the post-process pipeline expresses this naturally."

**Learning beat:** what multiplicative blending does. How read-upstream-pixels passes (Vignette darkens existing pixels) differ from generate-from-uv passes (FilmGrain creates new noise from uv). The architecture choice (PostProcessing path) earned its keep right here.

### Task 4.1: Scaffold Vignette folder and wrapper

**Files:**
- Create: `registry/vignette/vignette.tsx`
- Create: `registry/vignette/shader.tsx` (placeholder; user-written in 4.2)
- Modify: `registry/package.json`
- Modify: `registry/registry.json`

- [ ] **Step 1: Create the wrapper**

Write `registry/vignette/vignette.tsx`:

```tsx
'use client'

import { VignetteShader } from './shader'
import type { AnimatableProp } from '@lovo/matter-react'

export interface VignetteProps {
  /** How dark the edges go. 0 = no vignette, 1 = full edge color at corners. Default 0.4. */
  intensity?: AnimatableProp<number>
  /** Falloff gradualness. 0 = hard ring, 1 = very soft. Default 0.5. */
  softness?: AnimatableProp<number>
  /** Normalized UV of the bright center. Default [0.5, 0.5]. */
  center?: [number, number]
  /** Distance from center where darkening begins. Default 0.7. */
  radius?: AnimatableProp<number>
  /** What color to fade edges toward. Default '#000000'. */
  color?: string
}

export function Vignette({
  intensity = 0.4,
  softness = 0.5,
  center = [0.5, 0.5],
  radius = 0.7,
  color = '#000000',
}: VignetteProps) {
  return (
    <VignetteShader
      intensity={intensity}
      softness={softness}
      center={center}
      radius={radius}
      color={color}
    />
  )
}
```

- [ ] **Step 2: Create the placeholder shader**

Create `registry/vignette/shader.tsx`:

```tsx
'use client'

import type { AnimatableProp } from '@lovo/matter-react'

export interface VignetteShaderProps {
  intensity: AnimatableProp<number>
  softness: AnimatableProp<number>
  center: [number, number]
  radius: AnimatableProp<number>
  color: string
}

// Implementation lands in Task 4.2 (user-written).
export function VignetteShader(_props: VignetteShaderProps) {
  return null
}
```

- [ ] **Step 3: Register exports**

Edit `registry/package.json`. Add to `exports`:

```json
"./vignette": "./vignette/vignette.tsx",
```

Edit `registry/registry.json`. Add to `components`:

```json
"vignette": {
  "file": "vignette/vignette.tsx",
  "description": "Radial darkening at the canvas edges. Stacks on top of any base component inside <MatterScene>.",
  "dependencies": ["@lovo/matter", "@lovo/matter-react", "react", "three"],
  "uses_primitives": ["uv", "vec2", "vec3", "vec4", "mix", "smoothstep", "length", "uniform"],
  "tier": 1
}
```

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @matter/registry typecheck`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add registry/vignette registry/package.json registry/registry.json
git commit -m "feat(registry): scaffold Vignette folder + wrapper (MAT-16 phase 4)

Placeholder shader (renders null). Sidebar entry + package export resolve;
implementation in the next task."
```

### Task 4.2: Write the Vignette shader (USER-WRITTEN, chunk-by-chunk)

**Files:**
- Modify: `registry/vignette/shader.tsx`

**IMPORTANT:** Per `feedback_shader_co_write`, the user writes the TSL. The agent describes and explains; does not call Edit/Write.

The target shader to guide the user toward:

```tsx
'use client'

import { useEffect, useMemo } from 'react'
import { Vector2, Vector3 } from 'three/webgpu'
import { uv, vec2, vec4, mix as tslMix, smoothstep, length, uniform, type ShaderNodeObject } from 'three/tsl'
import type { Node } from 'three/webgpu'

import { useOverlayPass, useAnimatableUniform, useResize, type AnimatableProp } from '@lovo/matter-react'

import { parseHex } from '../utils/color'

export interface VignetteShaderProps {
  intensity: AnimatableProp<number>
  softness: AnimatableProp<number>
  center: [number, number]
  radius: AnimatableProp<number>
  color: string
}

export function VignetteShader({ intensity, softness, center, radius, color }: VignetteShaderProps) {
  const intensityU = useAnimatableUniform<number>(intensity)
  const softnessU = useAnimatableUniform<number>(softness)
  const radiusU = useAnimatableUniform<number>(radius)

  // Center is a [x, y] tuple, not animatable — wrapped in a uniform Vector2
  // so we can mutate it in place when the prop changes.
  const centerVec = useMemo(() => new Vector2(center[0], center[1]), [])
  const centerU = useMemo(() => uniform(centerVec) as unknown as ShaderNodeObject<Node>, [centerVec])
  useEffect(() => {
    centerVec.set(center[0], center[1])
  }, [center, centerVec])

  // Edge color: parsed once, mutated in place on hex change.
  const colorVec = useMemo(() => {
    const [r, g, b] = parseHex(color)
    return new Vector3(r, g, b)
  }, [])
  const colorU = useMemo(() => uniform(colorVec) as unknown as ShaderNodeObject<Node>, [colorVec])
  useEffect(() => {
    const [r, g, b] = parseHex(color)
    colorVec.set(r, g, b)
  }, [color, colorVec])

  // Resolution for aspect correction so the vignette mask is a circle, not an ellipse.
  const resize = useResize()
  const resVec = useMemo(() => new Vector2(1920, 1080), [])
  const resNode = useMemo(() => uniform(resVec) as unknown as ShaderNodeObject<Node>, [resVec])
  useEffect(() => {
    const [w, h] = resize.get()
    if (w > 0 && h > 0) resVec.set(w, h)
    return resize.on('change', ([w2, h2]) => resVec.set(w2, h2))
  }, [resize, resVec])

  useOverlayPass(
    (input) => {
      // Centered, aspect-corrected uv. Distance is measured in unit space
      // so the falloff ring is a real circle regardless of canvas aspect.
      const aspect = resNode.x.div(resNode.y)
      const centered = uv().sub(centerU as unknown as ShaderNodeObject<Node>)
      const corrected = vec2(centered.x.mul(aspect), centered.y)
      const dist = length(corrected)

      // smoothstep from inner→radius gives 0 inside, 1 at the edge.
      // Inner = radius * (1 - softness), so softness 0 → hard ring, 1 → very soft.
      const inner = radiusU.mul(softnessU.oneMinus())
      const mask = smoothstep(inner, radiusU, dist)
      const factor = mask.mul(intensityU)

      // Mix input toward edge color by factor. At factor = 0 → input unchanged.
      // At factor = 1 → fully edge color.
      return tslMix(input, vec4(colorU, 1), factor)
    },
    [intensityU, softnessU, radiusU, centerU, colorU, resNode],
  )

  return null
}
```

- [ ] **Step 1: Describe the file shape to the user**

Tell the user (in conversation): "Vignette is bigger than FilmGrain because it needs three things FilmGrain doesn't: a tuple-prop uniform (center), a hex-color uniform (color), and resolution-aware aspect correction (so the mask is a circle, not an ellipse on widescreen). The transform itself is just one line of math — most of the file is uniform plumbing."

- [ ] **Step 2: Walk through chunk 1 — imports + prop interface**

List what's imported and why. Specifically:
- `parseHex` from `../utils/color` — the same hex parser MeshGradient uses.
- `Vector2`, `Vector3` from `three/webgpu` — used as raw uniform values (per CLAUDE.md gotcha #6, plain `vec2(...)` from TSL loses the `.set()` API).
- `useResize` — for aspect-correction (so the mask isn't an ellipse on a 16:9 canvas).

The user writes the imports + the `VignetteShaderProps` interface + the component skeleton.

- [ ] **Step 3: Walk through chunk 2 — scalar uniform bindings**

Three `useAnimatableUniform` calls for `intensity`, `softness`, `radius`. Same pattern as FilmGrain. The user types these.

- [ ] **Step 4: Walk through chunk 3 — vector uniforms (center and color)**

Explain CLAUDE.md gotcha #6: `useMemo(() => new Vector2(...))` followed by `useMemo(() => uniform(vec))` gives a mutable handle. `useEffect([center])` writes via `.set()` instead of recreating the uniform — keeps shader material identity stable on every prop change.

The user types the `centerVec`/`centerU`/`useEffect` triplet for `center`, then the analogous triplet for `colorU` (with `parseHex`).

- [ ] **Step 5: Walk through chunk 4 — resolution + aspect correction**

Explain: `useResize` returns a signal with `.get()` and `.on('change', cb)`. We seed a `Vector2(1920, 1080)` and let the resize signal mutate it. The actual aspect correction happens inside the transform via `resNode.x.div(resNode.y)`.

The user types this block.

- [ ] **Step 6: Walk through chunk 5 — the transform**

The math, step by step:
- `centered = uv().sub(centerU)` — recenter the UVs so (0,0) is at the `center` prop.
- `corrected = vec2(centered.x.mul(aspect), centered.y)` — scale x by aspect so a circle of fixed unit radius covers the full canvas in both directions. (Aspect-correction in unit space lets us measure radial distance honestly.)
- `dist = length(corrected)` — radial distance from center.
- `inner = radiusU.mul(softnessU.oneMinus())` — softness 0 → inner equals radius (hard ring); softness 1 → inner equals 0 (entire canvas in the falloff).
- `mask = smoothstep(inner, radiusU, dist)` — a smooth 0→1 ramp between inner and outer. 0 at the center, 1 past the radius.
- `factor = mask.mul(intensityU)` — scale the mask by intensity. At intensity=0 the entire factor is 0 → no visible vignette.
- `tslMix(input, vec4(colorU, 1), factor)` — interpolate from input toward the edge color by the factor. At factor=0 → input; factor=1 → edge color.

CLAUDE.md gotcha #12 applies here: notice we build expressions starting from `uv()`, then chain. Uniforms (`centerU`, `radiusU`, `softnessU`, `intensityU`, `colorU`, `resNode`) appear as arguments to chained methods, never as receivers.

The user types the `useOverlayPass(...)` call with the transform. Pause for them to run dev and visit `/components/vignette` (which still hits the placeholder until the docs page in Task 4.3).

- [ ] **Step 7: Run typecheck and confirm**

Run: `pnpm --filter @matter/registry typecheck`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add registry/vignette/shader.tsx
git commit -m "feat(vignette): aspect-corrected radial darkening via useOverlayPass (MAT-16 phase 4)

Standalone <Vignette> with intensity, softness, center, radius, color
props. First overlay that multiplies the input — exercises the read-
upstream-pixels case the PostProcessing architecture was chosen for."
```

### Task 4.3: Build the Vignette docs playground page

**Files:**
- Create: `apps/docs/src/app/components/vignette/page.tsx`

- [ ] **Step 1: Write the page**

Follow the FilmGrain page pattern. Use a LinearGradient base. Add a button or boolean toggle that swaps the JSX order between `<FilmGrain> then <Vignette>` and `<Vignette> then <FilmGrain>` so the user can feel stacking-order behavior.

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { Pane } from 'tweakpane'
import dynamic from 'next/dynamic'
import { VisualTestPause } from '@/lib/visualTestHooks'

const MatterScene = dynamic(() => import('@lovo/matter-react').then((m) => m.MatterScene), {
  ssr: false,
})
const LinearGradient = dynamic(
  () => import('@matter/registry/linear-gradient').then((m) => m.LinearGradient),
  { ssr: false },
)
const FilmGrain = dynamic(() => import('@matter/registry/film-grain').then((m) => m.FilmGrain), {
  ssr: false,
})
const Vignette = dynamic(() => import('@matter/registry/vignette').then((m) => m.Vignette), {
  ssr: false,
})

interface VignetteParams {
  intensity: number
  softness: number
  centerX: number
  centerY: number
  radius: number
  color: string
  grainOrderFirst: boolean
  grainIntensity: number
}

const INITIAL: VignetteParams = {
  intensity: 0.5,
  softness: 0.5,
  centerX: 0.5,
  centerY: 0.5,
  radius: 0.6,
  color: '#000000',
  grainOrderFirst: true,
  grainIntensity: 0.06,
}

const fmtNum = (n: number) => String(Math.round(n * 10000) / 10000)

export default function VignettePage() {
  const paneHostRef = useRef<HTMLDivElement>(null)
  const [params, setParams] = useState<VignetteParams>(INITIAL)

  useEffect(() => {
    if (!paneHostRef.current) return
    const pane = new Pane({ container: paneHostRef.current, title: 'Vignette' })
    const state = { ...INITIAL }
    pane.addBinding(state, 'intensity', { min: 0, max: 1, step: 0.01 })
    pane.addBinding(state, 'softness', { min: 0, max: 1, step: 0.01 })
    pane.addBinding(state, 'centerX', { min: 0, max: 1, step: 0.01 })
    pane.addBinding(state, 'centerY', { min: 0, max: 1, step: 0.01 })
    pane.addBinding(state, 'radius', { min: 0, max: 1.5, step: 0.01 })
    pane.addBinding(state, 'color')
    const stackFolder = pane.addFolder({ title: 'Stack with FilmGrain' })
    stackFolder.addBinding(state, 'grainOrderFirst', { label: 'grain first?' })
    stackFolder.addBinding(state, 'grainIntensity', { min: 0, max: 0.5, step: 0.005 })
    pane.on('change', () => setParams({ ...state }))

    pane.addButton({ title: 'Reset all' }).on('click', () => {
      Object.assign(state, INITIAL)
      pane.refresh()
      setParams({ ...INITIAL })
    })

    return () => pane.dispose()
  }, [])

  return (
    <article style={{ lineHeight: 1.65 }}>
      <h1 style={{ marginTop: 0 }}>Vignette</h1>
      <p style={{ color: 'var(--fg-muted)' }}>
        Radial darkening at the canvas edges. The example stacks Vignette with FilmGrain so you can
        feel how order matters: grain-then-vignette darkens the grainy output (grain dims in the
        corners); vignette-then-grain leaves grain bright in the dark edges.
      </p>
      <VisualTestPause>
        <div style={{ position: 'relative', width: '100%', height: '400px' }}>
          <MatterScene>
            <LinearGradient />
            {params.grainOrderFirst ? (
              <>
                <FilmGrain intensity={params.grainIntensity} />
                <Vignette
                  intensity={params.intensity}
                  softness={params.softness}
                  center={[params.centerX, params.centerY]}
                  radius={params.radius}
                  color={params.color}
                />
              </>
            ) : (
              <>
                <Vignette
                  intensity={params.intensity}
                  softness={params.softness}
                  center={[params.centerX, params.centerY]}
                  radius={params.radius}
                  color={params.color}
                />
                <FilmGrain intensity={params.grainIntensity} />
              </>
            )}
          </MatterScene>
        </div>
      </VisualTestPause>
      <div ref={paneHostRef} style={{ marginTop: '1rem' }} />
    </article>
  )
}
```

- [ ] **Step 2: Visit the page**

Run: `vp run dev:docs`. Open `/components/vignette`. Drag controls, toggle "grain first?" — watch the grain dim with the vignette in one order and stay bright in the corners in the other.

- [ ] **Step 3: Lint**

Run: `vp lint`. Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/docs/src/app/components/vignette
git commit -m "feat(docs): Vignette playground with stacking-order toggle (MAT-16 phase 4)

Demonstrates Vignette standalone and stacked with FilmGrain. The
order toggle exposes the difference: grain-first → grain darkens
with vignette; vignette-first → grain bright in dark corners."
```

### Phase 4 stop-and-play gate

User opens `/components/vignette`, drags controls, toggles the order. Confirms the architecture choice (multiplicative-into-input vs. additive-on-top) feels right. **Do not proceed to Phase 5 until the user confirms.**

---

## Phase 5 — Drop bundled grain from MeshGradient

**Stop-and-play beat at phase end:** open `/components/mesh-gradient`. The page should feel identical to today's experience — same gradient, same grain at the same settings — but the grain controls are now in a clearly-labeled "FilmGrain overlay" Tweakpane folder. Toggle the FilmGrain off — confirm MeshGradient renders grain-free. User feels: "composition replaces feature-bundling; one canonical grain across the library."

**Learning beat:** how the same visual output expresses via composition rather than carry-every-feature components.

### Task 5.1: Remove grain from the MeshGradient shader (USER-EDITED)

**Files:**
- Modify: `registry/mesh-gradient/shader.tsx`

**IMPORTANT:** Per `feedback_shader_co_write`, the user makes these edits. The agent describes and explains; does not call Edit/Write.

The user's job, walked through:

- [ ] **Step 1: Describe the four removals to the user**

Walk through what comes out of `registry/mesh-gradient/shader.tsx`:

1. **Two prop fields:** `grain` and `grainSpeed` lines from `MeshGradientShaderProps`.
2. **Two `useAnimatableUniform` calls:** `grainU` and `grainSpeedU` near the top of the component body.
3. **The film-grain block in the `useEffect`:** the comment, `grainTime`, `grainScalar`, `colorWithGrain`, and the change from `vec4(colorWithGrain, 1)` to `vec4(color, 1)` in the material's `colorNode`.
4. **The import:** `filmGrain` from `@lovo/matter` (no longer used), and `floor` from `three/tsl` (was only used for the grain time quantization — confirm no other use first).
5. **Two deps:** `grainU` and `grainSpeedU` from the effect's deps array.

- [ ] **Step 2: Walk through the props removal**

Tell the user to delete these two lines from `MeshGradientShaderProps`:

```ts
/** Film grain intensity (0..1). 0 = clean, 1 = heavy static. Default 0.08. */
grain: AnimatableProp<number>
/** Grain twinkle rate. 0 = static, 1 = default twinkle, higher = faster. */
grainSpeed: AnimatableProp<number>
```

And delete `grain` and `grainSpeed` from the destructured function signature.

- [ ] **Step 3: Walk through the uniform removal**

Delete:

```ts
const grainU = useAnimatableUniform<number>(grain)
const grainSpeedU = useAnimatableUniform<number>(grainSpeed)
```

- [ ] **Step 4: Walk through the shader edit**

Inside the `useEffect`, delete this block:

```ts
// ---- Film grain ---------------------------------------------------
// (full comment and the three lines below)
const grainTime = floor(time.mul(grainSpeedU).mul(60))
const grainScalar = filmGrain(uv(), grainU, grainTime)
const colorWithGrain = color.add(grainScalar)
```

Then change:

```ts
material.colorNode = vec4(colorWithGrain, 1)
```

to:

```ts
material.colorNode = vec4(color, 1)
```

- [ ] **Step 5: Walk through the import cleanup**

Update the imports:
- Remove `filmGrain` from the `@lovo/matter` import line — keep `time` and `noise`.
- Remove `floor` from the `three/tsl` import line — confirm by searching the file: it's only used inside the grain block we just deleted.

- [ ] **Step 6: Walk through the deps cleanup**

Remove `grainU` and `grainSpeedU` from the deps array of the main `useEffect`.

- [ ] **Step 7: Typecheck**

Run: `pnpm --filter @matter/registry typecheck`
Expected: PASS.

- [ ] **Step 8: Run dev and inspect**

Run: `vp run dev:docs`. Open `/components/mesh-gradient`. The grain controls in the existing Tweakpane will throw or have no effect — that's expected; Task 5.2 reworks the docs page. Confirm the gradient itself renders correctly without grain.

- [ ] **Step 9: Commit**

```bash
git add registry/mesh-gradient/shader.tsx
git commit -m "feat(mesh-gradient)!: remove bundled grain (MAT-16 phase 5)

MeshGradient is now a pure gradient renderer. Grain becomes an overlay
concern across the whole library via <FilmGrain>. Breaking change for
the registry component, but the registry copy-paste model means existing
pulled copies keep working — only new pulls/refreshes pick up this change."
```

### Task 5.2: Remove grain props from MeshGradient wrapper

**Files:**
- Modify: `registry/mesh-gradient/mesh-gradient.tsx`

- [ ] **Step 1: Read the current wrapper**

Read `registry/mesh-gradient/mesh-gradient.tsx`. Identify the `grain` and `grainSpeed` entries in the props interface and the defaulted signature.

- [ ] **Step 2: Delete the two prop fields**

Tell the user (this is one tiny edit — the agent may make it directly since it's a wrapper, not a shader file). Delete the `grain` and `grainSpeed` fields from the `MeshGradientProps` interface, and from the destructured signature, and from the spread into `<MeshGradientShader />`.

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @matter/registry typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add registry/mesh-gradient/mesh-gradient.tsx
git commit -m "refactor(mesh-gradient): drop grain/grainSpeed props from wrapper (MAT-16 phase 5)"
```

### Task 5.3: Update the MeshGradient docs page to stack FilmGrain

**Files:**
- Modify: `apps/docs/src/app/components/mesh-gradient/page.tsx`

- [ ] **Step 1: Read the current page**

Read `apps/docs/src/app/components/mesh-gradient/page.tsx`. Identify the `grain` and `grainSpeed` Tweakpane bindings, the related lines in the `params` state, the JSX where they're handed to `<MeshGradient />`, and the JSX copy-string formatter that includes them.

- [ ] **Step 2: Rework the params shape**

Add a `FilmGrain` dynamic import next to the existing `MeshGradient` import:

```ts
const FilmGrain = dynamic(() => import('@matter/registry/film-grain').then((m) => m.FilmGrain), {
  ssr: false,
})
```

In the params state, keep `grain` and `grainSpeed` (they now drive the stacked `<FilmGrain>` rather than `<MeshGradient>`).

- [ ] **Step 3: Move the grain controls to a labeled folder**

In the Tweakpane setup, wrap the `grain` and `grainSpeed` bindings in a folder labeled "FilmGrain overlay":

```ts
const grainFolder = pane.addFolder({ title: 'FilmGrain overlay' })
grainFolder.addBinding(state, 'grain', { min: 0, max: 1, step: 0.001 })
grainFolder.addBinding(state, 'grainSpeed', { min: 0, max: 4, step: 0.01 })
```

- [ ] **Step 4: Update the JSX to stack FilmGrain**

Inside the `<MatterScene>` block, remove the `grain` and `grainSpeed` props from `<MeshGradient />` and add `<FilmGrain>` as a sibling:

```tsx
<MatterScene>
  <MeshGradient
    speed={params.speed}
    frequency={params.frequency}
    amplitude={params.amplitude}
    cycleSpeed={params.cycleSpeed}
    cycleEase={params.cycleEase}
    paletteA={params.paletteA}
    paletteB={params.paletteB}
  />
  <FilmGrain intensity={params.grain} speed={params.grainSpeed} />
</MatterScene>
```

- [ ] **Step 5: Update the "Copy JSX" formatter**

Wherever the page formats a JSX snippet (a `fmtJsx` function or similar), update it to emit both `<MeshGradient>` and `<FilmGrain>` lines instead of the bundled-grain props.

- [ ] **Step 6: Visit the page**

Run: `vp run dev:docs`. Open `/components/mesh-gradient`. The gradient + grain should read visually equivalent to the pre-Phase-5 page. The Tweakpane should have the FilmGrain controls in their labeled folder. Toggle `grain` to 0 — confirm pure-gradient rendering. Drag back up — confirm grain returns.

- [ ] **Step 7: Lint**

Run: `vp lint`. Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/docs/src/app/components/mesh-gradient/page.tsx
git commit -m "feat(docs): rework MeshGradient page to stack <FilmGrain> (MAT-16 phase 5)

Grain controls moved into a labeled 'FilmGrain overlay' folder in
the Tweakpane. Copy-JSX output now emits the two-component stack
that replaces the bundled-grain shortcut."
```

### Phase 5 stop-and-play gate

User opens `/components/mesh-gradient`, drives all controls. Confirms visual parity with the pre-Phase-5 experience. Toggles grain off — sees pure gradient. **Do not proceed to Phase 6 until the user confirms.**

---

## Phase 6 — Visual snapshots, changesets, cleanup

**Stop-and-play beat at phase end:** `pnpm run test:visual` (or `vp run test:visual`) all green. Manual review of the regenerated PNGs in `apps/docs-tests/visual/*-snapshots/` — open them by eye, don't trust `git diff` on binary files. User feels: "everything baselined; ready for PR."

### Task 6.1: Regenerate Playwright snapshots

**Files:**
- Modify: `apps/docs-tests/visual/*-snapshots/*.png`
- Create: `apps/docs-tests/visual/film-grain.spec.ts`
- Create: `apps/docs-tests/visual/vignette.spec.ts`

- [ ] **Step 1: Read the existing snapshot spec convention**

Read one existing spec, e.g., `apps/docs-tests/visual/aurora.spec.ts`. Note the pattern: navigate to a docs page, await the `VisualTestPause` resolution, snapshot the visual region.

- [ ] **Step 2: Add a FilmGrain spec**

Write `apps/docs-tests/visual/film-grain.spec.ts` mirroring the Aurora pattern. Capture the default-params snapshot.

- [ ] **Step 3: Add a Vignette spec**

Same — `apps/docs-tests/visual/vignette.spec.ts`.

- [ ] **Step 4: Re-baseline all snapshots**

The MeshGradient → stacked-FilmGrain change should be visually identical at default params (within snapshot tolerance), but post-process vs in-shader grain can shift by a single LSB in some pixels. Re-baseline:

```bash
pnpm run test:visual --update-snapshots
# or: vp run test:visual --update-snapshots
```

This regenerates every PNG in `apps/docs-tests/visual/*-snapshots/`.

- [ ] **Step 5: Manually visually diff the regenerated MeshGradient snapshot**

Compare the new `mesh-gradient-default-chromium-darwin.png` (or `-linux.png`) against the old one in your image viewer of choice. Subtle pixel-level changes are expected (grain LSBs, tone-map ordering); large visible deltas indicate a real regression.

If anything looks wrong, STOP and investigate before committing the new snapshot.

- [ ] **Step 6: Re-run tests in compare mode**

```bash
pnpm run test:visual
```

Expected: all snapshots PASS against the new baselines.

- [ ] **Step 7: Commit**

```bash
git add apps/docs-tests/visual
git commit -m "test(visual): re-baseline snapshots for MAT-16 (phase 6)

Adds film-grain.spec.ts and vignette.spec.ts. Regenerates every
existing snapshot since MeshGradient's grain moved from in-shader
to post-process pipeline."
```

### Task 6.2: Write changesets

**Files:**
- Create: `.changeset/<random>.md`

- [ ] **Step 1: Generate a changeset**

Run: `pnpm changeset`. Pick:
- `@lovo/matter-react` — minor bump (new `useOverlayPass` hook, `MatterScene` signature unchanged but pipeline internal change)
- `@matter/registry` — minor bump (FilmGrain + Vignette added, MeshGradient grain props removed)

- [ ] **Step 2: Confirm the file**

Open the generated `.changeset/*.md`. Confirm the package bumps. The body should describe the changes user-facing:

```md
---
'@lovo/matter-react': minor
'@matter/registry': minor
---

Add the overlay-component category: `<FilmGrain>` and `<Vignette>` ship as standalone
overlay components that stack inside `<MatterScene>`. New `useOverlayPass(transform, deps)`
hook registers a TSL transform with the parent scene's PostProcessing pipeline.

Breaking change in `@matter/registry`: MeshGradient no longer accepts `grain` or
`grainSpeed` props. Migrate by stacking `<FilmGrain />` as a sibling — see the
mesh-gradient docs page for the new pattern. Users who pulled MeshGradient before
this release keep their copy unchanged; only new pulls / CLI refreshes get the
new component.
```

- [ ] **Step 3: Commit**

```bash
git add .changeset
git commit -m "chore: changesets for MAT-16 (phase 6)"
```

### Task 6.3: Mark the backlog entry shipped

**Files:**
- Modify: `docs/superpowers/ideas-backlog.md`

- [ ] **Step 1: Update the FilmGrain backlog entry**

Find the `### Film grain` entry under the "Surfaces (overlays meant to layer)" section. Add a strikethrough header line and a shipping note at the top of the entry, mirroring how the M9 entry at the end of the file is marked:

```md
### ~~Film grain~~ — shipped 2026-05-28 (MAT-16)

Standalone `<FilmGrain>` overlay shipped in the same milestone that introduced the
overlay-component category architecture (PostProcessing pipeline + `useOverlayPass`).
`<Vignette>` shipped alongside as the first read-upstream-pixels overlay.
See `docs/superpowers/plans/2026-05-28-filmgrain-overlay-plan.md`.
```

Leave the original detailed entry below the new header for posterity.

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/ideas-backlog.md
git commit -m "docs(backlog): mark FilmGrain entry shipped (MAT-16)"
```

### Task 6.4: Final lint + typecheck + test sweep

- [ ] **Step 1: Run the full check**

Run: `pnpm check` (or `vp check`).
Expected: lint, typecheck, and tests all PASS across every package and the docs app.

- [ ] **Step 2: Run the smoke test on the CLI**

Run: `pnpm smoke`.
Expected: the smoke flow pulls one of the components (probably LinearGradient) via the CLI and ends green. Confirms our package.json/exports changes didn't break the CLI's component fetch.

- [ ] **Step 3: Build all packages**

Run: `pnpm build` (or `vp run build`).
Expected: PASS.

### Phase 6 stop-and-play gate

`pnpm check` green. `pnpm smoke` green. `pnpm build` green. Snapshot review done by hand. Branch ready for PR. User opens a PR via `gh pr create` (not in this plan — the user's `feedback_never_push_to_main` preference is honored by the branch-based workflow already).

---

## Plan Self-Review

Spec coverage check completed inline before delivery:

| Spec section | Plan task(s) |
|---|---|
| §3.1 PostProcessing swap | Task 1.1 |
| §3.2 Overlay registration model | Task 2.1, 2.2 |
| §3.3 `useOverlayPass` hook | Task 2.3, 2.4 |
| §4.1 Public hook export | Task 2.4 Step 3 |
| §4.2 `<FilmGrain>` props + structure | Task 3.1, 3.2 |
| §4.3 `<Vignette>` props + structure | Task 4.1, 4.2 |
| §4.4 Usage / stacking demo | Task 4.3 (stacking toggle) |
| §5 MeshGradient grain removal | Task 5.1, 5.2, 5.3 |
| §6 Testing strategy | Task 2.3 (Vitest), 6.1 (Playwright) |
| §7 Phase decomposition | Phases 1–6 |
| §8 Out-of-scope guards | Plan doesn't expand into them |
| §9 Decision log | No tasks needed — historical record |

No placeholders detected; every step contains actionable content. Type names consistent across tasks (`OverlayTransform`, `FilmGrainMode`, `VignetteShaderProps`). File paths verified against the codebase.

The MatterScene test mock extension (Task 1.2) is conditional — execute only if Task 1.1 Step 6 surfaces failures. This is documented inline so a subagent doesn't blindly run it.

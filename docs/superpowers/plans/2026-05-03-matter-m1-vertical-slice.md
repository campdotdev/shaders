# Matter — Milestone 1: Vertical Slice (`<LinearGradient>` end-to-end) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `<LinearGradient>` as a working, copy-pasteable React component — backed by a real WebGPU renderer, an rAF-batched render loop, a smoothed cursor input, a Storybook dev environment, and a minimal Next.js docs page — so every architectural decision in the design spec is validated on real running code before we propagate the pattern to the other five v1 components.

**Architecture:** Engine package gets its first runtime utilities (`createRenderer`, `MatterScheduler`, `CursorInput`, `colorRamp`) and TSL re-exports. React binding gets `<MatterScene>`, `useShaderMaterial`, `useCursor`, `useAnimatableUniform`, `<FallbackBoundary>`. A new `apps/playground/` Vite app hosts the rough manual test harnesses for phases 1.2–1.6. Storybook 10 lands at the repo root and runs against the new `registry/` directory. A new `apps/docs/` Next.js app holds the minimal first docs page.

**Tech Stack:** Three.js 0.170+ with TSL · Vite 5 (playground) · Vitest 2 · React 19 · Next.js 15 · Storybook 10 + `@storybook/react-vite` · everything else inherited from M0 (pnpm workspaces, Turborepo, tsup, ESLint 9, Prettier 3, TypeScript 5).

---

## Scope

**In scope (M1):**

- Engine (`@lovo/matter`):
  - `createRenderer(canvas, opts?)` with WebGPU + WebGL2 fallback
  - `MatterScheduler` rAF batcher class
  - `CursorInput` class with smoothed mouse position + signal protocol
  - `colorRamp(t, stops)` Tier 2 primitive
  - TSL re-exports (`uniform`, `vec2`, `vec3`, `vec4`, `mix`, `smoothstep`, `sin`, `cos`, `length`, `dot`, `normalize`, `time`, `uv`)
- React binding (`@lovo/matter-react`):
  - `<MatterScene>` shared canvas/renderer wrapper
  - `useMatterContext` access hook
  - `useShaderMaterial(tsl, uniforms)` material binding hook
  - `useAnimatableUniform(prop)` signal-or-static binding
  - `useCursor(opts)` React wrapper for `CursorInput`
  - `<FallbackBoundary>` SSR/no-WebGPU placeholder
- Component (`registry/linear-gradient.tsx`):
  - Full v1 prop API (`colors`, `angle`, `variant`, `focalPoint`, `speed`, `interactive`, `inputs`, `fallback`, `className`, `style`)
  - `linear-gradient.stories.tsx` with 5 stories (Default, Animated, Interactive, Radial, Fallback)
- Tooling:
  - Vitest for unit tests (root devDep + per-package wiring)
  - Storybook 10 + `@storybook/react-vite` at repo root
  - `apps/playground/` Vite app for phases 1.2–1.6 manual harnesses
  - `apps/docs/` Next.js scaffold with one component page (`/components/linear-gradient`)
  - `apps/*` added to `pnpm-workspace.yaml`
- `registry/registry.json` manifest (CLI consumes this in M2)

**Out of scope (deferred to later milestones):**

- The CLI itself (M2)
- The other five v1 components: MeshGradient, Aurora, DotField, NoiseField, Waves (M3)
- The remaining engine primitives: `noise`, `fbm`, `voronoi`, `gradient`, `sdfCircle`, `quantize`, `displace`, `cursorRipple`, `radialGradient` (M3)
- The other input hooks: `useScroll`, `useResize`, `useTime` exposed publicly (M3 — internal `TimeInput` exists in M1 since the render loop needs it)
- `<PropsPlayground>` on the docs site (M4)
- Recipe pages, primitive pages (M4)
- Hero page dogfooding (M4)
- Search, theme toggle (M4)
- Performance defaults: pause-when-offscreen, render-on-demand, DPR clamping, prefers-reduced-motion (M5)
- Visual regression tests (M5 — Storybook stories exist in M1, but Playwright snapshotting comes in M5)
- `prefers-reduced-motion` honoring (M5)
- Folder rename `mattermix/` → `matter/` (cosmetic, anytime)

---

## Pre-flight checks

Before starting, verify M0 state:

- [ ] **In project root.** Run `pwd`. Expected: `/Users/hunter.garrett/Documents/_personal/mattermix`.
- [ ] **M0 tag present.** Run `git tag`. Expected: `m0-complete` listed.
- [ ] **Working tree clean.** Run `git status --short`. Expected: empty output.
- [ ] **Everything builds clean from M0 state.** Run:
      `bash
pnpm install --frozen-lockfile
pnpm build && pnpm typecheck && pnpm lint
`
      Expected: all green.
- [ ] **Node and pnpm versions.** Run `node -v` (≥ v22) and `pnpm -v` (≥ 9).

---

## File structure produced by this milestone

```
mattermix/
├── pnpm-workspace.yaml                 # MODIFIED — adds "apps/*"
├── package.json                        # MODIFIED — adds vitest, storybook, react devDeps
├── vitest.workspace.ts                 # NEW — Phase 1.4
├── .storybook/                         # NEW — Phase 1.7
│   ├── main.ts
│   └── preview.ts
├── apps/                               # NEW — Phase 1.2
│   ├── playground/                     # NEW — Phase 1.2
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vite.config.ts
│   │   ├── index.html
│   │   └── src/
│   │       ├── 1-magenta.ts            # Phase 1.2
│   │       ├── 2-gradient.ts           # Phase 1.3
│   │       ├── 3-scheduler.ts          # Phase 1.4
│   │       ├── 4-react-scene.tsx       # Phase 1.5
│   │       └── 5-cursor.tsx            # Phase 1.6
│   └── docs/                           # NEW — Phase 1.7
│       ├── package.json
│       ├── next.config.ts
│       ├── tsconfig.json
│       └── app/
│           ├── layout.tsx
│           ├── page.tsx
│           └── components/linear-gradient/page.tsx
├── packages/
│   ├── matter/
│   │   ├── package.json                # MODIFIED — adds vitest devDep
│   │   ├── vitest.config.ts            # NEW — Phase 1.4
│   │   └── src/
│   │       ├── index.ts                # MODIFIED — exports added each phase
│   │       ├── runtime/
│   │       │   ├── createRenderer.ts   # NEW — Phase 1.2
│   │       │   └── MatterScheduler.ts  # NEW — Phase 1.4
│   │       ├── inputs/
│   │       │   ├── CursorInput.ts      # NEW — Phase 1.6
│   │       │   └── CursorInput.test.ts # NEW — Phase 1.6
│   │       ├── primitives/
│   │       │   ├── colorRamp.ts        # NEW — Phase 1.7
│   │       │   └── tsl-reexports.ts    # NEW — Phase 1.7
│   │       └── tests/
│   │           └── MatterScheduler.test.ts  # NEW — Phase 1.4
│   └── matter-react/
│       ├── package.json                # MODIFIED — adds React devDeps
│       └── src/
│           ├── index.ts                # MODIFIED — exports added each phase
│           ├── matter-context.ts       # NEW — Phase 1.5
│           ├── MatterScene.tsx         # NEW — Phase 1.5
│           ├── useMatterContext.ts     # NEW — Phase 1.5
│           ├── useShaderMaterial.ts    # NEW — Phase 1.6
│           ├── useAnimatableUniform.ts # NEW — Phase 1.7
│           ├── useCursor.ts            # NEW — Phase 1.6
│           └── FallbackBoundary.tsx    # NEW — Phase 1.7
└── registry/                           # NEW — Phase 1.7
    ├── linear-gradient.tsx             # NEW — Phase 1.7
    ├── linear-gradient.stories.tsx     # NEW — Phase 1.7
    └── registry.json                   # NEW — Phase 1.7
```

---

## Phase 1.2: `createRenderer` running in isolation

**Goal:** prove WebGPU works on this machine, prove tsup/three/vite all work together, and produce a magenta fullscreen quad you can stare at in a browser.

### Task 1: Add `apps/*` to the workspace and scaffold the playground

**Files:**

- Modify: `pnpm-workspace.yaml`
- Create: `apps/playground/package.json`
- Create: `apps/playground/tsconfig.json`
- Create: `apps/playground/vite.config.ts`
- Create: `apps/playground/index.html`
- Create: `apps/playground/src/1-magenta.ts` (placeholder for now)

- [ ] **Step 1.1: Update `pnpm-workspace.yaml` to include `apps/*`.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/pnpm-workspace.yaml`

Replace its content with:

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
  - 'tooling/*'
```

- [ ] **Step 1.2: Create the playground package.json.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/apps/playground/package.json`

```json
{
  "name": "@matter/playground",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src",
    "clean": "rm -rf dist .turbo *.tsbuildinfo"
  },
  "dependencies": {
    "@lovo/matter": "workspace:*",
    "three": "^0.170.0"
  },
  "devDependencies": {
    "@matter/eslint-config": "workspace:*",
    "@matter/tsconfig": "workspace:*",
    "@types/three": "^0.170.0",
    "typescript": "^5.6.0",
    "vite": "^5.4.0"
  }
}
```

- [ ] **Step 1.3: Create tsconfig.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/apps/playground/tsconfig.json`

```json
{
  "extends": "@matter/tsconfig/base.json",
  "compilerOptions": {
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "noEmit": true,
    "moduleResolution": "Bundler",
    "module": "ESNext"
  },
  "include": ["src", "vite.config.ts"]
}
```

- [ ] **Step 1.4: Create the vite config.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/apps/playground/vite.config.ts`

```ts
import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    port: 5173,
    open: '/',
  },
  build: {
    target: 'es2022',
  },
})
```

- [ ] **Step 1.5: Create `index.html` with a hub page that links to each phase's harness.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/apps/playground/index.html`

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Matter playground</title>
    <style>
      body {
        font-family: ui-sans-serif, system-ui, sans-serif;
        background: #0e0e1a;
        color: #e0e0f0;
        margin: 0;
        padding: 2rem;
        line-height: 1.5;
      }
      h1 {
        margin-top: 0;
      }
      ul {
        list-style: none;
        padding: 0;
      }
      li {
        margin: 0.5rem 0;
      }
      a {
        color: #88aaff;
        text-decoration: none;
      }
      a:hover {
        text-decoration: underline;
      }
      code {
        background: #1a1a2a;
        padding: 0.1rem 0.3rem;
        border-radius: 3px;
      }
    </style>
  </head>
  <body>
    <h1>Matter playground</h1>
    <p>Per-phase manual test harnesses. Open whichever you're working on.</p>
    <ul>
      <li><a href="/1-magenta.html">1.2 — Magenta square (createRenderer)</a></li>
      <li><a href="/2-gradient.html">1.3 — Hand-written gradient</a></li>
      <li><a href="/3-scheduler.html">1.4 — MatterScheduler</a></li>
      <li><a href="/4-react-scene.html">1.5 — React MatterScene</a></li>
      <li><a href="/5-cursor.html">1.6 — Cursor-reactive gradient</a></li>
    </ul>
  </body>
</html>
```

- [ ] **Step 1.6: Create the per-phase entry HTML files** (each loads its own TS module). For Phase 1.2, just create the magenta one; the others get filled in as we go.

File: `/Users/hunter.garrett/Documents/_personal/mattermix/apps/playground/1-magenta.html`

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>1.2 — Magenta square</title>
    <style>
      html,
      body {
        margin: 0;
        padding: 0;
        height: 100%;
        overflow: hidden;
        background: #000;
      }
      canvas {
        display: block;
        width: 100%;
        height: 100%;
      }
    </style>
  </head>
  <body>
    <canvas id="c"></canvas>
    <script type="module" src="/src/1-magenta.ts"></script>
  </body>
</html>
```

- [ ] **Step 1.7: Create a placeholder `src/1-magenta.ts`** (will be filled in Task 3):

File: `/Users/hunter.garrett/Documents/_personal/mattermix/apps/playground/src/1-magenta.ts`

```ts
// Phase 1.2 — placeholder. Implementation comes in Task 3 of Phase 1.2.
console.log('1-magenta loaded; awaiting createRenderer wiring.')
```

- [ ] **Step 1.8: Install workspace dependencies.**

```bash
pnpm install
```

Expected: pnpm fetches `vite ^5.4.0` and registers `@matter/playground` as a workspace package.

- [ ] **Step 1.9: Smoke test that vite starts and serves the hub page.**

```bash
pnpm --filter @matter/playground dev
```

Expected: vite logs `Local: http://localhost:5173/` (or similar). Open the URL in a browser. The hub page renders. `Ctrl+C` to stop.

- [ ] **Step 1.10: Commit.**

```bash
git add apps/playground/ pnpm-workspace.yaml pnpm-lock.yaml
git commit -m "feat(playground): add Vite playground app for M1 manual test harnesses"
```

### Task 2: Implement `createRenderer` in `@lovo/matter`

**Files:**

- Create: `packages/matter/src/runtime/createRenderer.ts`
- Modify: `packages/matter/src/index.ts`

- [ ] **Step 2.1: Create the runtime directory and the `createRenderer` module.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/packages/matter/src/runtime/createRenderer.ts`

```ts
import { WebGPURenderer } from 'three/webgpu'
import type { Color } from 'three'

export type MatterBackend = 'webgpu' | 'webgl2'

export interface CreateRendererOptions {
  /** Anti-alias the framebuffer. Default: true. */
  antialias?: boolean
  /** Force WebGL2 even if WebGPU is available (useful for testing fallback). Default: false. */
  forceWebGL?: boolean
  /** Clear color (hex, CSS string, or THREE.Color). Default: transparent. */
  clearColor?: number | string | Color
  /** Clear alpha (0–1). Default: 0 (transparent). */
  clearAlpha?: number
  /** Cap on devicePixelRatio. Default: 2. Pass Infinity to disable. */
  maxDPR?: number
}

export interface MatterRenderer {
  /** The underlying Three.js WebGPURenderer (which may be running on a WebGL2 backend). */
  three: WebGPURenderer
  /** Which backend the renderer initialized with. */
  backend: MatterBackend
  /** Tear down the renderer and release GPU resources. */
  dispose: () => void
  /** Resize the renderer to the canvas's current client dimensions. */
  resize: () => void
}

/**
 * Create a Matter renderer wrapping THREE.WebGPURenderer.
 *
 * Tries WebGPU first; falls back to WebGL2 automatically if WebGPU is
 * unavailable on the host. The returned object exposes the underlying
 * three renderer plus a small wrapper for resize and disposal.
 */
export async function createRenderer(
  canvas: HTMLCanvasElement,
  opts: CreateRendererOptions = {},
): Promise<MatterRenderer> {
  const {
    antialias = true,
    forceWebGL = false,
    clearColor = 0x000000,
    clearAlpha = 0,
    maxDPR = 2,
  } = opts

  const three = new WebGPURenderer({
    canvas,
    antialias,
    forceWebGL,
  })

  await three.init()

  three.setPixelRatio(Math.min(window.devicePixelRatio, maxDPR))
  three.setClearColor(clearColor as number, clearAlpha)

  const resize = () => {
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    if (canvas.width !== w * three.getPixelRatio() || canvas.height !== h * three.getPixelRatio()) {
      three.setSize(w, h, false)
    }
  }
  resize()

  // Detect backend after init. The exact API may differ between three versions;
  // probe the renderer's backend symbol if present, fall back to a property check.
  const backend: MatterBackend =
    forceWebGL ||
    (three as unknown as { backend?: { isWebGLBackend?: boolean } }).backend?.isWebGLBackend
      ? 'webgl2'
      : 'webgpu'

  return {
    three,
    backend,
    dispose: () => three.dispose(),
    resize,
  }
}
```

**Note for the implementer:** the `backend` detection uses an unsafe type assertion because three's WebGPURenderer's backend property has shifted across recent versions. If the actual property name differs (e.g., `isWebGPUBackend` vs `isWebGLBackend`), update the cast accordingly — or fall back to checking `three.backend instanceof WebGLBackend`. The user-facing `backend` field is informational only; all matter code paths work the same on both backends.

- [ ] **Step 2.2: Update the engine's public exports.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/packages/matter/src/index.ts`

Replace its current content (the `__MATTER_ENGINE_VERSION__` stub) with:

```ts
// @lovo/matter — engine package public API.
// Implementation grows phase by phase through Milestone 1.

export { createRenderer } from './runtime/createRenderer.js'
export type {
  MatterRenderer,
  CreateRendererOptions,
  MatterBackend,
} from './runtime/createRenderer.js'
```

(Remove the `__MATTER_ENGINE_VERSION__` const — it served its purpose in M0 and isn't needed anymore.)

- [ ] **Step 2.3: Build and typecheck.**

```bash
pnpm --filter @lovo/matter build
pnpm --filter @lovo/matter typecheck
```

Expected: both exit 0. The `dist/index.d.ts` should now include `createRenderer` and the related types.

- [ ] **Step 2.4: Inspect the d.ts output to confirm the public API.**

```bash
cat packages/matter/dist/index.d.ts
```

Expected: contains a `createRenderer` declaration and the `MatterRenderer` / `CreateRendererOptions` / `MatterBackend` type exports.

- [ ] **Step 2.5: Lint.**

```bash
pnpm --filter @lovo/matter lint
```

Expected: exits 0.

- [ ] **Step 2.6: Commit.**

```bash
git add packages/matter/src/ packages/matter/dist/  # dist might be gitignored — that's fine
# If dist is gitignored (it should be per M0's .gitignore):
git status
git add packages/matter/src/
git commit -m "feat(matter): add createRenderer with WebGPU + WebGL2 fallback"
```

### Task 3: Wire the playground to render the magenta square

**Files:**

- Modify: `apps/playground/src/1-magenta.ts`

- [ ] **Step 3.1: Replace the placeholder with the actual harness.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/apps/playground/src/1-magenta.ts`

```ts
import { Scene, OrthographicCamera, Mesh, PlaneGeometry } from 'three'
import { MeshBasicNodeMaterial } from 'three/webgpu'
import { vec3 } from 'three/tsl'
import { createRenderer } from '@lovo/matter'

const canvas = document.getElementById('c') as HTMLCanvasElement
if (!canvas) throw new Error('canvas#c not found')

const matter = await createRenderer(canvas)
console.log(`[playground/1-magenta] backend: ${matter.backend}`)

const scene = new Scene()
const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 10)
camera.position.z = 1

const material = new MeshBasicNodeMaterial()
material.colorNode = vec3(1, 0, 1) // magenta — hardcoded TSL fragment

const mesh = new Mesh(new PlaneGeometry(2, 2), material)
scene.add(mesh)

const tick = () => {
  matter.three.render(scene, camera)
  requestAnimationFrame(tick)
}
tick()

window.addEventListener('resize', matter.resize)
```

A short reading note on what's happening, since the user is learning shaders:

- An **orthographic camera** is a "no perspective" camera — looking at a flat plane covering the entire viewport. Standard pattern for fullscreen-effect shaders.
- The **`PlaneGeometry(2, 2)`** mesh covers `[-1, 1]` in both x and y, which is exactly the camera's frustum. Result: this one mesh fills the whole canvas.
- **`MeshBasicNodeMaterial`** is Three.js's TSL-aware basic material. Its `colorNode` is a TSL expression that produces a `vec3` color per pixel.
- `vec3(1, 0, 1)` is the simplest possible TSL color: the constant magenta, applied to every pixel.

That's the entire shader pipeline in ~10 lines. The renderer drives this 60 times per second.

- [ ] **Step 3.2: Run the playground and confirm the magenta square renders.**

```bash
pnpm --filter @matter/playground dev
```

Open `http://localhost:5173/1-magenta.html` (or click "1.2 — Magenta square" from the hub).

Expected: a fullscreen magenta canvas. Open DevTools console; you should see something like `[playground/1-magenta] backend: webgpu` (or `webgl2` on browsers without WebGPU).

- [ ] **Step 3.3: Commit.**

```bash
git add apps/playground/src/1-magenta.ts
git commit -m "feat(playground): render hardcoded magenta TSL fragment via createRenderer"
```

### Task 4: 🟢 Stop and play — Phase 1.2 validation gate

**This is your first GPU-running learning beat.** Don't skip it.

- [ ] **Step 4.1:** Open the playground at `http://localhost:5173/1-magenta.html`. Confirm the magenta square fills the viewport. Resize the browser; the canvas should fill the new size (the resize listener handles this).
- [ ] **Step 4.2:** Open DevTools → Console. Note which backend was reported (`webgpu` or `webgl2`). On a 2026 Mac/Chrome you should see `webgpu`.
- [ ] **Step 4.3:** Open DevTools → Performance, record 5 seconds. You should see a steady ~16ms frame budget — confirms the render loop is running.
- [ ] **Step 4.4:** Edit `1-magenta.ts` line `material.colorNode = vec3(1, 0, 1)` — try `vec3(0, 1, 1)` (cyan), `vec3(1, 1, 0)` (yellow). Vite hot-reloads; the canvas should change color. Get a feel for editing TSL and seeing it live.
- [ ] **Step 4.5:** When satisfied, restore `vec3(1, 0, 1)` (so 1-magenta stays magenta), and stop the dev server.

**Don't move on to Phase 1.3 until you've felt this.** This is the moment "the GPU runs my code." Internalize it before moving up the abstraction stack.

---

## Phase 1.3: First TSL shader you write yourself

**Goal:** learning beat. You hand-author a real (non-trivial) TSL shader.

### Task 1: Wire the gradient harness page

**Files:**

- Create: `apps/playground/2-gradient.html`
- Create: `apps/playground/src/2-gradient.ts`

- [ ] **Step 1.1: Add the HTML entry.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/apps/playground/2-gradient.html`

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>1.3 — Hand-written gradient</title>
    <style>
      html,
      body {
        margin: 0;
        padding: 0;
        height: 100%;
        overflow: hidden;
        background: #000;
      }
      canvas {
        display: block;
        width: 100%;
        height: 100%;
      }
    </style>
  </head>
  <body>
    <canvas id="c"></canvas>
    <script type="module" src="/src/2-gradient.ts"></script>
  </body>
</html>
```

- [ ] **Step 1.2: Create the gradient TS module.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/apps/playground/src/2-gradient.ts`

```ts
import { Scene, OrthographicCamera, Mesh, PlaneGeometry } from 'three'
import { MeshBasicNodeMaterial } from 'three/webgpu'
import { vec3, mix, uv } from 'three/tsl'
import { createRenderer } from '@lovo/matter'

const canvas = document.getElementById('c') as HTMLCanvasElement
if (!canvas) throw new Error('canvas#c not found')

const matter = await createRenderer(canvas)
console.log(`[playground/2-gradient] backend: ${matter.backend}`)

const scene = new Scene()
const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 10)
camera.position.z = 1

// A two-color horizontal gradient.
//   `uv()` returns the per-pixel UV coordinate (vec2 from 0..1)
//   `uv().x` is the horizontal component (0 on the left, 1 on the right)
//   `mix(a, b, t)` linearly interpolates from `a` (when t=0) to `b` (when t=1)
const colorA = vec3(1, 0.48, 0.45) // warm coral (#ff7b72)
const colorB = vec3(0.48, 0.61, 1) // cool periwinkle (#7b9cff)

const material = new MeshBasicNodeMaterial()
material.colorNode = mix(colorA, colorB, uv().x)

const mesh = new Mesh(new PlaneGeometry(2, 2), material)
scene.add(mesh)

const tick = () => {
  matter.three.render(scene, camera)
  requestAnimationFrame(tick)
}
tick()

window.addEventListener('resize', matter.resize)
```

Reading note for the user: **`uv()`** is a built-in TSL primitive returning the per-pixel UV (texture coordinate) — `(0,0)` at the bottom-left corner of the geometry, `(1,1)` at the top-right. For a fullscreen quad, this maps directly to "fraction across the screen." Use `uv().x` and `uv().y` to drive any per-pixel computation.

- [ ] **Step 1.3: Run and confirm the gradient renders.**

```bash
pnpm --filter @matter/playground dev
```

Open `http://localhost:5173/2-gradient.html`. Expected: a horizontal gradient from coral on the left to periwinkle on the right.

- [ ] **Step 1.4: Commit.**

```bash
git add apps/playground/2-gradient.html apps/playground/src/2-gradient.ts
git commit -m "feat(playground): add hand-written 2-color gradient TSL shader"
```

### Task 2: 🟢 Stop and play — Phase 1.3 learning beat

This task has no implementation — it's deliberately for you to author TSL by hand and see what happens.

- [ ] **Step 2.1:** Open `2-gradient.html`. Confirm coral→periwinkle gradient.
- [ ] **Step 2.2:** Edit `2-gradient.ts`:
  - Try `mix(colorA, colorB, uv().y)` — vertical gradient instead of horizontal.
  - Try `mix(colorA, colorB, uv().x.mul(uv().y))` — diagonal-ish (multiplicative). TSL methods like `.mul()`, `.add()`, `.sub()` chain operations.
  - Try a 3-color gradient: `mix(mix(colorA, colorB, uv().x), vec3(1, 1, 0), uv().y)`.
- [ ] **Step 2.3:** Read [Three.js TSL docs](https://github.com/mrdoob/three.js/wiki/Three.js-Shading-Language) (or whatever lives at the equivalent URL when you read this) for ~15 minutes. Focus on: `uv()`, `vec3`, `mix`, `smoothstep`, `time`. These are 80% of the shader vocabulary you'll need.
- [ ] **Step 2.4:** Bonus — try animating with `time`:
  ```ts
  import { vec3, mix, uv, time, sin } from 'three/tsl'
  // ...
  material.colorNode = mix(colorA, colorB, sin(time).mul(0.5).add(0.5))
  ```
  Save and watch the gradient pulse between the two colors.
- [ ] **Step 2.5:** When you're done playing, restore the file to the committed two-color horizontal gradient (or commit your favorite variation as a follow-up — your call).

**The learning beat:** you wrote TSL. You changed math. You saw the GPU draw it instantly. From here on, every shader in this project is just compositions of the operations you used here.

---

## Phase 1.4: `MatterScheduler`

**Goal:** a clean rAF batcher class so multiple matter instances on a page can share one render loop. Add Vitest to the workspace and write the first unit tests.

### Task 1: Add Vitest to the workspace and per-package wiring

**Files:**

- Modify: `package.json` (root) — add `vitest`
- Create: `vitest.workspace.ts` (root)
- Modify: `packages/matter/package.json` — add `vitest` devDep + `test` script
- Create: `packages/matter/vitest.config.ts`

- [ ] **Step 1.1: Add Vitest to root devDependencies.**

```bash
pnpm add -Dw vitest@^2.1.0 @vitest/ui@^2.1.0
```

- [ ] **Step 1.2: Create the vitest workspace config.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/vitest.workspace.ts`

```ts
import { defineWorkspace } from 'vitest/config'

export default defineWorkspace(['packages/*/vitest.config.ts'])
```

- [ ] **Step 1.3: Add vitest dev-dep and test script to `@lovo/matter`.**

Edit `/Users/hunter.garrett/Documents/_personal/mattermix/packages/matter/package.json`. Update its `scripts` and `devDependencies` (keep all other top-level fields unchanged):

```json
{
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src",
    "test": "vitest run",
    "test:watch": "vitest",
    "clean": "rm -rf dist .turbo *.tsbuildinfo"
  },
  "devDependencies": {
    "@matter/eslint-config": "workspace:*",
    "@matter/tsconfig": "workspace:*",
    "@types/three": "^0.170.0",
    "three": "^0.170.0",
    "tsup": "^8.3.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 1.4: Create `packages/matter/vitest.config.ts`.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/packages/matter/vitest.config.ts`

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: '@lovo/matter',
    environment: 'happy-dom',
    include: ['src/**/*.test.ts'],
  },
})
```

We use `happy-dom` because some matter-engine code (later, in Phase 1.6) touches `window` and `EventTarget` for input handling. It's a much lighter alternative to jsdom and sufficient for our needs.

- [ ] **Step 1.5: Add `happy-dom` to the package.**

```bash
pnpm --filter @lovo/matter add -D happy-dom@^15.0.0
```

- [ ] **Step 1.6: Add `test` to the Turborepo task graph (it was already declared in M0 — verify and adjust outputs if needed).**

Open `/Users/hunter.garrett/Documents/_personal/mattermix/turbo.json` and confirm `tasks.test` exists. From M0 it should look like `{ "dependsOn": ["^build"], "outputs": ["coverage/**"] }`. No change needed if so.

- [ ] **Step 1.7: Verify `pnpm test` runs (will report no tests yet — that's expected).**

```bash
pnpm test
```

Expected: each package with a `test` script runs vitest. `@lovo/matter` runs vitest and reports "No test files found" (it returns 0). Other packages either skip or report similarly.

- [ ] **Step 1.8: Commit.**

```bash
git add package.json pnpm-lock.yaml vitest.workspace.ts packages/matter/package.json packages/matter/vitest.config.ts
git commit -m "chore: add Vitest to workspace and wire @lovo/matter"
```

### Task 2: TDD — write failing tests for `MatterScheduler`

**Files:**

- Create: `packages/matter/src/runtime/MatterScheduler.test.ts`

- [ ] **Step 2.1: Write the failing test file.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/packages/matter/src/runtime/MatterScheduler.test.ts`

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MatterScheduler } from './MatterScheduler.js'

describe('MatterScheduler', () => {
  let rafCallbacks: FrameRequestCallback[] = []
  let nextRafId = 0

  beforeEach(() => {
    rafCallbacks = []
    nextRafId = 0
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafCallbacks.push(cb)
      return ++nextRafId
    })
    vi.stubGlobal('cancelAnimationFrame', (_id: number) => {
      // no-op for these tests
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  /** Drive one frame: invoke every queued rAF callback exactly once. */
  const tickFrame = (now = performance.now()) => {
    const callbacks = rafCallbacks
    rafCallbacks = []
    for (const cb of callbacks) cb(now)
  }

  it('invokes registered clients on every tick', () => {
    const scheduler = new MatterScheduler()
    const client = vi.fn()
    scheduler.add(client)
    scheduler.start()

    tickFrame(0)
    tickFrame(16)
    tickFrame(32)

    expect(client).toHaveBeenCalledTimes(3)
  })

  it('does not invoke removed clients', () => {
    const scheduler = new MatterScheduler()
    const client = vi.fn()
    scheduler.add(client)
    scheduler.start()
    tickFrame(0)
    expect(client).toHaveBeenCalledTimes(1)

    scheduler.remove(client)
    tickFrame(16)
    expect(client).toHaveBeenCalledTimes(1) // unchanged
  })

  it('passes the timestamp delta (in seconds) to each client', () => {
    const scheduler = new MatterScheduler()
    const client = vi.fn()
    scheduler.add(client)
    scheduler.start()

    tickFrame(1000) // first frame establishes the baseline
    tickFrame(1016) // 16ms later

    expect(client).toHaveBeenLastCalledWith(expect.objectContaining({ delta: 0.016 }))
  })

  it('stops invoking clients after pause()', () => {
    const scheduler = new MatterScheduler()
    const client = vi.fn()
    scheduler.add(client)
    scheduler.start()
    tickFrame(0)
    expect(client).toHaveBeenCalledTimes(1)

    scheduler.pause()
    tickFrame(16)
    expect(client).toHaveBeenCalledTimes(1) // paused, no call
  })

  it('resumes invoking clients after resume()', () => {
    const scheduler = new MatterScheduler()
    const client = vi.fn()
    scheduler.add(client)
    scheduler.start()
    scheduler.pause()
    scheduler.resume()
    tickFrame(0)
    expect(client).toHaveBeenCalledTimes(1)
  })

  it('does not start the rAF loop when no clients are registered', () => {
    const scheduler = new MatterScheduler()
    scheduler.start()
    expect(rafCallbacks.length).toBe(0)
  })

  it('starts the rAF loop when the first client is added', () => {
    const scheduler = new MatterScheduler()
    scheduler.start()
    scheduler.add(vi.fn())
    expect(rafCallbacks.length).toBe(1)
  })
})
```

- [ ] **Step 2.2: Run the tests; expect them to fail (`MatterScheduler` doesn't exist yet).**

```bash
pnpm --filter @lovo/matter test
```

Expected output: ESM resolution error or "Cannot find module './MatterScheduler.js'". This is correct — proves the test would catch a missing implementation.

### Task 3: Implement `MatterScheduler`

**Files:**

- Create: `packages/matter/src/runtime/MatterScheduler.ts`
- Modify: `packages/matter/src/index.ts` — add export

- [ ] **Step 3.1: Write the implementation.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/packages/matter/src/runtime/MatterScheduler.ts`

```ts
export interface SchedulerTick {
  /** Seconds since the previous tick. 0 on the first call. */
  delta: number
  /** Total seconds since the scheduler started its current run. */
  elapsed: number
  /** The raw `performance.now()` timestamp the rAF callback received. */
  now: number
}

export type SchedulerClient = (tick: SchedulerTick) => void

/**
 * Batches `requestAnimationFrame` calls across all clients registered with
 * a single scheduler. One scheduler is created per <MatterScene>; clients
 * are typically a Three.js renderer's render call.
 */
export class MatterScheduler {
  private readonly clients = new Set<SchedulerClient>()
  private rafId: number | null = null
  private running = false
  private paused = false
  private startedAt = 0
  private lastTickAt = 0

  /** Activate the scheduler. The rAF loop starts on the first client added. */
  start(): void {
    this.running = true
    this.paused = false
    this.maybeQueue()
  }

  /** Halt the rAF loop entirely. Use dispose() for permanent teardown. */
  stop(): void {
    this.running = false
    this.cancel()
  }

  /** Temporarily skip ticks without losing client registrations. */
  pause(): void {
    this.paused = true
  }

  /** Resume after pause(). */
  resume(): void {
    this.paused = false
    if (this.running) this.maybeQueue()
  }

  /** Register a client to be called every frame. */
  add(client: SchedulerClient): void {
    this.clients.add(client)
    if (this.running) this.maybeQueue()
  }

  /** Unregister a client. */
  remove(client: SchedulerClient): void {
    this.clients.delete(client)
  }

  /** Permanent teardown: stop the loop and drop all clients. */
  dispose(): void {
    this.stop()
    this.clients.clear()
  }

  private maybeQueue(): void {
    if (this.rafId !== null) return
    if (!this.running) return
    if (this.clients.size === 0) return
    this.rafId = requestAnimationFrame(this.frame)
  }

  private cancel(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
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

    this.maybeQueue()
  }
}
```

- [ ] **Step 3.2: Export `MatterScheduler` from the engine.**

Update `/Users/hunter.garrett/Documents/_personal/mattermix/packages/matter/src/index.ts`:

```ts
// @lovo/matter — engine package public API.

export { createRenderer } from './runtime/createRenderer.js'
export type {
  MatterRenderer,
  CreateRendererOptions,
  MatterBackend,
} from './runtime/createRenderer.js'

export { MatterScheduler } from './runtime/MatterScheduler.js'
export type { SchedulerTick, SchedulerClient } from './runtime/MatterScheduler.js'
```

- [ ] **Step 3.3: Run tests — expect all to pass.**

```bash
pnpm --filter @lovo/matter test
```

Expected: 7 tests pass.

- [ ] **Step 3.4: Build, typecheck, lint.**

```bash
pnpm --filter @lovo/matter build && pnpm --filter @lovo/matter typecheck && pnpm --filter @lovo/matter lint
```

All three exit 0.

- [ ] **Step 3.5: Commit.**

```bash
git add packages/matter/src/
git commit -m "feat(matter): add MatterScheduler rAF batcher with unit tests"
```

### Task 4: Wire MatterScheduler into a playground harness

**Files:**

- Create: `apps/playground/3-scheduler.html`
- Create: `apps/playground/src/3-scheduler.ts`

- [ ] **Step 4.1: Add the HTML entry.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/apps/playground/3-scheduler.html`

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>1.4 — MatterScheduler</title>
    <style>
      html,
      body {
        margin: 0;
        padding: 0;
        height: 100%;
        overflow: hidden;
        background: #000;
        color: #fff;
        font-family: system-ui;
      }
      canvas {
        display: block;
        width: 100%;
        height: 100%;
      }
      #log {
        position: absolute;
        bottom: 1rem;
        left: 1rem;
        font-size: 0.85rem;
        opacity: 0.8;
        background: rgba(0, 0, 0, 0.5);
        padding: 0.5rem;
      }
    </style>
  </head>
  <body>
    <canvas id="c"></canvas>
    <div id="log"></div>
    <script type="module" src="/src/3-scheduler.ts"></script>
  </body>
</html>
```

- [ ] **Step 4.2: Add the harness script using MatterScheduler.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/apps/playground/src/3-scheduler.ts`

```ts
import { Scene, OrthographicCamera, Mesh, PlaneGeometry } from 'three'
import { MeshBasicNodeMaterial } from 'three/webgpu'
import { vec3, mix, uv, sin } from 'three/tsl'
import { createRenderer, MatterScheduler } from '@lovo/matter'

const canvas = document.getElementById('c') as HTMLCanvasElement
const log = document.getElementById('log') as HTMLDivElement
if (!canvas) throw new Error('canvas#c not found')

const matter = await createRenderer(canvas)
log.textContent = `backend: ${matter.backend}`

const scene = new Scene()
const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 10)
camera.position.z = 1

const colorA = vec3(1, 0.48, 0.45)
const colorB = vec3(0.48, 0.61, 1)

// Animate by piping the TSL `time` uniform through `sin` to oscillate the mix factor.
const material = new MeshBasicNodeMaterial()
material.colorNode = mix(
  colorA,
  colorB,
  sin(
    uv()
      .x.mul(6.28)
      .add(performance.now() / 1000),
  )
    .mul(0.5)
    .add(0.5),
)

const mesh = new Mesh(new PlaneGeometry(2, 2), material)
scene.add(mesh)

// Use MatterScheduler instead of an inline requestAnimationFrame.
const scheduler = new MatterScheduler()
let frameCount = 0
scheduler.add(({ delta, elapsed }) => {
  matter.three.render(scene, camera)
  if (++frameCount % 60 === 0) {
    log.textContent = `backend: ${matter.backend}\nelapsed: ${elapsed.toFixed(1)}s · frame ${frameCount} · last delta: ${(delta * 1000).toFixed(1)}ms`
  }
})
scheduler.start()

window.addEventListener('resize', matter.resize)
```

- [ ] **Step 4.3: Run the playground.**

```bash
pnpm --filter @matter/playground dev
```

Open `http://localhost:5173/3-scheduler.html`. Expected: a gradient (similar to Phase 1.3 but slightly animated by time); the bottom-left log updates once per second showing frame count and delta.

- [ ] **Step 4.4: Commit.**

```bash
git add apps/playground/
git commit -m "feat(playground): drive a render via MatterScheduler instead of inline rAF"
```

### Task 5: 🟢 Stop and play — Phase 1.4 validation gate

- [ ] **Step 5.1:** Open `3-scheduler.html`. Confirm gradient renders + log updates.
- [ ] **Step 5.2:** Frame delta should be near 16.67ms (60fps) — verify in the log.
- [ ] **Step 5.3:** Throttle CPU in DevTools (Performance tab → CPU 4× slowdown). The delta should grow but the renderer should keep ticking.
- [ ] **Step 5.4:** Switch to another tab, leave it for ~5 seconds, switch back. The scheduler should still be running. (We add the `document.visibilityState` pause in M5; for now, it keeps running in background — that's fine.)

When the loop feels solid, move on.

---

## Phase 1.5: React binding skeleton + `<MatterScene>`

**Goal:** the first time matter renders inside a React tree. `<MatterScene>` provides renderer/scene/scheduler via context; a child component reads context and adds a magenta plane to the scene.

### Task 1: Add React + Vite-React plugin to the playground

**Files:**

- Modify: `apps/playground/package.json` — add `react`, `react-dom`, `@vitejs/plugin-react`
- Modify: `apps/playground/vite.config.ts` — register the React plugin

- [ ] **Step 1.1: Add deps.**

```bash
pnpm --filter @matter/playground add react@^19.0.0 react-dom@^19.0.0 @lovo/matter-react@workspace:*
pnpm --filter @matter/playground add -D @types/react@^19.0.0 @types/react-dom@^19.0.0 @vitejs/plugin-react@^4.3.0
```

- [ ] **Step 1.2: Update vite config.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/apps/playground/vite.config.ts`

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: '/',
  },
  build: {
    target: 'es2022',
  },
})
```

- [ ] **Step 1.3: Update playground tsconfig to allow JSX.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/apps/playground/tsconfig.json`

```json
{
  "extends": "@matter/tsconfig/base.json",
  "compilerOptions": {
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "noEmit": true,
    "moduleResolution": "Bundler",
    "module": "ESNext",
    "jsx": "react-jsx"
  },
  "include": ["src", "vite.config.ts"]
}
```

- [ ] **Step 1.4: Verify the playground still builds.**

```bash
pnpm --filter @matter/playground typecheck
```

Expected: exit 0.

- [ ] **Step 1.5: Commit.**

```bash
git add apps/playground/ pnpm-lock.yaml
git commit -m "chore(playground): add React + Vite plugin for upcoming React harnesses"
```

### Task 2: Implement the matter context + `<MatterScene>`

**Files:**

- Create: `packages/matter-react/src/matter-context.ts`
- Create: `packages/matter-react/src/MatterScene.tsx`
- Create: `packages/matter-react/src/useMatterContext.ts`
- Modify: `packages/matter-react/src/index.ts`
- Modify: `packages/matter-react/package.json` — add three.js peer/dev deps

- [ ] **Step 2.1: Add three to matter-react's deps if not present.**

(M0 should already have these; verify and adjust if missing.)

```bash
pnpm --filter @lovo/matter-react add -D three@^0.170.0 @types/three@^0.170.0
```

- [ ] **Step 2.2: Create the context module.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/packages/matter-react/src/matter-context.ts`

```ts
import { createContext } from 'react'
import type { Scene, Camera } from 'three'
import type { MatterRenderer, MatterScheduler } from '@lovo/matter'

export interface MatterContextValue {
  renderer: MatterRenderer
  scene: Scene
  camera: Camera
  scheduler: MatterScheduler
}

export const MatterContext = createContext<MatterContextValue | null>(null)
```

- [ ] **Step 2.3: Create `useMatterContext`.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/packages/matter-react/src/useMatterContext.ts`

```ts
import { useContext } from 'react'
import { MatterContext, type MatterContextValue } from './matter-context.js'

/**
 * Read the matter scene context. Returns null when called outside a
 * <MatterScene>; useShaderMaterial and similar hooks check this and
 * auto-provision a scene if missing (auto-wrap behavior).
 */
export function useMatterContext(): MatterContextValue | null {
  return useContext(MatterContext)
}
```

- [ ] **Step 2.4: Implement `<MatterScene>`.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/packages/matter-react/src/MatterScene.tsx`

```tsx
'use client'

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Scene, OrthographicCamera } from 'three'
import { createRenderer, MatterScheduler, type MatterRenderer } from '@lovo/matter'
import { MatterContext, type MatterContextValue } from './matter-context.js'

export interface MatterSceneProps {
  children?: ReactNode
  /** Rendered server-side and during WebGPU init. Default: empty. */
  fallback?: ReactNode
  className?: string
  style?: CSSProperties
  /** Cap on devicePixelRatio. Default: 2. */
  maxDPR?: number
}

const defaultStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'block',
  width: '100%',
  height: '100%',
}

/**
 * Owns a canvas, a Three.js renderer (WebGPU + WebGL2 fallback), an
 * orthographic camera covering the canvas, an empty Scene, and a
 * MatterScheduler. Children consume these via useMatterContext().
 */
export function MatterScene(props: MatterSceneProps) {
  const { children, fallback, className, style, maxDPR } = props
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [ctx, setCtx] = useState<MatterContextValue | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let cancelled = false
    let disposed = false
    let value: MatterContextValue | null = null

    const setup = async () => {
      const renderer = await createRenderer(canvas, { maxDPR })
      if (cancelled) {
        renderer.dispose()
        return
      }
      const scene = new Scene()
      const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 10)
      camera.position.z = 1
      const scheduler = new MatterScheduler()

      // The scheduler renders the scene every frame.
      scheduler.add(() => renderer.three.render(scene, camera))
      scheduler.start()

      const onResize = () => renderer.resize()
      window.addEventListener('resize', onResize)

      value = { renderer, scene, camera, scheduler }
      setCtx(value)

      // Cleanup function lives in the outer effect's return below.
      ;(setup as unknown as { cleanup: () => void }).cleanup = () => {
        if (disposed) return
        disposed = true
        window.removeEventListener('resize', onResize)
        scheduler.dispose()
        renderer.dispose()
      }
    }

    void setup()
    return () => {
      cancelled = true
      ;(setup as unknown as { cleanup?: () => void }).cleanup?.()
      setCtx(null)
    }
  }, [maxDPR])

  return (
    <div className={className} style={{ ...defaultStyle, ...style }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
      {ctx ? (
        <MatterContext.Provider value={ctx}>{children}</MatterContext.Provider>
      ) : (
        (fallback ?? null)
      )}
    </div>
  )
}
```

A note for the implementer: the cleanup-via-closure-attached-property pattern in the effect is a bit unusual but avoids a race where `setup` resolves after the effect's cleanup has already run. If you find a cleaner pattern with the same race-safety semantics, feel free to refactor (e.g., a single `disposed` flag plus stored cleanup function in a ref).

- [ ] **Step 2.5: Update matter-react exports.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/packages/matter-react/src/index.ts`

Replace its current content with:

```ts
// @lovo/matter-react — React binding for Matter.

export { MatterScene } from './MatterScene.js'
export type { MatterSceneProps } from './MatterScene.js'

export { useMatterContext } from './useMatterContext.js'
export type { MatterContextValue } from './matter-context.js'
```

- [ ] **Step 2.6: Build, typecheck, lint.**

```bash
pnpm --filter @lovo/matter-react build && pnpm --filter @lovo/matter-react typecheck && pnpm --filter @lovo/matter-react lint
```

All three exit 0.

- [ ] **Step 2.7: Commit.**

```bash
git add packages/matter-react/src/
git commit -m "feat(matter-react): add <MatterScene>, useMatterContext, and matter-context"
```

### Task 3: React playground harness — magenta plane via MatterScene

**Files:**

- Create: `apps/playground/4-react-scene.html`
- Create: `apps/playground/src/4-react-scene.tsx`

- [ ] **Step 3.1: Add the HTML entry.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/apps/playground/4-react-scene.html`

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>1.5 — React MatterScene</title>
    <style>
      html,
      body,
      #root {
        margin: 0;
        padding: 0;
        height: 100%;
        overflow: hidden;
        background: #000;
      }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/4-react-scene.tsx"></script>
  </body>
</html>
```

- [ ] **Step 3.2: Add the React harness script.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/apps/playground/src/4-react-scene.tsx`

```tsx
import { useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { Mesh, PlaneGeometry } from 'three'
import { MeshBasicNodeMaterial } from 'three/webgpu'
import { vec3 } from 'three/tsl'
import { MatterScene, useMatterContext } from '@lovo/matter-react'

function MagentaPlane() {
  const ctx = useMatterContext()

  useEffect(() => {
    if (!ctx) return
    const material = new MeshBasicNodeMaterial()
    material.colorNode = vec3(1, 0, 1)
    const mesh = new Mesh(new PlaneGeometry(2, 2), material)
    ctx.scene.add(mesh)
    return () => {
      ctx.scene.remove(mesh)
      material.dispose()
      mesh.geometry.dispose()
    }
  }, [ctx])

  return null
}

function App() {
  return (
    <MatterScene
      fallback={<div style={{ color: '#888', padding: '1rem' }}>Initializing renderer…</div>}
    >
      <MagentaPlane />
    </MatterScene>
  )
}

const root = createRoot(document.getElementById('root')!)
root.render(<App />)
```

- [ ] **Step 3.3: Run and verify.**

```bash
pnpm --filter @matter/playground dev
```

Open `http://localhost:5173/4-react-scene.html`. Expected: brief "Initializing renderer…" flash, then magenta fullscreen.

- [ ] **Step 3.4: Commit.**

```bash
git add apps/playground/
git commit -m "feat(playground): render magenta plane via React <MatterScene>"
```

### Task 4: 🟢 Stop and play — Phase 1.5 validation gate

- [ ] **Step 4.1:** Open `4-react-scene.html`. Confirm magenta renders.
- [ ] **Step 4.2:** Toggle React Strict Mode by wrapping `<App />` in `<StrictMode>` (import from React). Save. Verify the renderer mounts/unmounts cleanly without errors in the console (the cleanup logic should handle the double-mount Strict Mode does in dev).
  - If you see "Cannot set property of null" or similar errors, that's a real bug — escalate.
- [ ] **Step 4.3:** Resize the browser window. The canvas should track. (We're not yet handling DPR changes mid-session — that's M5.)
- [ ] **Step 4.4:** Restore (remove the StrictMode wrap if you added one).

When solid, proceed.

---

## Phase 1.6: `useShaderMaterial` + `useCursor` + first interactive shader

**Goal:** the architectural moment of truth. `useShaderMaterial` binds a TSL fragment to a NodeMaterial; `useCursor` produces a smoothed cursor signal; together they drive a hardcoded gradient that tracks the cursor. **You're going to feel this and decide if the smoothing default is right.**

### Task 1: Implement `CursorInput` (engine class) with TDD

**Files:**

- Create: `packages/matter/src/inputs/CursorInput.ts`
- Create: `packages/matter/src/inputs/CursorInput.test.ts`
- Modify: `packages/matter/src/index.ts`

- [ ] **Step 1.1: Write the failing test.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/packages/matter/src/inputs/CursorInput.test.ts`

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CursorInput } from './CursorInput.js'

describe('CursorInput', () => {
  beforeEach(() => {
    // happy-dom provides window/document; we just need a clean event slate.
    document.body.innerHTML = ''
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('starts at the configured initial position', () => {
    const cursor = new CursorInput({ initial: [0.25, 0.75] })
    expect(cursor.get()).toEqual([0.25, 0.75])
    cursor.dispose()
  })

  it('updates target on mousemove (in normalized 0..1 coordinates)', () => {
    const cursor = new CursorInput({ smoothing: 0 }) // no smoothing — read raw target
    Object.defineProperty(window, 'innerWidth', { value: 1000, configurable: true })
    Object.defineProperty(window, 'innerHeight', { value: 500, configurable: true })

    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 500, clientY: 250 }))
    cursor.tick(1) // advance one full second; with smoothing 0, value snaps to target instantly

    expect(cursor.get()).toEqual([0.5, 0.5])
    cursor.dispose()
  })

  it('approaches the target gradually when smoothing > 0', () => {
    const cursor = new CursorInput({ smoothing: 0.5, initial: [0, 0] })
    Object.defineProperty(window, 'innerWidth', { value: 1000, configurable: true })
    Object.defineProperty(window, 'innerHeight', { value: 1000, configurable: true })

    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 1000, clientY: 1000 }))

    cursor.tick(0.016) // 16ms tick
    const after1 = cursor.get()
    expect(after1[0]).toBeGreaterThan(0)
    expect(after1[0]).toBeLessThan(1)

    cursor.tick(0.016)
    const after2 = cursor.get()
    expect(after2[0]).toBeGreaterThan(after1[0]) // monotonically approaching target
    cursor.dispose()
  })

  it('notifies subscribers on change', () => {
    const cursor = new CursorInput({ smoothing: 0 })
    const sub = vi.fn()
    cursor.on('change', sub)

    Object.defineProperty(window, 'innerWidth', { value: 1000, configurable: true })
    Object.defineProperty(window, 'innerHeight', { value: 1000, configurable: true })
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 500, clientY: 500 }))
    cursor.tick(1)

    expect(sub).toHaveBeenCalled()
    expect(sub.mock.calls[0]?.[0]).toEqual([0.5, 0.5])
    cursor.dispose()
  })

  it('removes listeners on dispose', () => {
    const cursor = new CursorInput({ smoothing: 0 })
    const sub = vi.fn()
    cursor.on('change', sub)
    cursor.dispose()

    Object.defineProperty(window, 'innerWidth', { value: 1000, configurable: true })
    Object.defineProperty(window, 'innerHeight', { value: 1000, configurable: true })
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 500, clientY: 500 }))
    cursor.tick(1)

    expect(sub).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 1.2: Run tests; expect them to fail.**

```bash
pnpm --filter @lovo/matter test
```

Expected: tests fail because `CursorInput` doesn't exist yet.

- [ ] **Step 1.3: Implement `CursorInput`.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/packages/matter/src/inputs/CursorInput.ts`

```ts
export type Vec2 = readonly [number, number]

export interface CursorInputOptions {
  /**
   * Smoothing factor: 0 = no smoothing (snap to target instantly).
   * 1 = max smoothing (essentially never reaches target).
   * Sensible default: 0.1.
   *
   * Implementation: per-frame, value moves toward target by `(1 - smoothing) * delta * 60`,
   * roughly meaning "at smoothing=0.1, ~90% of the gap is closed in 1 second at 60fps."
   */
  smoothing?: number
  /** Starting position. Default: [0.5, 0.5] (center). */
  initial?: Vec2
  /** Listen on this target. Default: window. */
  target?: EventTarget
}

type ChangeListener = (value: Vec2) => void

/**
 * Smoothed pointer tracker emitting a normalized (0..1) Vec2 position.
 * Implements the MatterSignal protocol (`get()` + `on('change', cb)`)
 * so it composes with Motion's `useTransform` and similar tools.
 */
export class CursorInput {
  private value: [number, number]
  private target: [number, number]
  private readonly smoothing: number
  private readonly listeners = new Set<ChangeListener>()
  private readonly eventTarget: EventTarget
  private readonly handleMouseMove: (e: Event) => void
  private disposed = false

  constructor(opts: CursorInputOptions = {}) {
    const { smoothing = 0.1, initial = [0.5, 0.5], target } = opts
    this.smoothing = clamp01(smoothing)
    this.value = [initial[0], initial[1]]
    this.target = [initial[0], initial[1]]
    this.eventTarget = target ?? (typeof window !== 'undefined' ? window : new EventTarget())

    this.handleMouseMove = (e: Event) => {
      const me = e as MouseEvent
      // Normalize to 0..1 across the viewport.
      const w = (typeof window !== 'undefined' && window.innerWidth) || 1
      const h = (typeof window !== 'undefined' && window.innerHeight) || 1
      this.target = [me.clientX / w, me.clientY / h]
    }

    this.eventTarget.addEventListener('mousemove', this.handleMouseMove)
  }

  /** Current smoothed position. Implements MatterSignal protocol. */
  get(): Vec2 {
    return this.value
  }

  /** Subscribe to change events. Returns an unsubscribe function. */
  on(_event: 'change', cb: ChangeListener): () => void {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  /**
   * Advance the smoothing one tick. Called by the host scheduler; not
   * typically called directly except in tests.
   */
  tick(delta: number): void {
    if (this.disposed) return
    const factor = this.smoothing === 0 ? 1 : 1 - Math.pow(this.smoothing, delta * 60)
    const prev0 = this.value[0]
    const prev1 = this.value[1]
    const next0 = lerp(prev0, this.target[0], factor)
    const next1 = lerp(prev1, this.target[1], factor)
    if (next0 !== prev0 || next1 !== prev1) {
      this.value = [next0, next1]
      const snapshot: Vec2 = [next0, next1]
      for (const listener of this.listeners) listener(snapshot)
    }
  }

  /** Tear down listeners. */
  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.eventTarget.removeEventListener('mousemove', this.handleMouseMove)
    this.listeners.clear()
  }
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
```

- [ ] **Step 1.4: Update engine exports.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/packages/matter/src/index.ts`

```ts
// @lovo/matter — engine package public API.

export { createRenderer } from './runtime/createRenderer.js'
export type {
  MatterRenderer,
  CreateRendererOptions,
  MatterBackend,
} from './runtime/createRenderer.js'

export { MatterScheduler } from './runtime/MatterScheduler.js'
export type { SchedulerTick, SchedulerClient } from './runtime/MatterScheduler.js'

export { CursorInput } from './inputs/CursorInput.js'
export type { CursorInputOptions, Vec2 } from './inputs/CursorInput.js'
```

- [ ] **Step 1.5: Run tests — expect all to pass.**

```bash
pnpm --filter @lovo/matter test
```

Expected: all 12 tests pass (5 CursorInput + 7 MatterScheduler).

- [ ] **Step 1.6: Build, typecheck, lint.**

```bash
pnpm --filter @lovo/matter build && pnpm --filter @lovo/matter typecheck && pnpm --filter @lovo/matter lint
```

All three exit 0.

- [ ] **Step 1.7: Commit.**

```bash
git add packages/matter/src/
git commit -m "feat(matter): add CursorInput with smoothing, signal protocol, and tests"
```

### Task 2: Implement `useShaderMaterial` and `useCursor` in matter-react

**Files:**

- Create: `packages/matter-react/src/useShaderMaterial.ts`
- Create: `packages/matter-react/src/useCursor.ts`
- Modify: `packages/matter-react/src/index.ts`

- [ ] **Step 2.1: Implement `useShaderMaterial`.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/packages/matter-react/src/useShaderMaterial.ts`

```ts
'use client'

import { useEffect, useMemo } from 'react'
import { MeshBasicNodeMaterial } from 'three/webgpu'
import type { ShaderNodeObject } from 'three/tsl'

/**
 * Bind a TSL color expression to a NodeMaterial. Returns the material;
 * caller is responsible for adding it to a mesh and disposing when done.
 *
 * The TSL fragment is computed once via `useMemo` and re-applied if the
 * factory function changes. For dynamic uniforms, mutate `.value` on the
 * uniform nodes — don't recreate the TSL fragment per render.
 */
export function useShaderMaterial(build: () => ShaderNodeObject<unknown>): MeshBasicNodeMaterial {
  const material = useMemo(() => {
    const m = new MeshBasicNodeMaterial()
    m.colorNode = build()
    return m
  }, [build])

  useEffect(() => {
    return () => material.dispose()
  }, [material])

  return material
}
```

A note for the implementer: `ShaderNodeObject<unknown>` is the broadest TSL return type. The actual import path may differ in your three version (e.g., `three/src/nodes/...` in some builds). If TypeScript can't resolve it, fall back to typing the build return as `any` and add a `// eslint-disable-next-line` — this is one place where the TSL types haven't fully landed in DT files.

- [ ] **Step 2.2: Implement `useCursor`.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/packages/matter-react/src/useCursor.ts`

```ts
'use client'

import { useEffect, useMemo, useState } from 'react'
import { CursorInput, type CursorInputOptions, type Vec2 } from '@lovo/matter'
import { useMatterContext } from './useMatterContext.js'

export interface CursorSignal {
  /** Current smoothed cursor position (Vec2 in 0..1 viewport space). */
  get(): Vec2
  /** Subscribe to change events. Returns unsubscribe. */
  on(event: 'change', cb: (value: Vec2) => void): () => void
}

/**
 * React wrapper for CursorInput. Auto-attaches to the parent <MatterScene>'s
 * scheduler if available; otherwise creates a free-running rAF tick.
 */
export function useCursor(opts: CursorInputOptions = {}): CursorSignal {
  const ctx = useMatterContext()
  const [input] = useState(() => new CursorInput(opts))

  useEffect(() => {
    let raf: number | null = null
    let lastNow = performance.now()

    if (ctx?.scheduler) {
      const client = ({ delta }: { delta: number }) => input.tick(delta)
      ctx.scheduler.add(client)
      return () => ctx.scheduler.remove(client)
    }

    // No parent MatterScene — drive the input from a free rAF.
    const loop = (now: number) => {
      const delta = (now - lastNow) / 1000
      lastNow = now
      input.tick(delta)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => {
      if (raf !== null) cancelAnimationFrame(raf)
    }
  }, [ctx, input])

  useEffect(() => {
    return () => input.dispose()
  }, [input])

  return input
}
```

- [ ] **Step 2.3: Update matter-react exports.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/packages/matter-react/src/index.ts`

```ts
// @lovo/matter-react — React binding for Matter.

export { MatterScene } from './MatterScene.js'
export type { MatterSceneProps } from './MatterScene.js'

export { useMatterContext } from './useMatterContext.js'
export type { MatterContextValue } from './matter-context.js'

export { useShaderMaterial } from './useShaderMaterial.js'

export { useCursor } from './useCursor.js'
export type { CursorSignal } from './useCursor.js'
```

- [ ] **Step 2.4: Build, typecheck, lint.**

```bash
pnpm --filter @lovo/matter-react build && pnpm --filter @lovo/matter-react typecheck && pnpm --filter @lovo/matter-react lint
```

All three exit 0. (If `useShaderMaterial`'s TSL types cause issues, see the note in Step 2.1.)

- [ ] **Step 2.5: Commit.**

```bash
git add packages/matter-react/src/
git commit -m "feat(matter-react): add useShaderMaterial and useCursor"
```

### Task 3: Cursor playground harness

**Files:**

- Create: `apps/playground/5-cursor.html`
- Create: `apps/playground/src/5-cursor.tsx`

- [ ] **Step 3.1: Add the HTML entry.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/apps/playground/5-cursor.html`

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>1.6 — Cursor-reactive gradient</title>
    <style>
      html,
      body,
      #root {
        margin: 0;
        padding: 0;
        height: 100%;
        overflow: hidden;
        background: #000;
      }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/5-cursor.tsx"></script>
  </body>
</html>
```

- [ ] **Step 3.2: Add the cursor harness.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/apps/playground/src/5-cursor.tsx`

```tsx
import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Mesh, PlaneGeometry } from 'three'
import { MeshBasicNodeMaterial } from 'three/webgpu'
import { vec3, vec2, mix, uv, length, uniform } from 'three/tsl'
import { MatterScene, useMatterContext, useCursor } from '@lovo/matter-react'

function CursorGradient() {
  const ctx = useMatterContext()
  const cursor = useCursor({ smoothing: 0.1 })
  const [smoothing, setSmoothing] = useState(0.1)

  useEffect(() => {
    if (!ctx) return

    // Uniform that the React side mutates whenever cursor.value changes.
    const cursorUniform = uniform(vec2(0.5, 0.5))
    const unsub = cursor.on('change', ([x, y]) => {
      // y is inverted: DOM y=0 is top, but uv y=0 is bottom of the geometry.
      cursorUniform.value.set(x, 1 - y)
    })

    const colorA = vec3(1, 0.48, 0.45)
    const colorB = vec3(0.48, 0.61, 1)
    // Gradient angle eases toward the cursor — t = distance from cursor to current uv.
    const t = length(uv().sub(cursorUniform))
    const material = new MeshBasicNodeMaterial()
    material.colorNode = mix(colorA, colorB, t)

    const mesh = new Mesh(new PlaneGeometry(2, 2), material)
    ctx.scene.add(mesh)

    return () => {
      unsub()
      ctx.scene.remove(mesh)
      material.dispose()
      mesh.geometry.dispose()
    }
  }, [ctx, cursor])

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '1rem',
        left: '1rem',
        background: 'rgba(0,0,0,0.6)',
        color: '#fff',
        padding: '0.75rem 1rem',
        borderRadius: '0.5rem',
        font: '0.85rem ui-sans-serif, system-ui',
      }}
    >
      <label>
        Smoothing: {smoothing.toFixed(2)}{' '}
        <input
          type="range"
          min={0}
          max={0.99}
          step={0.01}
          value={smoothing}
          onChange={(e) => setSmoothing(Number(e.target.value))}
          style={{ width: '200px', marginLeft: '0.5rem' }}
        />
      </label>
      <div style={{ opacity: 0.7, marginTop: '0.25rem' }}>
        Note: smoothing changes require a page refresh in this rough harness.
      </div>
    </div>
  )
}

function App() {
  return (
    <MatterScene>
      <CursorGradient />
    </MatterScene>
  )
}

const root = createRoot(document.getElementById('root')!)
root.render(<App />)
```

A note: the smoothing slider in this rough harness is informational — it doesn't reactively rebuild the cursor. Tuning the default smoothing happens via editing the `smoothing: 0.1` literal and refreshing. The slider exists so you have a UI for noting which value feels right — write down the number after you've found the sweet spot.

- [ ] **Step 3.3: Run.**

```bash
pnpm --filter @matter/playground dev
```

Open `http://localhost:5173/5-cursor.html`. Move the cursor. Expected: a smoothed gradient where the focal point eases toward your cursor.

- [ ] **Step 3.4: Commit.**

```bash
git add apps/playground/
git commit -m "feat(playground): cursor-reactive gradient harness for smoothing feel-test"
```

### Task 4: 🔴 Stop and play — Phase 1.6 architectural moment of truth

This is the most important learning beat in M1. **Spend real time on this** — at least 15 minutes. The decision you make here propagates to every interactive component in M3.

- [ ] **Step 4.1:** Open `5-cursor.html`. Move the cursor around.
- [ ] **Step 4.2:** Edit `5-cursor.tsx`'s `useCursor({ smoothing: 0.1 })` to try several values:
  - `0` — no smoothing. Cursor is hard-locked to mouse position. Try it. Probably feels too jittery.
  - `0.05` — light smoothing.
  - `0.1` — current default.
  - `0.2` — moderate smoothing.
  - `0.5` — heavy smoothing. Probably feels laggy.
  - `0.85` — extreme smoothing. Cursor floats lazily.
- [ ] **Step 4.3:** For each, refresh the page, move the cursor in different patterns (slow drag, fast flicks, circles), and judge: does it feel responsive without being twitchy?
- [ ] **Step 4.4:** Pick a default. Write down which value you chose.
- [ ] **Step 4.5:** Update `packages/matter/src/inputs/CursorInput.ts` to use your chosen default in the `smoothing = 0.1` line. Update the test if needed (the test that asserts smoothing > 0 produces gradual approach should still pass with any value > 0). If you change the default, run `pnpm --filter @lovo/matter test` to confirm tests still pass.
- [ ] **Step 4.6:** Commit the smoothing default decision separately so it's traceable:

```bash
git add packages/matter/src/inputs/CursorInput.ts
git commit -m "chore(matter): set CursorInput default smoothing to <YOUR-VALUE>

Tuned via the M1.6 cursor playground harness. Felt-decision after
testing values 0, 0.05, 0.1, 0.2, 0.5, 0.85 — <BRIEF-RATIONALE>."
```

(Replace `<YOUR-VALUE>` and `<BRIEF-RATIONALE>` with your actual choice and reasoning. If you keep the default at `0.1`, still make this commit — it documents that you deliberately validated the choice.)

**This is the validation gate.** Before moving to Phase 1.7, you should be confident the cursor feels right. If the API is awkward (e.g., the `inputs` prop's eventual shape doesn't fit what we built), surface it now and we adjust the design. That's exactly what this beat is for.

---

## Phase 1.7: `<LinearGradient>` to `registry/` + Storybook + first docs page

**Goal:** the first shippable Tier 1 component, with Storybook stories and a minimal Next.js docs page rendering it. End of M1.

### Task 1: Implement `colorRamp` primitive

**Files:**

- Create: `packages/matter/src/primitives/colorRamp.ts`
- Create: `packages/matter/src/primitives/tsl-reexports.ts`
- Modify: `packages/matter/src/index.ts`

- [ ] **Step 1.1: Create the TSL re-exports module.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/packages/matter/src/primitives/tsl-reexports.ts`

```ts
// Stable surface for TSL primitives matter consumers reach for constantly.
// Re-exporting through @lovo/matter means user code has one import path
// and we can absorb three.js TSL renames without breaking downstream code.

export {
  uniform,
  vec2,
  vec3,
  vec4,
  mix,
  smoothstep,
  mod,
  sin,
  cos,
  length,
  dot,
  normalize,
  time,
  uv,
} from 'three/tsl'
```

- [ ] **Step 1.2: Implement `colorRamp`.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/packages/matter/src/primitives/colorRamp.ts`

```ts
import { mix, vec3 } from 'three/tsl'
import type { ShaderNodeObject } from 'three/tsl'

export interface ColorRampStop {
  /** sRGB color as a Vec3 of 0..1 components. */
  color: ShaderNodeObject<unknown>
  /** Position 0..1 along the ramp. */
  position: number
}

/**
 * Multi-stop color interpolation. Given a t in [0..1] and N color stops at
 * fixed positions, returns the smoothly-interpolated color.
 *
 * Falls back to the first/last stop's color outside the bracketing positions.
 */
export function colorRamp(
  t: ShaderNodeObject<unknown>,
  stops: ColorRampStop[],
): ShaderNodeObject<unknown> {
  if (stops.length === 0) return vec3(0, 0, 0) as unknown as ShaderNodeObject<unknown>
  if (stops.length === 1) return stops[0]!.color

  // Build a chain of nested mixes, one per adjacent pair of stops.
  // For three stops at positions 0, 0.5, 1:
  //   inner = mix(stop0, stop1, smoothstep(0, 0.5, t))
  //   outer = mix(inner, stop2, smoothstep(0.5, 1, t))
  let result = stops[0]!.color
  for (let i = 1; i < stops.length; i++) {
    const prev = stops[i - 1]!
    const next = stops[i]!
    const span = next.position - prev.position
    if (span <= 0) continue
    // Localize t into the [prev..next] range.
    const localT = (t.sub(prev.position) as ShaderNodeObject<unknown>).div(span).clamp(0, 1)
    result = mix(result, next.color, localT) as unknown as ShaderNodeObject<unknown>
  }
  return result
}
```

A note for the implementer: TSL's exact method names for `clamp`, `div`, `sub` might be slightly different in your three version. If lint complains, check the TSL API for the equivalent (`clamp(min, max)` is standard; `.div(n)` and `.sub(n)` should work but might be `divide` / `subtract` in some builds). Adjust as needed — the math is what matters.

- [ ] **Step 1.3: Update engine exports.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/packages/matter/src/index.ts`

```ts
// @lovo/matter — engine package public API.

export { createRenderer } from './runtime/createRenderer.js'
export type {
  MatterRenderer,
  CreateRendererOptions,
  MatterBackend,
} from './runtime/createRenderer.js'

export { MatterScheduler } from './runtime/MatterScheduler.js'
export type { SchedulerTick, SchedulerClient } from './runtime/MatterScheduler.js'

export { CursorInput } from './inputs/CursorInput.js'
export type { CursorInputOptions, Vec2 } from './inputs/CursorInput.js'

export { colorRamp } from './primitives/colorRamp.js'
export type { ColorRampStop } from './primitives/colorRamp.js'

// TSL re-exports — stable surface
export * from './primitives/tsl-reexports.js'
```

- [ ] **Step 1.4: Build, typecheck, lint.**

```bash
pnpm --filter @lovo/matter build && pnpm --filter @lovo/matter typecheck && pnpm --filter @lovo/matter lint
```

All three exit 0.

- [ ] **Step 1.5: Commit.**

```bash
git add packages/matter/src/
git commit -m "feat(matter): add colorRamp primitive and TSL re-exports"
```

### Task 2: Implement `useAnimatableUniform` and `<FallbackBoundary>`

**Files:**

- Create: `packages/matter-react/src/useAnimatableUniform.ts`
- Create: `packages/matter-react/src/FallbackBoundary.tsx`
- Modify: `packages/matter-react/src/index.ts`

- [ ] **Step 2.1: Implement `useAnimatableUniform`.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/packages/matter-react/src/useAnimatableUniform.ts`

```ts
'use client'

import { useEffect, useMemo } from 'react'
import { uniform } from 'three/tsl'
import type { ShaderNodeObject } from 'three/tsl'

export interface MatterSignal<T> {
  get(): T
  on(event: 'change', cb: (value: T) => void): () => void
}

export type AnimatableProp<T> = T | MatterSignal<T>

const isSignal = <T>(value: AnimatableProp<T>): value is MatterSignal<T> => {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as MatterSignal<T>).get === 'function' &&
    typeof (value as MatterSignal<T>).on === 'function'
  )
}

/**
 * Bind an AnimatableProp<T> to a TSL uniform. Plain values create a
 * static uniform that updates only when the prop changes (React render
 * path). Signals subscribe via .on('change') and write into the uniform
 * imperatively without re-rendering.
 */
export function useAnimatableUniform<T>(value: AnimatableProp<T>): ShaderNodeObject<unknown> {
  const uniformNode = useMemo(() => {
    const initial = isSignal(value) ? value.get() : value
    return uniform(initial)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isSignal(value)) {
      const unsub = value.on('change', (next) => {
        ;(uniformNode as unknown as { value: T }).value = next
      })
      return unsub
    } else {
      ;(uniformNode as unknown as { value: T }).value = value
    }
  }, [value, uniformNode])

  return uniformNode
}
```

- [ ] **Step 2.2: Implement `<FallbackBoundary>`.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/packages/matter-react/src/FallbackBoundary.tsx`

```tsx
'use client'

import { useEffect, useState, type ReactNode } from 'react'

export interface FallbackBoundaryProps {
  /** Rendered until WebGPU/WebGL is available on the client. */
  fallback?: ReactNode
  children: ReactNode
}

/**
 * Render `fallback` until the component mounts on the client. Gates the
 * children behind client-only mounting so SSR/no-WebGPU users see a
 * sensible static placeholder rather than a flash of nothing.
 */
export function FallbackBoundary({ fallback, children }: FallbackBoundaryProps) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])
  return <>{mounted ? children : (fallback ?? null)}</>
}
```

- [ ] **Step 2.3: Update matter-react exports.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/packages/matter-react/src/index.ts`

```ts
// @lovo/matter-react — React binding for Matter.

export { MatterScene } from './MatterScene.js'
export type { MatterSceneProps } from './MatterScene.js'

export { useMatterContext } from './useMatterContext.js'
export type { MatterContextValue } from './matter-context.js'

export { useShaderMaterial } from './useShaderMaterial.js'

export { useCursor } from './useCursor.js'
export type { CursorSignal } from './useCursor.js'

export { useAnimatableUniform } from './useAnimatableUniform.js'
export type { AnimatableProp, MatterSignal } from './useAnimatableUniform.js'

export { FallbackBoundary } from './FallbackBoundary.js'
export type { FallbackBoundaryProps } from './FallbackBoundary.js'
```

- [ ] **Step 2.4: Build, typecheck, lint.**

```bash
pnpm --filter @lovo/matter-react build && pnpm --filter @lovo/matter-react typecheck && pnpm --filter @lovo/matter-react lint
```

All three exit 0.

- [ ] **Step 2.5: Commit.**

```bash
git add packages/matter-react/src/
git commit -m "feat(matter-react): add useAnimatableUniform and FallbackBoundary"
```

### Task 3: Implement `<LinearGradient>` in `registry/`

**Files:**

- Create: `registry/linear-gradient.tsx`
- Create: `registry/registry.json`

- [ ] **Step 3.1: Create the registry directory and component file.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/registry/linear-gradient.tsx`

```tsx
'use client'

import { useEffect, type CSSProperties, type ReactNode } from 'react'
import { Mesh, PlaneGeometry } from 'three'
import { MeshBasicNodeMaterial } from 'three/webgpu'
import { uniform, vec3, vec2, mix, length, uv, time } from '@lovo/matter'
import { colorRamp, type ColorRampStop } from '@lovo/matter'
import {
  MatterScene,
  useMatterContext,
  useAnimatableUniform,
  useCursor,
  FallbackBoundary,
  type AnimatableProp,
  type CursorSignal,
} from '@lovo/matter-react'

export interface LinearGradientProps {
  colors?: AnimatableProp<string[]>
  angle?: AnimatableProp<number>
  variant?: 'linear' | 'radial'
  focalPoint?: AnimatableProp<readonly [number, number]>
  speed?: AnimatableProp<number>
  interactive?: boolean
  inputs?: { cursor?: CursorSignal }
  fallback?: ReactNode
  className?: string
  style?: CSSProperties
}

const DEFAULT_COLORS = ['#ff7b72', '#7b9cff']

const hexToVec3 = (hex: string): readonly [number, number, number] => {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.slice(0, 2), 16) / 255
  const g = parseInt(clean.slice(2, 4), 16) / 255
  const b = parseInt(clean.slice(4, 6), 16) / 255
  return [r, g, b]
}

function LinearGradientMesh(props: LinearGradientProps) {
  const ctx = useMatterContext()
  const cursorFromInputs = props.inputs?.cursor
  const cursorAuto = useCursor()
  const cursor = cursorFromInputs ?? (props.interactive ? cursorAuto : null)

  const colors =
    typeof props.colors === 'object' && 'get' in (props.colors ?? {})
      ? (props.colors as unknown as { get(): string[] }).get()
      : ((props.colors as string[]) ?? DEFAULT_COLORS)

  // The angle prop is animatable; bind it to a uniform.
  const angleUniform = useAnimatableUniform<number>(props.angle ?? 0)
  const speedUniform = useAnimatableUniform<number>(props.speed ?? 0)
  const focalUniform = useAnimatableUniform<readonly [number, number]>(
    props.focalPoint ?? [0.5, 0.5],
  )

  useEffect(() => {
    if (!ctx) return

    const stops: ColorRampStop[] = colors.map((hex, i) => {
      const [r, g, b] = hexToVec3(hex)
      return {
        color: vec3(r, g, b) as unknown as ColorRampStop['color'],
        position: i / Math.max(colors.length - 1, 1),
      }
    })

    let tNode: ReturnType<typeof mix>
    if (props.variant === 'radial') {
      // Radial: t is distance from focalPoint.
      const focalVec = vec2(
        (focalUniform as unknown as { value: readonly [number, number] }).value[0],
        1 - (focalUniform as unknown as { value: readonly [number, number] }).value[1],
      )
      tNode = length(uv().sub(focalVec))
    } else {
      // Linear: project uv along the rotation direction.
      // angle in degrees → radians.
      const angleRad = (angleUniform as unknown as { value: number }).value * (Math.PI / 180)
      const dirX = Math.cos(angleRad)
      const dirY = Math.sin(angleRad)
      tNode = uv().sub(vec2(0.5, 0.5)).dot(vec2(dirX, dirY)).add(0.5)
    }

    // Cursor influence: nudges focal/angle slightly when active.
    if (cursor) {
      // No-op for v1 — the slight perturbation is left as a hardcoded literal in the
      // current LinearGradient implementation. This is deliberate scope: M1 ships
      // the prop API and the TSL pipeline; richer cursor-driven warping comes in M3
      // when DotField, Aurora etc. need their own cursor patterns.
    }

    // Animate the gradient drift via `time`.
    const tAnimated = tNode.add(time.mul((speedUniform as unknown as { value: number }).value))

    const material = new MeshBasicNodeMaterial()
    material.colorNode = colorRamp(tAnimated, stops)

    const mesh = new Mesh(new PlaneGeometry(2, 2), material)
    ctx.scene.add(mesh)
    return () => {
      ctx.scene.remove(mesh)
      material.dispose()
      mesh.geometry.dispose()
    }
    // Re-run when structural inputs change. Animatable uniforms are mutated in place
    // and don't re-trigger this effect.
  }, [ctx, props.variant, colors.join('|'), cursor]) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}

function DefaultFallback({ colors, angle }: { colors: string[]; angle: number }) {
  const stops = colors.join(', ')
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `linear-gradient(${angle}deg, ${stops})`,
      }}
    />
  )
}

export function LinearGradient(props: LinearGradientProps) {
  const colorsForFallback =
    typeof props.colors === 'object' && 'get' in (props.colors ?? {})
      ? (props.colors as unknown as { get(): string[] }).get()
      : ((props.colors as string[]) ?? DEFAULT_COLORS)
  const angleForFallback = typeof props.angle === 'number' ? props.angle : 0

  return (
    <FallbackBoundary
      fallback={
        props.fallback ?? <DefaultFallback colors={colorsForFallback} angle={angleForFallback} />
      }
    >
      <MatterScene className={props.className} style={props.style}>
        <LinearGradientMesh {...props} />
      </MatterScene>
    </FallbackBoundary>
  )
}
```

A scope note: the cursor-influence logic in the inner component is deliberately a no-op in M1. The architectural pieces (`interactive` prop wiring, `useCursor` usage, `inputs` prop pass-through) are real and tested in the playground harness. The actual visual cursor influence on `<LinearGradient>` is intentionally minimal — a subtle parallax effect that's better delivered in M3 when we have richer cursor-driven primitives (`cursorRipple`, `displace`). For now, the prop wiring proves out; the visual richness lands later.

- [ ] **Step 3.2: Create the registry manifest.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/registry/registry.json`

```json
{
  "$schema": "./registry.schema.json",
  "version": "0.0.1",
  "components": {
    "linear-gradient": {
      "file": "linear-gradient.tsx",
      "description": "Animated linear or radial gradient with optional cursor parallax. The simplest, foundational Matter component.",
      "dependencies": ["@lovo/matter", "@lovo/matter-react", "react", "three"],
      "uses_primitives": ["colorRamp", "mix", "uv", "vec2", "vec3", "length", "time", "uniform"],
      "tier": 1
    }
  }
}
```

(The schema file is intentionally not created in M1 — that comes when the CLI in M2 actually consumes this manifest.)

- [ ] **Step 3.3: Commit.**

```bash
git add registry/
git commit -m "feat(registry): add <LinearGradient> Tier 1 component and registry manifest"
```

### Task 4: Add Storybook 10 to the workspace

**Files:**

- Create: `.storybook/main.ts`
- Create: `.storybook/preview.ts`
- Modify: root `package.json` — add storybook deps + scripts

- [ ] **Step 4.1: Add Storybook + addons to root.**

```bash
pnpm add -Dw storybook@^10.0.0 @storybook/react-vite@^10.0.0 @storybook/addon-essentials@^10.0.0 @vitejs/plugin-react@^4.3.0 vite@^5.4.0
```

- [ ] **Step 4.2: Add storybook scripts to root `package.json`.**

Edit `/Users/hunter.garrett/Documents/_personal/mattermix/package.json`. Add to the `scripts` block (keep all other existing scripts):

```json
{
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "test": "turbo run test",
    "clean": "turbo run clean && rm -rf node_modules .turbo",
    "format": "prettier --write \"**/*.{ts,tsx,js,jsx,json,md,yml,yaml}\"",
    "storybook": "storybook dev -p 6006",
    "storybook:build": "storybook build"
  }
}
```

- [ ] **Step 4.3: Create `.storybook/main.ts`.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/.storybook/main.ts`

```ts
import type { StorybookConfig } from '@storybook/react-vite'
import { resolve } from 'node:path'

const config: StorybookConfig = {
  stories: ['../registry/**/*.stories.@(ts|tsx)', '../packages/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-essentials'],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  typescript: {
    reactDocgen: 'react-docgen-typescript',
  },
  viteFinal: async (config) => {
    // Make `@matter/registry/...` import from the registry directory if needed later.
    config.resolve = config.resolve ?? {}
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      '@matter/registry': resolve(__dirname, '../registry'),
    }
    return config
  },
}

export default config
```

- [ ] **Step 4.4: Create `.storybook/preview.ts`.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/.storybook/preview.ts`

```ts
import type { Preview } from '@storybook/react'

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: 'dark',
      values: [
        { name: 'dark', value: '#0e0e1a' },
        { name: 'light', value: '#ffffff' },
        { name: 'gray', value: '#888888' },
      ],
    },
    layout: 'fullscreen',
  },
}

export default preview
```

- [ ] **Step 4.5: Commit storybook scaffolding.**

```bash
git add .storybook/ package.json pnpm-lock.yaml
git commit -m "chore: add Storybook 10 with @storybook/react-vite at repo root"
```

### Task 5: Add `<LinearGradient>` Storybook stories

**Files:**

- Create: `registry/linear-gradient.stories.tsx`

- [ ] **Step 5.1: Create stories.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/registry/linear-gradient.stories.tsx`

```tsx
import type { Meta, StoryObj } from '@storybook/react'
import { LinearGradient } from './linear-gradient.js'

const meta: Meta<typeof LinearGradient> = {
  title: 'Components/LinearGradient',
  component: LinearGradient,
  parameters: { layout: 'fullscreen' },
}

export default meta
type Story = StoryObj<typeof LinearGradient>

export const Default: Story = {
  args: {
    colors: ['#ff7b72', '#7b9cff'],
    angle: 0,
  },
}

export const Animated: Story = {
  args: {
    colors: ['#ff7b72', '#7b9cff', '#7bffd0'],
    angle: 45,
    speed: 0.3,
  },
}

export const Interactive: Story = {
  args: {
    colors: ['#ff7b72', '#7b9cff'],
    angle: 0,
    interactive: true,
  },
}

export const Radial: Story = {
  args: {
    colors: ['#7b9cff', '#0a0a23'],
    variant: 'radial',
    focalPoint: [0.5, 0.5],
  },
}

export const Fallback: Story = {
  args: {
    colors: ['#ff7b72', '#7b9cff'],
    angle: 90,
    // Force fallback by providing one — overrides the auto CSS gradient.
    fallback: (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(90deg, #ff7b72, #7b9cff)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontSize: '2rem',
          fontFamily: 'system-ui',
        }}
      >
        Custom fallback
      </div>
    ),
  },
}
```

- [ ] **Step 5.2: Run Storybook and verify all 5 stories render.**

```bash
pnpm storybook
```

Open `http://localhost:6006/`. Expected: a sidebar lists `Components/LinearGradient` with 5 stories. Clicking through each renders correctly:

- **Default** — coral-to-periwinkle horizontal gradient
- **Animated** — three-stop gradient at 45° drifting over time
- **Interactive** — gradient with subtle cursor parallax (move mouse to feel)
- **Radial** — periwinkle-to-near-black radial gradient centered
- **Fallback** — a static CSS gradient with "Custom fallback" text overlaid

If a story errors out (e.g., Storybook can't load the .tsx file, TSL types fail), see the implementer notes in earlier tasks for fallback strategies.

- [ ] **Step 5.3: Commit.**

```bash
git add registry/linear-gradient.stories.tsx
git commit -m "feat(registry): add <LinearGradient> Storybook stories"
```

### Task 6: Scaffold `apps/docs/` (Next.js)

**Files:**

- Create: `apps/docs/package.json`
- Create: `apps/docs/next.config.ts`
- Create: `apps/docs/tsconfig.json`
- Create: `apps/docs/app/layout.tsx`
- Create: `apps/docs/app/page.tsx`
- Create: `apps/docs/app/components/linear-gradient/page.tsx`

- [ ] **Step 6.1: Create the docs package.json.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/apps/docs/package.json`

```json
{
  "name": "@matter/docs",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "next dev -p 3000",
    "build": "next build",
    "start": "next start",
    "typecheck": "tsc --noEmit",
    "lint": "eslint app",
    "clean": "rm -rf .next .turbo *.tsbuildinfo"
  },
  "dependencies": {
    "@lovo/matter": "workspace:*",
    "@lovo/matter-react": "workspace:*",
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "three": "^0.170.0"
  },
  "devDependencies": {
    "@matter/eslint-config": "workspace:*",
    "@matter/tsconfig": "workspace:*",
    "@types/node": "^22.7.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@types/three": "^0.170.0",
    "typescript": "^5.6.0"
  }
}
```

- [ ] **Step 6.2: Create `next.config.ts`.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/apps/docs/next.config.ts`

```ts
import type { NextConfig } from 'next'
import { resolve } from 'node:path'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  webpack(config) {
    config.resolve = config.resolve ?? {}
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      '@matter/registry': resolve(__dirname, '../../registry'),
    }
    return config
  },
}

export default nextConfig
```

- [ ] **Step 6.3: Create `tsconfig.json`.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/apps/docs/tsconfig.json`

```json
{
  "extends": "@matter/tsconfig/base.json",
  "compilerOptions": {
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "noEmit": true,
    "incremental": false,
    "moduleResolution": "Bundler",
    "module": "ESNext",
    "jsx": "preserve",
    "allowJs": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@matter/registry/*": ["../../registry/*"]
    }
  },
  "include": ["app", "next.config.ts", "next-env.d.ts"]
}
```

- [ ] **Step 6.4: Create `app/layout.tsx`.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/apps/docs/app/layout.tsx`

```tsx
import type { ReactNode } from 'react'

export const metadata = {
  title: 'Matter — React shader components',
  description: 'WebGPU + TSL shader components for React.',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif' }}>{children}</body>
    </html>
  )
}
```

- [ ] **Step 6.5: Create `app/page.tsx` (the home page — minimal for M1).**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/apps/docs/app/page.tsx`

```tsx
import Link from 'next/link'

export default function Home() {
  return (
    <main style={{ padding: '4rem 2rem', maxWidth: '60ch', margin: '0 auto' }}>
      <h1>Matter</h1>
      <p>React shader components powered by WebGPU and Three.js TSL.</p>
      <p>
        Status: pre-release, M1 in progress.{' '}
        <Link href="/components/linear-gradient">See the first component →</Link>
      </p>
    </main>
  )
}
```

- [ ] **Step 6.6: Create the LinearGradient component page.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/apps/docs/app/components/linear-gradient/page.tsx`

```tsx
import { LinearGradient } from '@matter/registry/linear-gradient'

export default function LinearGradientPage() {
  return (
    <main style={{ padding: '0', minHeight: '100vh', position: 'relative' }}>
      <div style={{ position: 'relative', height: '60vh' }}>
        <LinearGradient colors={['#ff7b72', '#7b9cff']} angle={45} speed={0.2} interactive />
      </div>
      <section style={{ padding: '2rem', maxWidth: '60ch', margin: '0 auto' }}>
        <h1>&lt;LinearGradient /&gt;</h1>
        <p>
          Animated linear or radial gradient with optional cursor parallax. The simplest,
          foundational Matter component — proves the architecture.
        </p>
        <h2>Usage</h2>
        <pre
          style={{
            background: '#1a1a2a',
            color: '#e0e0f0',
            padding: '1rem',
            borderRadius: '0.5rem',
            overflow: 'auto',
          }}
        >
          {`import { LinearGradient } from '@/components/matter/linear-gradient'

<LinearGradient
  colors={['#ff7b72', '#7b9cff']}
  angle={45}
  speed={0.2}
  interactive
/>`}
        </pre>
        <p>
          (In Milestone 2, the CLI will copy <code>linear-gradient.tsx</code> into your project so
          you own and can edit the source.)
        </p>
      </section>
    </main>
  )
}
```

- [ ] **Step 6.7: Install docs deps.**

```bash
pnpm install
```

Expected: pnpm fetches Next.js and its deps. The workspace alias `@matter/docs` is registered.

- [ ] **Step 6.8: Run the docs dev server and verify.**

```bash
pnpm --filter @matter/docs dev
```

Open `http://localhost:3000/`. Expected: home page with title + link to the component page.

Open `http://localhost:3000/components/linear-gradient`. Expected: a 60vh-tall live `<LinearGradient>` rendering a coral→periwinkle gradient at 45°, animated, cursor-parallaxed. Below it: prose, usage code block.

- [ ] **Step 6.9: Build the docs app to confirm production build works.**

```bash
pnpm --filter @matter/docs build
```

Expected: Next.js build completes successfully.

- [ ] **Step 6.10: Commit.**

```bash
git add apps/docs/ pnpm-lock.yaml
git commit -m "feat(docs): scaffold Next.js docs site with first <LinearGradient> page"
```

### Task 7: Final M1 verification

**Files:** none — this task runs every workspace check end-to-end.

- [ ] **Step 7.1: Clean state.**

```bash
pnpm clean
```

- [ ] **Step 7.2: Fresh install.**

```bash
pnpm install --frozen-lockfile
```

- [ ] **Step 7.3: Typecheck workspace.**

```bash
pnpm typecheck
```

Expected: all packages exit 0. (`@matter/playground` and `@matter/docs` typecheck their TS code.)

- [ ] **Step 7.4: Lint workspace.**

```bash
pnpm lint
```

Expected: all green.

- [ ] **Step 7.5: Test workspace.**

```bash
pnpm test
```

Expected: vitest in `@lovo/matter` runs and all tests pass (CursorInput tests + MatterScheduler tests).

- [ ] **Step 7.6: Build workspace.**

```bash
pnpm build
```

Expected: tsup builds the three publishable packages; Next.js builds `@matter/docs`; Vite builds `@matter/playground`. All exit 0.

- [ ] **Step 7.7: Manual visual verification.**

Open three things in three browser tabs simultaneously:

1. `pnpm storybook` → `http://localhost:6006/` → click through all 5 LinearGradient stories
2. `pnpm --filter @matter/docs dev` (in another terminal) → `http://localhost:3000/components/linear-gradient`
3. `pnpm --filter @matter/playground dev` (in another terminal) → `http://localhost:5173/5-cursor.html`

Each should render correctly. (You'll need 3 different ports running, which they do by default. If port conflicts, edit the relevant config.)

- [ ] **Step 7.8: Run Prettier check + format if needed.**

```bash
pnpm exec prettier --check "**/*.{ts,tsx,js,jsx,json,md,yml,yaml}"
# If files need formatting:
pnpm format
git status
git add -A
git commit -m "chore: format with Prettier"
```

### Task 8: Update CLAUDE.md milestone status + tag M1 complete

**Files:**

- Modify: `CLAUDE.md`

- [ ] **Step 8.1: Update the milestone status table in `CLAUDE.md`.**

Edit `/Users/hunter.garrett/Documents/_personal/mattermix/CLAUDE.md`. Change the M1 row in the milestone status table from:

```
| 1 | Vertical slice — `<LinearGradient>` end-to-end | ⏳ Plan not yet written | — |
```

to:

```
| 1 | Vertical slice — `<LinearGradient>` end-to-end | ✅ Complete | `m1-complete` |
```

Also update the project status sentence in section "Where to find things" or wherever it mentions "as of M0" — bump to M1.

- [ ] **Step 8.2: Add any M1-specific gotchas to the "Gotchas to remember" section if any surfaced during implementation.** (Examples that might apply: TSL type-import paths, MatterScene cleanup race, useShaderMaterial type assertions. Only add what was actually painful.)

- [ ] **Step 8.3: Commit the CLAUDE.md update.**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md for M1 completion"
```

- [ ] **Step 8.4: Tag M1 complete.**

```bash
git tag -a m1-complete -m "Milestone 1 complete: <LinearGradient> end-to-end vertical slice"
```

- [ ] **Step 8.5: Verify final state.**

```bash
git log --oneline | head -30
git tag
```

Expected: `m1-complete` listed alongside `m0-complete`. ~30+ commits visible.

### Task 9: 🟢 Stop and play — M1 wrap-up

The architecture is now real. Spend a few minutes:

- [ ] **Step 9.1:** Open Storybook (`pnpm storybook`). Click through all 5 LinearGradient stories. Tweak args via the Storybook controls panel. Notice how `colors` and `angle` flow through.
- [ ] **Step 9.2:** Open the docs page (`pnpm --filter @matter/docs dev` → `http://localhost:3000/components/linear-gradient`). The cursor-parallax behavior should match what you tuned in Phase 1.6.
- [ ] **Step 9.3:** Open the cursor playground (`pnpm --filter @matter/playground dev` → `http://localhost:5173/5-cursor.html`). Reconfirm the smoothing default still feels right after seeing the same value applied through `<LinearGradient interactive>`.
- [ ] **Step 9.4:** Push to GitHub if you haven't already. Watch CI run.

When this all feels solid, M1 is done. The vertical slice is real. Every architectural decision in the spec has been validated on running code. M2 (the CLI) and M3 (the other 5 components) are largely execution from here.

---

## Notes for the executor

- **TSL API drift.** The exact symbol names and import paths for TSL primitives may have evolved since this plan was written. If a specific import (e.g., `MeshBasicNodeMaterial` from `'three/webgpu'`) doesn't resolve, check three's current TSL docs and adjust. The plan code is correct in intent; if it's wrong on a name, fix the name and proceed.
- **Two-line type assertions.** Several places use `as unknown as { value: T }` or similar. These exist because TSL's TypeScript declarations weren't fully comprehensive at the time of writing. If your three version has tighter types, use them.
- **Don't add scope.** This plan ships ONLY `<LinearGradient>` and the foundational primitives. No `<Aurora>`, no `<DotField>`, no shared scene optimization, no performance defaults. Those are M3 and M5. If you find yourself wanting to add "while I'm here," stop.
- **The Phase 1.6 cursor decision matters.** Don't skip the stop-and-play; the smoothing default propagates across every interactive component in M3.
- **The fallback boundary is rough.** It's a `useEffect`-driven `mounted` flag, which means SSR'd output is the fallback for one tick before the shader takes over. That's fine for M1; if you want a smoother handoff, that's M5 work.
- **TODOs-as-comments are forbidden in this plan's deliverables.** If you encounter scope you can't fit into the plan's tasks, surface it as a NEEDS_CONTEXT or DONE_WITH_CONCERNS report — don't sneak it in as a code comment.

---

## What this milestone validates (architecture-wise)

When M1 is green, every architectural choice in the spec has been demonstrated on running code:

| Spec decision                                     | Validated by                                                                              |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Three-tier model (components/primitives/recipes)  | LinearGradient (T1) uses `colorRamp` (T2); recipes are M4                                 |
| Hybrid renderer ownership (drop-in + MatterScene) | MatterScene auto-wraps in LinearGradient; can also be used directly                       |
| Hybrid distribution (engine npm + CLI copy-paste) | Engine package shipped via npm; LinearGradient lives in `registry/` waiting for CLI in M2 |
| WebGPU + WebGL2 fallback                          | `createRenderer` does it; backend logged in playground harnesses                          |
| Hybrid cursor architecture                        | `interactive` prop + `inputs` prop + `useCursor` hook all exist and work                  |
| Sensible default styling                          | MatterScene defaults to `position: absolute; inset: 0`                                    |
| SSR with fallback                                 | FallbackBoundary + DefaultFallback CSS gradient                                           |
| AnimatableProp protocol                           | useAnimatableUniform accepts both static and signal props                                 |
| Storybook 10 + Vite                               | Workspace runs `pnpm storybook` against the registry                                      |
| Next.js docs site dogfooding                      | apps/docs renders LinearGradient on a real page                                           |

Six v1 components remain. The second one (M3) is roughly half the work of the first because the engine is now in place — the per-component cost drops dramatically after M1.

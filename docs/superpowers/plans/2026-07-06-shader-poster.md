# ShaderPoster Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One SSR-safe component (`ShaderPoster`, exported from `@lovo/matter-react/poster`) owns shader fallback images: the poster renders in the initial HTML and drops exactly when `ShaderScene` signals its first painted content frame — replacing the hand-rolled `painted` state + `onFirstPaint` threading in all eight docs demo pages.

**Spec:** `docs/superpowers/specs/2026-07-06-shader-poster-design.md` — read it first.

**Architecture:** A duplication-safe React context (`PosterContext`, registered on `globalThis` via `Symbol.for`) is the signal channel. `ShaderPoster` provides it and renders the poster overlay; `ShaderScene` consumes it and calls `setShaderPainted(true)` in its existing first-paint rAF (and `false` on renderer teardown). The poster component lives in a new package entry `@lovo/matter-react/poster` that imports zero `three` modules, so it can render server-side while the scene loads behind `next/dynamic` `{ ssr: false }`.

**Tech Stack:** TypeScript 5 strict, React 19, tsup (ESM+CJS+dts), Vitest 4 + happy-dom + @testing-library/react, Next.js 15 docs site.

## Global Constraints

- Branch: create `hunter/shader-poster` off `main` before Task 1 (the spec/plan commits currently sit on `hunter/mat-44-replace-oklch-color-with-colors-from-palette`; cherry-pick them onto the new branch: `git cherry-pick <spec-commit> <plan-commit>`). Never commit to `main`.
- Conventional Commits, scope = package without `@lovo/` prefix (`feat(matter-react): …`, `docs: …` for apps/docs). No emojis. No Claude attribution trailers.
- TypeScript strict + `verbatimModuleSyntax`: use `import type` / inline `type` specifiers for type-only imports.
- Destructure props in component signatures — never `props.x` access.
- Clear names over abbreviations (no `ctx`, `cfg`, `cb`).
- Relative imports inside packages end in `.js` (ESM style), e.g. `'./poster-context.js'`.
- The docs site consumes `@lovo/matter-react` from **dist**, not src: after any package change, run `pnpm --filter @lovo/matter-react build` and restart the docs dev server or the change looks like a no-op.
- Docs dev/build must run on Node 22 (`fnm use` / `.node-version`); Node 23 breaks `next build` silently.
- Do NOT touch `FallbackBoundary` (`src/components/fallback-boundary/`) — it is a client-mount gate, a different concern, out of scope.
- Do NOT export `ShaderPoster` from the main barrel (`src/index.ts`) — the barrel pulls `three/webgpu`, which crashes SSR; the separate entry point is the whole point.

---

### Task 1: Branch + duplication-safe `PosterContext`

**Files:**
- Create: `packages/matter-react/src/components/shader-poster/poster-context.ts`
- Test: `packages/matter-react/src/components/shader-poster/poster-context.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `PosterContext: Context<PosterContextValue | null>` and `interface PosterContextValue { setShaderPainted: (painted: boolean) => void }` — Tasks 2 and 4 import both from `'./poster-context.js'` / `'../shader-poster/poster-context.js'`.

**Why the `Symbol.for` dance:** the `index` and `poster` package entries each bundle their own copy of this module (esbuild cannot code-split CJS output). If each copy called `createContext` independently, `ShaderPoster`'s provider and `ShaderScene`'s consumer would hold *different* context objects and the poster would silently never dismiss. Registering the context on `globalThis` under a global-registry symbol makes every evaluated copy resolve to the first context created. React is a peer dependency, so `createContext` always runs against a single React.

- [ ] **Step 1: Create the branch**

```bash
# Find the spec/plan commit SHAs first (they were authored on the MAT-44 branch):
git log --oneline hunter/mat-44-replace-oklch-color-with-colors-from-palette --grep "ShaderPoster" -5
git checkout main && git checkout -b hunter/shader-poster
git cherry-pick <spec-commit-sha> <plan-commit-sha>   # bring the spec + this plan over
```

- [ ] **Step 2: Write the failing test**

`packages/matter-react/src/components/shader-poster/poster-context.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('PosterContext', () => {
  afterEach(() => {
    vi.resetModules();
  });

  it('returns the same context object across module re-evaluations', async () => {
    const firstEvaluation = await import('./poster-context.js');

    vi.resetModules();
    const secondEvaluation = await import('./poster-context.js');

    // The index and poster package entries each bundle a copy of this module;
    // both copies must resolve to one context or provider and consumer split.
    expect(secondEvaluation.PosterContext).toBe(firstEvaluation.PosterContext);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
pnpm --filter @lovo/matter-react test -- poster-context
```

Expected: FAIL — cannot resolve `./poster-context.js`.

- [ ] **Step 4: Write the implementation**

`packages/matter-react/src/components/shader-poster/poster-context.ts`:

```ts
import { type Context, createContext } from 'react';

export interface PosterContextValue {
  /**
   * Signals whether the shader scene inside the poster boundary currently has
   * a real content frame on screen. ShaderScene calls this with true on the
   * frame after its first content paint, and with false when its renderer is
   * torn down (e.g. a gamut change) and must re-prove its first paint.
   */
  setShaderPainted: (painted: boolean) => void;
}

// This module is bundled into BOTH package entries (index and poster), and
// esbuild cannot code-split CJS output, so two evaluated copies are a real
// scenario. Register the context on globalThis under a global-registry symbol
// so every copy resolves to the single context created first — otherwise the
// ShaderPoster provider and the ShaderScene consumer would hold different
// context objects and the poster would never dismiss.
const POSTER_CONTEXT_KEY = Symbol.for('@lovo/matter-react:poster-context');

const globalRegistry = globalThis as { [key: symbol]: unknown };

const existingContext = globalRegistry[POSTER_CONTEXT_KEY] as
  | Context<PosterContextValue | null>
  | undefined;

export const PosterContext: Context<PosterContextValue | null> =
  existingContext ?? createContext<PosterContextValue | null>(null);

globalRegistry[POSTER_CONTEXT_KEY] = PosterContext;
```

- [ ] **Step 5: Run test to verify it passes**

```bash
pnpm --filter @lovo/matter-react test -- poster-context
```

Expected: PASS (1 test).

- [ ] **Step 6: Commit**

```bash
git add packages/matter-react/src/components/shader-poster/
git commit -m "feat(matter-react): add duplication-safe PosterContext"
```

---

### Task 2: `ShaderPoster` component

**Files:**
- Create: `packages/matter-react/src/components/shader-poster/shader-poster.tsx`
- Test: `packages/matter-react/src/components/shader-poster/shader-poster.test.tsx`

**Interfaces:**
- Consumes: `PosterContext`, `PosterContextValue` from `'./poster-context.js'` (Task 1).
- Produces: `ShaderPoster` component and `interface ShaderPosterProps { poster: ReactNode; children?: ReactNode; className?: string; style?: CSSProperties }` — Task 3 exports these; Task 5's `DemoPoster` renders `<ShaderPoster poster={…}>`.

- [ ] **Step 1: Write the failing tests**

`packages/matter-react/src/components/shader-poster/shader-poster.test.tsx`:

```tsx
import { useContext, useEffect } from 'react';

import { act, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PosterContext, type PosterContextValue } from './poster-context.js';
import { ShaderPoster } from './shader-poster.js';

// Stands in for ShaderScene: grabs the poster controls off context so the
// test can drive the paint signal the way a real scene would.
function SceneStub({
  onControls,
}: {
  onControls: (controls: PosterContextValue) => void;
}) {
  const posterControls = useContext(PosterContext);

  useEffect(() => {
    if (posterControls) onControls(posterControls);
  }, [posterControls, onControls]);

  return <canvas data-testid="scene" />;
}

function renderPosterWithStub() {
  let controls: PosterContextValue | null = null;
  const utils = render(
    <ShaderPoster poster={<img alt="poster" data-testid="poster" src="/p.jpg" />}>
      <SceneStub
        onControls={(received) => {
          controls = received;
        }}
      />
    </ShaderPoster>,
  );

  if (!controls) throw new Error('SceneStub never received poster controls');

  return { ...utils, controls: controls as PosterContextValue };
}

describe('ShaderPoster', () => {
  it('shows the poster and mounts children before the shader paints', () => {
    const { queryByTestId } = renderPosterWithStub();

    expect(queryByTestId('poster')).toBeInTheDocument();
    expect(queryByTestId('scene')).toBeInTheDocument();
  });

  it('drops the poster when the scene signals a painted frame', () => {
    const { queryByTestId, controls } = renderPosterWithStub();

    act(() => {
      controls.setShaderPainted(true);
    });

    expect(queryByTestId('poster')).not.toBeInTheDocument();
    expect(queryByTestId('scene')).toBeInTheDocument();
  });

  it('re-shows the poster when the scene signals painted=false', () => {
    const { queryByTestId, controls } = renderPosterWithStub();

    act(() => {
      controls.setShaderPainted(true);
    });
    act(() => {
      controls.setShaderPainted(false);
    });

    expect(queryByTestId('poster')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm --filter @lovo/matter-react test -- shader-poster
```

Expected: FAIL — cannot resolve `./shader-poster.js`.

- [ ] **Step 3: Write the implementation**

`packages/matter-react/src/components/shader-poster/shader-poster.tsx`:

```tsx
'use client';

import { type CSSProperties, type ReactNode, useMemo, useState } from 'react';

import { PosterContext, type PosterContextValue } from './poster-context.js';

export interface ShaderPosterProps {
  /**
   * Static stand-in (typically an image) shown until the shader's first
   * content frame is on screen, and again whenever the renderer is rebuilt.
   * Rendered inside an absolutely-positioned wrapper covering the boundary,
   * so a next/image with `fill` works as-is and a plain <img> only needs
   * width/height 100%.
   */
  poster: ReactNode;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/**
 * SSR-safe fallback boundary for shader scenes. Renders the poster in the
 * initial HTML (this module imports no three/webgpu, so it survives SSR while
 * the scene loads behind a dynamic import) and removes it when the enclosed
 * ShaderScene signals its first painted content frame via PosterContext.
 *
 * If the renderer never initializes (e.g. no WebGPU support), no paint signal
 * fires and the poster stays up permanently — that is deliberate: the poster
 * doubles as the graceful-degradation path. Check the console for the
 * underlying ShaderScene init error when diagnosing a poster that never
 * dismisses.
 */
export function ShaderPoster({ poster, children, className, style }: ShaderPosterProps) {
  const [shaderPainted, setShaderPainted] = useState(false);
  const posterControls = useMemo<PosterContextValue>(() => ({ setShaderPainted }), []);

  return (
    <div
      className={className}
      style={{ position: 'relative', width: '100%', height: '100%', ...style }}
    >
      <PosterContext.Provider value={posterControls}>{children}</PosterContext.Provider>
      {!shaderPainted && <div style={{ position: 'absolute', inset: 0 }}>{poster}</div>}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm --filter @lovo/matter-react test -- shader-poster
```

Expected: PASS (3 tests, plus the Task 1 context test).

- [ ] **Step 5: Commit**

```bash
git add packages/matter-react/src/components/shader-poster/
git commit -m "feat(matter-react): add ShaderPoster fallback boundary"
```

---

### Task 3: `@lovo/matter-react/poster` entry point

**Files:**
- Create: `packages/matter-react/src/poster.ts`
- Modify: `packages/matter-react/tsup.config.ts` (entry array)
- Modify: `packages/matter-react/package.json` (exports map)

**Interfaces:**
- Consumes: `ShaderPoster`, `ShaderPosterProps` (Task 2).
- Produces: the import specifier `@lovo/matter-react/poster` resolving to `dist/poster.{js,cjs,d.ts}` — Task 5's `DemoPoster` imports from it.

- [ ] **Step 1: Create the entry module**

`packages/matter-react/src/poster.ts`:

```ts
// @lovo/matter-react/poster — SSR-safe poster boundary.
//
// Deliberately shipped as its own entry point: the main barrel imports
// three/webgpu, which references `self` at module load and crashes SSR. This
// entry imports no three module at all, so a server-rendered page can put the
// poster in the initial HTML while the shader scene loads behind a dynamic
// import.
export { ShaderPoster } from './components/shader-poster/shader-poster.js';
export type { ShaderPosterProps } from './components/shader-poster/shader-poster.js';
```

- [ ] **Step 2: Add the tsup entry**

In `packages/matter-react/tsup.config.ts`, change:

```ts
entry: ['src/index.ts'],
```

to:

```ts
entry: ['src/index.ts', 'src/poster.ts'],
```

- [ ] **Step 3: Add the exports map entry**

In `packages/matter-react/package.json`, extend `"exports"` (keep the existing `"."` entry unchanged):

```json
"exports": {
  ".": {
    "types": "./dist/index.d.ts",
    "import": "./dist/index.js",
    "require": "./dist/index.cjs"
  },
  "./poster": {
    "types": "./dist/poster.d.ts",
    "import": "./dist/poster.js",
    "require": "./dist/poster.cjs"
  }
},
```

- [ ] **Step 4: Build and verify the entry is three-free and loadable**

```bash
pnpm --filter @lovo/matter-react build
grep -nE "(from ?\"|require\(\")three" packages/matter-react/dist/poster.js packages/matter-react/dist/poster.cjs
```

Expected: build succeeds producing `dist/poster.js`, `dist/poster.cjs`, `dist/poster.d.ts`; the grep prints **nothing** (exit 1). If it matches, a three import leaked into the poster graph — fix the import chain, do not proceed.

```bash
cd packages/matter-react && node --input-type=module -e "const posterModule = await import('./dist/poster.js'); console.log(typeof posterModule.ShaderPoster)" && cd ../..
```

Expected: prints `function` (proves the entry evaluates outside a browser — the SSR scenario).

- [ ] **Step 5: Typecheck and lint**

```bash
pnpm --filter @lovo/matter-react typecheck && pnpm --filter @lovo/matter-react lint
```

Expected: both pass.

- [ ] **Step 6: Commit**

```bash
git add packages/matter-react/src/poster.ts packages/matter-react/tsup.config.ts packages/matter-react/package.json
git commit -m "feat(matter-react): ship ShaderPoster via three-free poster entry point"
```

---

### Task 4: Wire `ShaderScene` to the poster signal; remove the `fallback` prop

**Files:**
- Modify: `packages/matter-react/src/components/shader-scene/shader-scene.tsx`
- Modify: `packages/matter-react/src/components/shader-scene/shader-scene.test.tsx`

**Interfaces:**
- Consumes: `PosterContext` from `'../shader-poster/poster-context.js'` (Task 1). Dependency direction is scene → poster-context only; nothing under `shader-poster/` may import from `shader-scene/`.
- Produces: `ShaderScene` calls `posterControls?.setShaderPainted(true)` in the first-paint rAF and `…(false)` in the renderer-teardown cleanup. `ShaderSceneProps` loses `fallback`. `onFirstPaint` stays.

- [ ] **Step 1: Update the test file first**

In `shader-scene.test.tsx`, add imports:

```tsx
import { PosterContext } from '../shader-poster/poster-context.js';
```

Replace the test `'renders the fallback before the async context resolves'` (the prop is being removed; the "poster visible initially" behavior is now covered by Task 2's ShaderPoster tests) with:

```tsx
  it('signals painted=false to an enclosing poster boundary on teardown', async () => {
    const setShaderPainted = vi.fn();
    const { unmount } = render(
      <PosterContext.Provider value={{ setShaderPainted }}>
        <ShaderScene />
      </PosterContext.Provider>,
    );

    // Allow a tick for the async setup to run.
    await waitFor(() => {});
    unmount();

    // requestAnimationFrame is stubbed inert in this suite, so the paint
    // signal never fires; teardown must still re-arm the poster.
    expect(setShaderPainted).toHaveBeenCalledWith(false);
  });
```

- [ ] **Step 2: Run tests to verify the new one fails**

```bash
pnpm --filter @lovo/matter-react test -- shader-scene
```

Expected: the new test FAILS (`setShaderPainted` never called); the removed test is gone; TypeScript may already error on `fallback` usage removal order — that is fine at this step.

- [ ] **Step 3: Modify `shader-scene.tsx`**

All changes:

1. Import `useContext` from react and the context:

```ts
import { type CSSProperties, type ReactNode, useContext, useEffect, useRef, useState } from 'react';

import { PosterContext } from '../shader-poster/poster-context.js';
```

2. In `ShaderSceneProps`, delete the line `fallback?: ReactNode;`.

3. In the function signature destructuring, delete `fallback,`.

4. Delete the `firstFramePainted` state and its comment:

```ts
  // DELETE these lines:
  // Stays false until the renderer has actually painted a frame containing the
  // shader. The fallback is held until then so there's no gap between dropping
  // the fallback and the first shader frame (which would otherwise flash the
  // canvas's clear state).
  const [firstFramePainted, setFirstFramePainted] = useState(false);
```

5. After `const onFirstPaintRef = useRef(onFirstPaint);`, add:

```ts
  // Poster boundary controls, when a ShaderPoster wraps this scene. The value
  // is memoized stable by ShaderPoster, so listing it in the setup effect's
  // deps does not cause renderer rebuilds. Null (a no-op below) when the
  // scene is used without a poster.
  const posterControls = useContext(PosterContext);
```

6. In the first-paint rAF callback inside `renderFrame`, replace `setFirstFramePainted(true);` with `posterControls?.setShaderPainted(true);`:

```ts
            firstPaintRaf = requestAnimationFrame(() => {
              firstPaintRaf = null;
              if (!cancelled) {
                posterControls?.setShaderPainted(true);
                onFirstPaintRef.current?.();
              }
            });
```

7. In the effect's cleanup, replace `setFirstFramePainted(false);` with `posterControls?.setShaderPainted(false);` and keep the adapted comment:

```ts
      // A fresh renderer (e.g. on gamut change) must re-prove its first paint,
      // so re-arm the enclosing poster until it does.
      posterControls?.setShaderPainted(false);
```

8. Add `posterControls` to the setup effect's dependency array:

```ts
  }, [maxDPR, resolvedGamut, posterControls]);
```

9. In the non-error render branch, delete the line `{!firstFramePainted && (fallback ?? null)}` and update the comment above it:

```tsx
    // Mount the children as soon as the context exists so the shader can build
    // and paint. The children render no visible DOM of their own (they drive
    // the canvas); an enclosing ShaderPoster keeps its poster overlaid until
    // this scene signals its first painted content frame.
    content = shaderContext ? (
      <ShaderContext.Provider value={shaderContext}>{children}</ShaderContext.Provider>
    ) : null;
```

- [ ] **Step 4: Run the package test suite**

```bash
pnpm --filter @lovo/matter-react test
```

Expected: ALL tests pass (shader-scene, shader-poster, poster-context, and the untouched suites).

- [ ] **Step 5: Build, typecheck, lint**

```bash
pnpm --filter @lovo/matter-react build && pnpm --filter @lovo/matter-react typecheck && pnpm --filter @lovo/matter-react lint
```

Expected: all pass. (The build matters: docs consume dist in Task 5.)

- [ ] **Step 6: Commit**

```bash
git add packages/matter-react/src/components/shader-scene/
git commit -m "feat(matter-react): drive poster dismissal from ShaderScene; drop fallback prop

The fallback prop could never render server-side (the barrel pulls
three/webgpu), so it was unusable behind the dynamic imports every consumer
needs. ShaderPoster replaces it; ShaderScene now signals paint state through
PosterContext."
```

---

### Task 5: `DemoPoster` docs helper + aurora migration — then STOP (validation gate)

**Files:**
- Create: `apps/docs/src/components/DemoPoster.tsx`
- Modify: `apps/docs/src/app/components/aurora/page.tsx`
- Modify: `apps/docs/src/app/components/aurora/scene.tsx`

**Interfaces:**
- Consumes: `ShaderPoster` from `@lovo/matter-react/poster` (Task 3), the Task 4 dist build.
- Produces: `DemoPoster` with `interface DemoPosterProps { src: string; alt: string; children?: ReactNode }` — Task 6 uses it in the seven remaining pages.

- [ ] **Step 1: Create `DemoPoster`**

`apps/docs/src/components/DemoPoster.tsx`:

```tsx
'use client';

import type { ReactNode } from 'react';

import { ShaderPoster } from '@lovo/matter-react/poster';
import Image from 'next/image';

export interface DemoPosterProps {
  src: string;
  alt: string;
  children?: ReactNode;
}

/**
 * Demo-page poster boundary: bakes in the next/image conventions every shader
 * demo uses (fill, priority, viewport sizes, cover). The image renders in the
 * initial HTML and drops when the enclosed ShaderScene paints its first frame.
 */
export function DemoPoster({ src, alt, children }: DemoPosterProps) {
  return (
    <ShaderPoster
      poster={
        <Image alt={alt} fill priority sizes="100vw" src={src} style={{ objectFit: 'cover' }} />
      }
    >
      {children}
    </ShaderPoster>
  );
}
```

- [ ] **Step 2: Migrate `aurora/scene.tsx`**

Remove the `onFirstPaint` prop entirely — the scene no longer threads anything:

```tsx
export default function AuroraScene({
  params = INITIAL,
  children,
}: {
  params?: AuroraParams;
  children?: ReactNode;
} = {}) {
```

and change `<ShaderScene onFirstPaint={onFirstPaint}>` to `<ShaderScene>`.

- [ ] **Step 3: Migrate `aurora/page.tsx`**

Four removals and one wrap:

1. Delete `import Image from 'next/image';` (now unused) and add `import { DemoPoster } from '@/components/DemoPoster';`.
2. Delete the `painted` state line (~line 67): `const [painted, setPainted] = useState(false);` (drop `useState` from the react import only if nothing else uses it — this page uses `useState` for params, so keep it).
3. Delete the conditional poster block inside the demo div:

```tsx
        {!painted && (
          <Image
            alt="Aurora shader preview: green, blue, and violet light curtains over a dark backdrop"
            fill
            priority
            sizes="100vw"
            src="/posters/aurora.jpg"
            style={{ objectFit: 'cover' }}
          />
        )}
```

4. Replace the scene block:

```tsx
        <AuroraScene onFirstPaint={() => setPainted(true)} params={params}>
          <VisualTestPause />
        </AuroraScene>
```

with:

```tsx
        <DemoPoster
          alt="Aurora shader preview: green, blue, and violet light curtains over a dark backdrop"
          src="/posters/aurora.jpg"
        >
          <AuroraScene params={params}>
            <VisualTestPause />
          </AuroraScene>
        </DemoPoster>
```

The `data-shader-demo` container, its background, and the Tweakpane host div all stay exactly as they are.

- [ ] **Step 4: Verify in the browser**

```bash
pnpm --filter @lovo/matter-react build        # if not already done in Task 4
pnpm --filter docs dev
```

Open `http://localhost:3000/components/aurora`. Verify:
- Poster appears instantly on load (throttle to "Slow 3G" in devtools and hard-reload: the poster must appear from initial HTML, before the shader chunk arrives).
- Poster swaps to the live shader with no flash of blank canvas and no visible jump (the shader starts at t=0, matching the poster).
- Disable JavaScript in devtools and reload: the poster renders and stays — this is the SSR proof.
- Layout is unchanged: the demo box is still the same 3/2 aspect block, Tweakpane in the corner.

- [ ] **Step 5: Typecheck + lint the docs app**

```bash
pnpm --filter docs typecheck && pnpm --filter docs lint
```

Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add apps/docs/src/components/DemoPoster.tsx apps/docs/src/app/components/aurora/
git commit -m "docs: add DemoPoster boundary and migrate aurora demo"
```

- [ ] **Step 7: PHASE GATE — stop and hand the dev server to the user.** Per the project's pacing preference, the user validates the feel (poster→shader swap, throttled load, no-JS behavior) on aurora before the mass migration in Task 6. Do not proceed without their go-ahead.

---

### Task 6: Migrate the remaining seven demos

**Files (each pair gets the identical transformation from Task 5 steps 2–3):**
- Modify: `apps/docs/src/app/components/dot-field/page.tsx` + `scene.tsx`
- Modify: `apps/docs/src/app/components/grain/page.tsx` + `scene.tsx`
- Modify: `apps/docs/src/app/components/linear-gradient/page.tsx` + `scene.tsx`
- Modify: `apps/docs/src/app/components/mesh-gradient/page.tsx` + `scene.tsx`
- Modify: `apps/docs/src/app/components/simplex-noise/page.tsx` + `scene.tsx`
- Modify: `apps/docs/src/app/components/vignette/page.tsx` + `scene.tsx`
- Modify: `apps/docs/src/app/components/waves/page.tsx` + `scene.tsx`

**Interfaces:**
- Consumes: `DemoPoster` (Task 5).
- Produces: no new interfaces; deletes each scene's `onFirstPaint` prop.

Per `scene.tsx` — delete the `onFirstPaint` prop end to end (each scene's other props differ; touch nothing else):

```tsx
// BEFORE (shape; prop names vary per scene)
export default function WavesScene({ params = INITIAL, onFirstPaint, children }: {
  params?: WavesParams;
  onFirstPaint?: () => void;
  children?: ReactNode;
} = {}) {
  return <ShaderScene onFirstPaint={onFirstPaint}>…</ShaderScene>;
}

// AFTER
export default function WavesScene({ params = INITIAL, children }: {
  params?: WavesParams;
  children?: ReactNode;
} = {}) {
  return <ShaderScene>…</ShaderScene>;
}
```

Per `page.tsx` — four removals and one wrap:

1. Delete `const [painted, setPainted] = useState(false);` (keep the `useState` import; every page still uses it for params).
2. Delete `import Image from 'next/image';` if it becomes unused; add `import { DemoPoster } from '@/components/DemoPoster';`.
3. Delete the poster block inside the `data-shader-demo` div:

```tsx
        {!painted && (
          <Image alt="…" fill priority sizes="100vw" src="/posters/…" style={{ objectFit: 'cover' }} />
        )}
```

4. Wrap the scene (keeping its `<VisualTestPause />` child inside) and drop its `onFirstPaint` prop:

```tsx
// BEFORE
        <WavesScene onFirstPaint={() => setPainted(true)} params={params}>
          <VisualTestPause />
        </WavesScene>

// AFTER
        <DemoPoster alt="…" src="/posters/…">
          <WavesScene params={params}>
            <VisualTestPause />
          </WavesScene>
        </DemoPoster>
```

The `data-shader-demo` container and Tweakpane host stay untouched. Use these exact `src`/`alt` values, copied verbatim from the code being deleted:

| Page | `src` | `alt` |
| --- | --- | --- |
| dot-field | `/posters/dot-field.png` | `Dot field shader preview: a sparse grid of small gray dots on a dark background` |
| grain | `/posters/grain.jpg` | `Film grain shader preview: violet to magenta gradient overlaid with grain` |
| linear-gradient | `/posters/linear-gradient.png` | `Linear gradient shader preview: vertical gradient from violet to purple to magenta` |
| mesh-gradient | `/posters/mesh-gradient.jpg` | `Mesh gradient shader preview: warped four-color gradient blending pink, magenta, yellow, and orange` |
| simplex-noise | `/posters/simplex-noise.png` | `Simplex noise shader preview: posterized organic noise pattern in blue, violet, magenta, and teal` |
| vignette | `/posters/vignette.jpg` | `Vignette shader preview: a violet-to-magenta gradient darkened toward the edges` |
| waves | `/posters/waves.jpg` | `Waves shader preview: layered luminous wave bands in red, amber, green, and blue over a dark field` |

- [ ] **Step 1: Apply the transformation to all seven page/scene pairs** (values from the table; before touching each file, read it — a page may deviate slightly from aurora's shape, e.g. different param wiring; only the poster/painted/onFirstPaint concerns change).

- [ ] **Step 2: Verify nothing was missed**

```bash
grep -rn "onFirstPaint\|setPainted" apps/docs/src/app/components/
```

Expected: no matches.

- [ ] **Step 3: Typecheck, lint, spot-check**

```bash
pnpm --filter docs typecheck && pnpm --filter docs lint
```

Expected: pass. With the dev server running, load all eight `/components/*` pages and confirm each shows its poster then swaps to the live shader.

- [ ] **Step 4: Commit**

```bash
git add apps/docs/src/app/components/
git commit -m "docs: migrate remaining demos to DemoPoster"
```

---

### Task 7: Full verification + visual baselines

**Files:**
- None expected; possibly regenerated baselines under `apps/docs-tests/`.

- [ ] **Step 1: Repo-wide checks**

```bash
pnpm build && pnpm typecheck && pnpm lint && pnpm test && pnpm format:check
```

Expected: all green. (`format:check` matters — CI runs it at the root and it is a known trip-up.)

- [ ] **Step 2: Visual regression**

Run the docs visual suite the same way CI does (see `apps/docs-tests/`; the docs build must run on Node 22 — `fnm use` first). The tests wait on `window.__matterTestReady` from `VisualTestPause`, which is untouched, so timing is unchanged. Two acceptable outcomes:

- All baselines pass → done.
- Baselines shifted (the DOM gained ShaderPoster's wrapper div; both it and the scene are 100%-sized so pixels *should* be identical, but sub-pixel layout shifts are a known hazard) → regenerate via `pnpm snap` (Docker), then eyeball every diff: only accept diffs that show the identical shader composition; any cropping/compression means the wrapper broke sizing (check `renderer.getSize()` vs canvas size per the renderer-resize gotcha) — fix, don't re-baseline over it.

- [ ] **Step 3: Commit any regenerated baselines**

```bash
git add apps/docs-tests/
git commit -m "test(docs-tests): regenerate baselines for DemoPoster wrapper"
```

(Skip if no baselines changed.)

- [ ] **Step 4: Finish the branch** — use superpowers:finishing-a-development-branch. PR per repo conventions: concise body leading with why, no Test plan / Follow-ups sections, no attribution trailer, prose through superpowers:humanizer. Never push to main.

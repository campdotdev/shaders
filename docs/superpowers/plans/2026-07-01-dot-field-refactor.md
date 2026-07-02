# Dot-Field Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Shader-edit convention (CRITICAL):** Per `feedback_shader_co_write` and `feedback_shader_phase_gates`, all *math* edits to `registry/dot-field/shader.tsx` are **co-written by the user, chunk by chunk** — the assistant describes the next small chunk (concept + exact code + placement), the user types it, confirms, then the next chunk. The assistant does **not** call Edit/Write on `shader.tsx` in Phases 2–3. **One exception, gated on user approval (Phase 1 Step 0):** the *verbatim structural extraction* in Phase 1 moves existing, unchanged shader code into `shader.tsx` — no new GPU math is authored — so the assistant may perform it directly. Non-shader files (wrapper prop plumbing, demo scene, params, page, registry manifest) are edited directly throughout. Every phase ends at a **stop-and-play gate** the user runs in the browser and reacts to before moving on.

**Goal:** Modernize `<DotField>` to the standard wrapper + `shader.tsx` split, remove its cursor interactivity, and replace the cursor displacement with a self-driven radial concentric ripple that decays with distance.

**Architecture:** Split the last single-file component into `registry/dot-field/{dot-field.tsx, shader.tsx}` (wrapper owns prop defaults + JSDoc; shader owns uniforms, TSL material, mesh lifecycle), matching aurora/vignette. Interaction (cursor plumbing + `reach`/`strength`) is deleted; the displacement driver becomes `sin(distance/wavelength − time·speed)` pushed radially from a `center`, scaled by an `exp(−distNorm·decay)` falloff. Animation reads `elapsedTime` off the scene clock, so the existing `VisualTestPause` seam already makes baselines deterministic.

**Tech Stack:** React 19, Three.js TSL (`three/tsl`, `three/webgpu`), `@lovo/matter` (`displace`, `signedDistanceFieldCircle`, `elapsedTime`, `parseColor` via `../utils/color`), `@lovo/matter-react` (`useShaderContext`, `useAnimatableUniform`, `useResize`, `AnimatableProp`), Tweakpane + `tweakpane-plugin-color-plus` (docs panel), Playwright visual regression, matter-cli poster generator.

## Global Constraints

- **No emojis** in code or commit messages.
- **Conventional Commits**, scope = package without `@lovo/` prefix (`feat(dot-field):`, `refactor(dot-field):`, `feat(docs):`, `test(docs):`, `docs:`).
- **Never push to main** — all work on a PR branch (`feedback_never_push_to_main`).
- **No Claude attribution** in commits or PRs (`feedback_no_claude_attribution`).
- **Destructure props inline** at the function signature with defaults (`feedback_destructure_props`) — never `props.X`.
- **Clear names over abbreviations** (CLAUDE.md convention; MAT-34 audit).
- **TypeScript strict** + `verbatimModuleSyntax` — `import type` for type-only imports.
- **YAGNI** — no capability beyond what each task specifies. In particular: do **not** extract shared `useColorUniform` / aspect-uniform hooks; every component inlines them today and cross-component refactor is out of scope.
- **`colorSpace` / `hueInterpolation` are out of scope** — dot-field is single-color (MAT-43 scope note).
- **Stable-uniform pattern (Gotcha #17):** push scalar props through `uniform(...)` nodes and mutate `.value` in a light effect; never rebuild the material on a scalar prop change. `center` routes through a `Vector2` uniform (Gotcha #19); `color` stays baked as literals (single, non-animated — rebuild on color change is acceptable, same as today).
- **Docs site consumes `@lovo/matter(-react)` from built dist**, but this plan touches **no engine code**, so no engine rebuild is required. `@matter/registry` is consumed as source via `transpilePackages`.
- **Poster / baseline generation must run on pinned Node 22** (`project_docs_build_node23` — `next build` silently produces no output on Node 23) and `pnpm snap` needs Docker (`project_ci_gotchas`).

## File map

| File | Responsibility | Touched in |
| --- | --- | --- |
| `registry/dot-field.tsx` | Current single-file component (deleted after split) | Phase 0 (commit as-is), Phase 1 (delete) |
| `registry/dot-field/dot-field.tsx` | New public wrapper: prop defaults, JSDoc, forwards to shader | Phase 1, 2, 3 |
| `registry/dot-field/shader.tsx` | Uniforms + TSL material + mesh lifecycle (**co-write in 2–3**) | Phase 1, 2, 3 |
| `registry/package.json` | `exports` map entry for `./dot-field` | Phase 1 |
| `registry/registry.json` | CLI manifest entry for `dot-field` | Phase 1 |
| `apps/docs/src/app/components/dot-field/scene.tsx` | Demo composition | Phase 2, 3 |
| `apps/docs/src/app/components/dot-field/params.ts` | Demo params type + `INITIAL` | Phase 2, 3 |
| `apps/docs/src/app/components/dot-field/page.tsx` | Tweakpane panel + inline usage snippet | Phase 2, 3 |
| `apps/docs/public/posters/dot-field.png` | Poster asset (regenerated) | Phase 0 (MAT-43), Phase 4 |
| `apps/docs-tests/visual/dot-field.spec.ts-snapshots/*.png` | Visual baselines (regenerated; spec file unchanged) | Phase 0 (MAT-43), Phase 4 |

---

## Phase 0: Land the finished color-decode work (same branch)

**Why:** The working tree already holds a finished change — the wide-gamut color decode for dot-field (component `parseColor` swap, docs color-plus picker, `oklch()` initial, regenerated poster + baselines). Per the branch decision, everything ships as **one MAT-6 PR** on the current `hunter/mat-6-fix-and-review-dotfield` branch, so we commit the decode work as the opening commits here — **no separate branch**.

**Files:** commit existing uncommitted changes + the design docs on the current branch.

- [ ] **Step 1: Confirm the working tree holds only the expected changes**

Run:
```bash
git status --short
git --no-pager diff --stat
```
Expected tracked-modified paths: `registry/dot-field.tsx`, `apps/docs/src/app/components/dot-field/page.tsx`, `apps/docs/src/app/components/dot-field/params.ts`, `apps/docs/public/posters/dot-field.png`, and the two `dot-field-default-chromium-*.png` baselines. Expected untracked: the two design docs (`docs/superpowers/specs/2026-07-01-dot-field-refactor-design.md`, `docs/superpowers/plans/2026-07-01-dot-field-refactor.md`). If any *other* path appears, stop and surface it to the user.

- [ ] **Step 2: Commit the component decode change**

```bash
git add registry/dot-field.tsx
git commit -m "feat(dot-field): decode wide-gamut color input (hex/oklch/oklab)"
```

- [ ] **Step 3: Commit the docs picker change**

```bash
git add apps/docs/src/app/components/dot-field/page.tsx apps/docs/src/app/components/dot-field/params.ts
git commit -m "feat(docs): wide-gamut color picker for dot-field demo"
```

- [ ] **Step 4: Commit the regenerated assets**

```bash
git add apps/docs/public/posters/dot-field.png "apps/docs-tests/visual/dot-field.spec.ts-snapshots/"
git commit -m "test(docs): regenerate dot-field poster and visual baselines"
```

- [ ] **Step 5: Commit the design docs**

```bash
git add docs/superpowers/specs/2026-07-01-dot-field-refactor-design.md docs/superpowers/plans/2026-07-01-dot-field-refactor.md
git commit -m "docs: dot-field refactor design spec and plan"
```

- [ ] **Step 6: Stop-and-play gate**

Confirm with the user: decode work committed on `hunter/mat-6-fix-and-review-dotfield`, proceeding to Phase 1 where a **subagent performs the verbatim structural split** (math edits in Phases 2–3 are co-written in-session). User reacts before continuing.

---

## Phase 1: Structural split (behavior-preserving)

**Why:** Separate "move the code" from "change the code." After this phase dot-field is a wrapper + `shader.tsx` pair like every other component, but behaves **identically** (still cursor-interactive). A clean gate here isolates "did the split break resolution/exports/imports" from the behavior changes in later phases.

**Files:**
- Create: `registry/dot-field/dot-field.tsx`
- Create: `registry/dot-field/shader.tsx`
- Delete: `registry/dot-field.tsx`
- Modify: `registry/package.json`
- Modify: `registry/registry.json`

**Interfaces:**
- Produces: `DotField` (default export path unchanged: `@matter/registry/dot-field`), `DotFieldProps`, and internal `DotFieldShader` / `DotFieldShaderProps`. In this phase the prop surface is **unchanged** from today (`spacing`, `dotSize`, `color`, `reach`, `strength`, `interactive`, `inputs`).

- [ ] **Step 0: Reconfirm the co-write exception (gate)**

Verbal check with the user before touching `shader.tsx`: the assistant will create `shader.tsx` as a **verbatim move** of the current shader logic (no new GPU math). If the user prefers to co-write even the move, switch to co-write for this phase.

- [ ] **Step 1: Create the wrapper `registry/dot-field/dot-field.tsx`**

Behavior-preserving wrapper — same props as today, forwarding to `DotFieldShader`:

```tsx
'use client';

import type { AnimatableProp, CursorSignal } from '@lovo/matter-react';

import { DotFieldShader } from './shader';

export interface DotFieldProps {
  spacing?: AnimatableProp<number>;
  dotSize?: AnimatableProp<number>;
  color?: string;
  reach?: AnimatableProp<number>;
  strength?: AnimatableProp<number>;
  interactive?: boolean;
  inputs?: { cursor?: CursorSignal };
}

export function DotField({
  spacing = 30,
  dotSize = 2,
  color = '#8B918C',
  reach = 100,
  strength = 1,
  interactive = true,
  inputs,
}: DotFieldProps) {
  return (
    <DotFieldShader
      color={color}
      dotSize={dotSize}
      inputs={inputs}
      interactive={interactive}
      reach={reach}
      spacing={spacing}
      strength={strength}
    />
  );
}
```

- [ ] **Step 2: Create the shader `registry/dot-field/shader.tsx` (verbatim extraction)**

Move the current shader logic verbatim. Two mechanical changes only: (a) the `parseColor` import path becomes `../utils/color` (now one level deeper); (b) the component is renamed `DotFieldShader` with an explicit `DotFieldShaderProps` (props required, since the wrapper always supplies them), and reads its props from the signature rather than `props.X`.

```tsx
'use client';

import { useEffect, useMemo } from 'react';

import { displace, signedDistanceFieldCircle, type TSLNode } from '@lovo/matter';
import {
  type AnimatableProp,
  type CursorSignal,
  useAnimatableUniform,
  useCursor,
  useResize,
  useShaderContext,
} from '@lovo/matter-react';
import { length, mix, mod, smoothstep, uniform, uv, vec2, vec3, vec4 } from 'three/tsl';
import { Mesh, MeshBasicNodeMaterial, PlaneGeometry, Vector2 } from 'three/webgpu';

import { parseColor } from '../utils/color';

export interface DotFieldShaderProps {
  spacing: AnimatableProp<number>;
  dotSize: AnimatableProp<number>;
  color: string;
  reach: AnimatableProp<number>;
  strength: AnimatableProp<number>;
  interactive: boolean;
  inputs?: { cursor?: CursorSignal };
}

function buildDotFieldMaterial(
  spacingUniform: TSLNode,
  dotSizeUniform: TSLNode,
  reachUniform: TSLNode,
  strengthUniform: TSLNode,
  cursorUniform: TSLNode,
  resUniform: TSLNode,
  color: readonly [number, number, number],
): MeshBasicNodeMaterial {
  const [redChannel, greenChannel, blueChannel] = color;

  const pxUv = uv().mul(resUniform).div(spacingUniform);
  const cellLocal = mod(pxUv, 1).sub(vec2(0.5, 0.5));

  const cellIndex = pxUv.sub(mod(pxUv, 1));
  const cellCenterUv = cellIndex.add(vec2(0.5, 0.5)).mul(spacingUniform).div(resUniform);

  const cellToCursorPx = cellCenterUv.sub(cursorUniform).mul(-1).mul(resUniform);
  const distToCursorPx = length(cellToCursorPx);
  const influence = smoothstep(reachUniform, 0, distToCursorPx);

  // +0.001 avoids div-by-zero when cursor is exactly over a cell center
  const dirToCursor = cellToCursorPx.div(distToCursorPx.add(0.001));
  const offset = dirToCursor.mul(influence).mul(strengthUniform).mul(0.4);
  const displacedLocal = displace(cellLocal, offset.mul(-1));

  const zeroScalar = vec2(0).x;
  const radius = zeroScalar.add(dotSizeUniform).div(zeroScalar.add(spacingUniform).mul(2));
  const sdf = signedDistanceFieldCircle(displacedLocal, radius);

  const antialiasWidth = 0.01;
  const dotMask = smoothstep(antialiasWidth, -antialiasWidth, sdf);
  const dotColor = mix(vec3(0, 0, 0), vec3(redChannel, greenChannel, blueChannel), dotMask);

  const material = new MeshBasicNodeMaterial();

  material.colorNode = vec4(dotColor, dotMask);

  return material;
}

export function DotFieldShader({
  spacing,
  dotSize,
  color,
  reach,
  strength,
  interactive,
  inputs,
}: DotFieldShaderProps) {
  const shaderContext = useShaderContext();
  const cursorFromInputs = inputs?.cursor;
  const cursorAuto = useCursor();
  const cursor = cursorFromInputs ?? (interactive ? cursorAuto : null);
  const resize = useResize();

  const spacingUniform = useAnimatableUniform<number>(spacing);
  const dotSizeUniform = useAnimatableUniform<number>(dotSize);
  const reachUniform = useAnimatableUniform<number>(reach);
  const strengthUniform = useAnimatableUniform<number>(strength);

  const parsedColor = useMemo(() => parseColor(color), [color]);

  const cursorVec = useMemo(() => new Vector2(0.5, 0.5), []);
  const cursorUniform = useMemo(() => uniform(cursorVec), [cursorVec]);

  useEffect(() => {
    if (cursor)
      return cursor.on('change', ([cursorX, cursorY]) => cursorVec.set(cursorX, 1 - cursorY));
    cursorVec.set(0.5, 0.5);

    return undefined;
  }, [cursor, cursorVec]);

  const resVec = useMemo(() => new Vector2(1920, 1080), []);
  const resUniform = useMemo(() => uniform(resVec), [resVec]);

  useEffect(() => {
    const [canvasWidth, canvasHeight] = resize.get();

    if (canvasWidth > 0 && canvasHeight > 0) resVec.set(canvasWidth, canvasHeight);

    return resize.on('change', ([updatedWidth, updatedHeight]) =>
      resVec.set(updatedWidth, updatedHeight),
    );
  }, [resize, resVec]);

  useEffect(() => {
    if (!shaderContext) return;

    const material = buildDotFieldMaterial(
      spacingUniform,
      dotSizeUniform,
      reachUniform,
      strengthUniform,
      cursorUniform,
      resUniform,
      parsedColor,
    );
    const mesh = new Mesh(new PlaneGeometry(2, 2), material);

    shaderContext.scene.add(mesh);

    return () => {
      shaderContext.scene.remove(mesh);
      try {
        material.dispose();
      } catch {
        /* benign during rebuild */
      }
      try {
        mesh.geometry.dispose();
      } catch {
        /* same */
      }
    };
  }, [
    shaderContext,
    parsedColor,
    spacingUniform,
    dotSizeUniform,
    reachUniform,
    strengthUniform,
    cursorUniform,
    resUniform,
  ]);

  return null;
}
```

- [ ] **Step 3: Delete the old single-file component**

```bash
git rm registry/dot-field.tsx
```

- [ ] **Step 4: Update the `exports` map in `registry/package.json`**

Change the `./dot-field` line:
```jsonc
// before:
"./dot-field": "./dot-field.tsx",
// after:
"./dot-field": "./dot-field/dot-field.tsx",
```

- [ ] **Step 5: Update the CLI manifest `registry/registry.json`**

Open `registry.json`, find the `dot-field` entry (currently `"file": "dot-field.tsx"`), and update it to the directory form used by the other split components. Match the exact shape aurora/vignette use in the same file (e.g. multi-file `files` list pointing at `dot-field/dot-field.tsx` and `dot-field/shader.tsx`). Read a neighboring split entry first and mirror it precisely.

- [ ] **Step 6: Typecheck + lint**

```bash
pnpm --filter @matter/registry typecheck && pnpm --filter @matter/docs typecheck && pnpm lint
```
Expected: PASS. (`@matter/registry` and `registry/` lint under the root config.)

- [ ] **Step 7: Stop-and-play gate**

```bash
pnpm dev:docs
```
Open the dot-field page. Confirm it looks and behaves **exactly** as before this phase: dots displace toward the cursor, all Tweakpane controls (including `interactive`, `reach`, `strength`) still work, no console errors. **User reacts before continuing.**

- [ ] **Step 8: Commit**

```bash
git add registry/dot-field registry/package.json registry/registry.json
git commit -m "refactor(dot-field): split into wrapper + shader.tsx"
```

---

## Phase 2: Remove interactivity → static grid

**Why:** Interaction leaves as a prop and returns later as a separate composable component. Stripping it to a bare static grid first gives a clean gate — it proves the grid/sdf/color path renders correctly with nothing driving displacement, before we add the ripple.

**This phase edits `shader.tsx` — co-write only.** Wrapper, scene, params, page are direct edits.

**Files:**
- Modify (co-write): `registry/dot-field/shader.tsx`
- Modify: `registry/dot-field/dot-field.tsx`
- Modify: `apps/docs/src/app/components/dot-field/scene.tsx`
- Modify: `apps/docs/src/app/components/dot-field/params.ts`
- Modify: `apps/docs/src/app/components/dot-field/page.tsx`

**Interfaces:**
- Produces: `DotFieldProps` / `DotFieldShaderProps` reduced to `{ spacing, dotSize, color }`. `useCursor`, `CursorSignal`, `inputs`, `reach`, `strength`, `interactive` are gone.

- [ ] **Step 1 (co-write): Reduce `shader.tsx` to a static grid**

Guide the user chunk-by-chunk to reach this file. The changes: drop the cursor imports (`CursorSignal`, `useCursor`), drop the cursor/reach/strength/`inputs` props, delete the cursor-cell/influence/displace block (and the now-unused `cellIndex`, `cellCenterUv`, `displace` import and `length` import), and feed `cellLocal` straight into the sdf. Explain: with nothing displacing the dots, `displacedLocal` collapses to `cellLocal`, so the sdf is evaluated at each cell's undistorted local coordinate — a perfectly regular grid. `resUniform` stays (the px grid density depends on canvas resolution).

Target file after this phase:

```tsx
'use client';

import { useEffect, useMemo } from 'react';

import { signedDistanceFieldCircle, type TSLNode } from '@lovo/matter';
import {
  type AnimatableProp,
  useAnimatableUniform,
  useResize,
  useShaderContext,
} from '@lovo/matter-react';
import { mix, mod, smoothstep, uniform, uv, vec2, vec3, vec4 } from 'three/tsl';
import { Mesh, MeshBasicNodeMaterial, PlaneGeometry, Vector2 } from 'three/webgpu';

import { parseColor } from '../utils/color';

export interface DotFieldShaderProps {
  spacing: AnimatableProp<number>;
  dotSize: AnimatableProp<number>;
  color: string;
}

function buildDotFieldMaterial(
  spacingUniform: TSLNode,
  dotSizeUniform: TSLNode,
  resUniform: TSLNode,
  color: readonly [number, number, number],
): MeshBasicNodeMaterial {
  const [redChannel, greenChannel, blueChannel] = color;

  const pxUv = uv().mul(resUniform).div(spacingUniform);
  const cellLocal = mod(pxUv, 1).sub(vec2(0.5, 0.5));

  const zeroScalar = vec2(0).x;
  const radius = zeroScalar.add(dotSizeUniform).div(zeroScalar.add(spacingUniform).mul(2));
  const sdf = signedDistanceFieldCircle(cellLocal, radius);

  const antialiasWidth = 0.01;
  const dotMask = smoothstep(antialiasWidth, -antialiasWidth, sdf);
  const dotColor = mix(vec3(0, 0, 0), vec3(redChannel, greenChannel, blueChannel), dotMask);

  const material = new MeshBasicNodeMaterial();

  material.colorNode = vec4(dotColor, dotMask);

  return material;
}

export function DotFieldShader({ spacing, dotSize, color }: DotFieldShaderProps) {
  const shaderContext = useShaderContext();
  const resize = useResize();

  const spacingUniform = useAnimatableUniform<number>(spacing);
  const dotSizeUniform = useAnimatableUniform<number>(dotSize);

  const parsedColor = useMemo(() => parseColor(color), [color]);

  const resVec = useMemo(() => new Vector2(1920, 1080), []);
  const resUniform = useMemo(() => uniform(resVec), [resVec]);

  useEffect(() => {
    const [canvasWidth, canvasHeight] = resize.get();

    if (canvasWidth > 0 && canvasHeight > 0) resVec.set(canvasWidth, canvasHeight);

    return resize.on('change', ([updatedWidth, updatedHeight]) =>
      resVec.set(updatedWidth, updatedHeight),
    );
  }, [resize, resVec]);

  useEffect(() => {
    if (!shaderContext) return;

    const material = buildDotFieldMaterial(spacingUniform, dotSizeUniform, resUniform, parsedColor);
    const mesh = new Mesh(new PlaneGeometry(2, 2), material);

    shaderContext.scene.add(mesh);

    return () => {
      shaderContext.scene.remove(mesh);
      try {
        material.dispose();
      } catch {
        /* benign during rebuild */
      }
      try {
        mesh.geometry.dispose();
      } catch {
        /* same */
      }
    };
  }, [shaderContext, parsedColor, spacingUniform, dotSizeUniform, resUniform]);

  return null;
}
```

- [ ] **Step 2: Reduce the wrapper `registry/dot-field/dot-field.tsx`**

```tsx
'use client';

import type { AnimatableProp } from '@lovo/matter-react';

import { DotFieldShader } from './shader';

export interface DotFieldProps {
  /** Grid cell size in pixels. */
  spacing?: AnimatableProp<number>;
  /** Dot radius in pixels. */
  dotSize?: AnimatableProp<number>;
  /** Dot color — hex, `oklch()`, or `oklab()`. */
  color?: string;
}

export function DotField({ spacing = 30, dotSize = 2, color = '#8B918C' }: DotFieldProps) {
  return <DotFieldShader color={color} dotSize={dotSize} spacing={spacing} />;
}
```

- [ ] **Step 3: Reduce the demo scene `scene.tsx`**

```tsx
'use client';

import type { ReactNode } from 'react';

import { ShaderScene } from '@lovo/matter-react';
import { DotField } from '@matter/registry/dot-field';

import { INITIAL, type Params } from './params';

export default function DotFieldScene({
  params = INITIAL,
  children,
}: {
  params?: Params;
  children?: ReactNode;
} = {}) {
  return (
    <ShaderScene>
      <DotField color={params.color} dotSize={params.dotSize} spacing={params.spacing} />
      {children}
    </ShaderScene>
  );
}
```

- [ ] **Step 4: Reduce the demo params `params.ts`**

```ts
export interface Params {
  color: string;
  spacing: number;
  dotSize: number;
}

export const INITIAL: Params = {
  color: 'oklch(0.65 0.01 150)',
  spacing: 30,
  dotSize: 2,
};
```

- [ ] **Step 5: Reduce the Tweakpane panel + inline snippet in `page.tsx`**

Replace the binding callback body so it registers the color-plus picker and binds only `color`, `spacing`, `dotSize` (drop the `reach`/`strength`/`interactive` bindings and their separators):

```ts
      // Wide-gamut color picker: the built-in picker is sRGB and rejects
      // oklch()/oklab() strings, so register color-plus for P3-capable input.
      pane.registerPlugin(TweakpanePluginColorPlus);
      pane.addBinding(local, 'color', {
        label: 'color',
        view: 'color-plus',
        color: { formatLocked: true },
      });
      pane.addBlade({ view: 'separator' });
      pane.addBinding(local, 'spacing', { min: 8, max: 80, step: 1 });
      pane.addBinding(local, 'dotSize', {
        label: 'dot size',
        min: 1,
        max: 8,
        step: 0.5,
      });
      pane.on('change', sync);
```

Update the inline usage snippet (the `<pre>` block) to the reduced prop set:
```tsx
          {`<ShaderScene>
  <DotField spacing={30} dotSize={2} color="oklch(0.65 0.01 150)" />
</ShaderScene>`}
```

- [ ] **Step 6: Typecheck + lint**

```bash
pnpm --filter @matter/registry typecheck && pnpm --filter @matter/docs typecheck && pnpm lint
```
Expected: PASS (no dangling references to removed props/imports; no unused-import errors).

- [ ] **Step 7: Stop-and-play gate**

Restart `pnpm dev:docs`, open the dot-field page. Confirm: a perfectly regular static grid of dots; moving the cursor does **nothing**; the panel shows only color/spacing/dotSize; the inline snippet has no `reach`/`strength`. **User reacts before continuing.**

- [ ] **Step 8: Commit**

```bash
git add registry/dot-field apps/docs/src/app/components/dot-field
git commit -m "refactor(dot-field): remove cursor interactivity"
```

---

## Phase 3: Add the radial ripple + decay

**Why:** This is the new self-driven identity — a stone-in-a-pond ripple that keeps the field alive without a cursor. It reuses the distance/direction math the cursor version had, but drives the phase from `elapsedTime` and fades it with distance.

**This phase edits `shader.tsx` — co-write only.** Wrapper, scene, params, page are direct edits.

**Files:**
- Modify (co-write): `registry/dot-field/shader.tsx`
- Modify: `registry/dot-field/dot-field.tsx`
- Modify: `apps/docs/src/app/components/dot-field/scene.tsx`
- Modify: `apps/docs/src/app/components/dot-field/params.ts`
- Modify: `apps/docs/src/app/components/dot-field/page.tsx`

**Interfaces:**
- Consumes: `elapsedTime` from `@lovo/matter` (a TSL time node; used as `elapsedTime.mul(speedUniform)`); `sin`, `exp` from `three/tsl`; `displace`, `length` re-added from `@lovo/matter` / `three/tsl`.
- Produces: `DotFieldProps` / `DotFieldShaderProps` gain `speed`, `amplitude`, `wavelength`, `decay` (`AnimatableProp<number>`) and `center` (`[number, number]`). Demo `Params` gain `speed`, `amplitude`, `wavelength`, `decay`, `centerX`, `centerY`.

**Defaults (starting feel — tune at the gate):** `speed = 1`, `amplitude = 0.4` (fraction of spacing), `wavelength = 160` (px), `decay = 1`, `center = [0.5, 0.5]`.

- [ ] **Step 1 (co-write): Add the ripple imports and props to `shader.tsx`**

Chunk concept: re-add `displace` (from `@lovo/matter`) and `length` (from `three/tsl`) that Phase 2 removed; add `elapsedTime` (from `@lovo/matter`) and `sin`, `exp` (from `three/tsl`). Extend `DotFieldShaderProps` with `speed`, `amplitude`, `wavelength`, `decay` (all `AnimatableProp<number>`) and `center: [number, number]`. Explain: `elapsedTime` is a TSL node that carries the scene clock into the graph; `sin`/`exp` are the TSL math nodes for the wave and the falloff.

Import block after this step:
```ts
import { displace, elapsedTime, signedDistanceFieldCircle, type TSLNode } from '@lovo/matter';
import {
  type AnimatableProp,
  useAnimatableUniform,
  useResize,
  useShaderContext,
} from '@lovo/matter-react';
import { exp, length, mix, round, sin, smoothstep, uniform, uv, vec2, vec3, vec4 } from 'three/tsl';
import { Mesh, MeshBasicNodeMaterial, PlaneGeometry, Vector2 } from 'three/webgpu';
```
Props interface after this step:
```ts
export interface DotFieldShaderProps {
  spacing: AnimatableProp<number>;
  dotSize: AnimatableProp<number>;
  color: string;
  speed: AnimatableProp<number>;
  amplitude: AnimatableProp<number>;
  wavelength: AnimatableProp<number>;
  decay: AnimatableProp<number>;
  center: [number, number];
}
```

- [ ] **Step 2 (co-write): Rewrite `buildDotFieldMaterial` with the ripple**

Chunk concept: the material builder takes the new uniforms and computes a radial standing/traveling wave. Explain each line as it goes in:
- `cellToCenterPx` — vector from `center` (normalized UV) to each cell center, scaled to px by the resolution.
- `phase = dist/wavelength − time·speed` — rings of constant phase expand outward as `elapsedTime` grows.
- `wave = sin(phase·2π)` — the −1..1 oscillation; the `·2π` makes `wavelength` a true period in px.
- `distNorm` — distance normalized against half the resolution diagonal (`length(res)·0.5`), so the falloff shape is the same at any canvas size.
- `falloff = exp(−distNorm·decay)` — 1 at center, decaying outward; `decay = 0` ⇒ 1 everywhere (uniform field).
- `offset = dir·wave·amplitude·falloff` — radial displacement in **cell-local units**, where 1.0 = one cell = `spacing` px, so `amplitude` reads directly as a fraction of `spacing` (no extra scaling).

Target builder:
```ts
function buildDotFieldMaterial(
  spacingUniform: TSLNode,
  dotSizeUniform: TSLNode,
  speedUniform: TSLNode,
  amplitudeUniform: TSLNode,
  wavelengthUniform: TSLNode,
  decayUniform: TSLNode,
  centerUniform: TSLNode,
  resUniform: TSLNode,
  color: readonly [number, number, number],
): MeshBasicNodeMaterial {
  const [redChannel, greenChannel, blueChannel] = color;

  // Center-anchored cell coordinate (0 at canvas center), carried over from Phase 2.
  const cellCoord = uv().sub(0.5).mul(resUniform).div(spacingUniform);
  const cellLocal = cellCoord.sub(round(cellCoord));

  // Radial ripple: phase grows with distance from the ripple center and recedes over time.
  // Each cell's center back in normalized UV, then the vector to the ripple origin.
  // (Uniforms are only ever arguments here — never bare-uniform receivers — per Gotcha #12.)
  const cellCenterUv = round(cellCoord).mul(spacingUniform).div(resUniform).add(0.5);
  const cellToCenterPx = cellCenterUv.sub(centerUniform).mul(resUniform);
  const distToCenterPx = length(cellToCenterPx);
  // +0.001 avoids div-by-zero for the cell exactly at center
  const dirFromCenter = cellToCenterPx.div(distToCenterPx.add(0.001));

  const phase = distToCenterPx.div(wavelengthUniform).sub(elapsedTime.mul(speedUniform));
  const wave = sin(phase.mul(Math.PI * 2));

  const distNorm = distToCenterPx.div(length(resUniform).mul(0.5));
  const falloff = exp(distNorm.mul(decayUniform).mul(-1));

  const offset = dirFromCenter.mul(wave).mul(amplitudeUniform).mul(falloff);
  const displacedLocal = displace(cellLocal, offset);

  const zeroScalar = vec2(0).x;
  const radius = zeroScalar.add(dotSizeUniform).div(zeroScalar.add(spacingUniform).mul(2));
  const sdf = signedDistanceFieldCircle(displacedLocal, radius);

  const antialiasWidth = 0.01;
  const dotMask = smoothstep(antialiasWidth, -antialiasWidth, sdf);
  const dotColor = mix(vec3(0, 0, 0), vec3(redChannel, greenChannel, blueChannel), dotMask);

  const material = new MeshBasicNodeMaterial();

  material.colorNode = vec4(dotColor, dotMask);

  return material;
}
```

- [ ] **Step 3 (co-write): Add the uniforms + center handling to `DotFieldShader`**

Chunk concept: add `useAnimatableUniform` for `speed`/`amplitude`/`wavelength`/`decay`; route `center` through a stable `Vector2` uniform (Gotcha #19 — never list the raw tuple in a heavy effect's deps) with a light effect that pushes `center[0]`/`center[1]` into it; pass all new uniforms to the builder and list them in the build effect's dep array.

Target component:
```tsx
export function DotFieldShader({
  spacing,
  dotSize,
  color,
  speed,
  amplitude,
  wavelength,
  decay,
  center,
}: DotFieldShaderProps) {
  const shaderContext = useShaderContext();
  const resize = useResize();

  const spacingUniform = useAnimatableUniform<number>(spacing);
  const dotSizeUniform = useAnimatableUniform<number>(dotSize);
  const speedUniform = useAnimatableUniform<number>(speed);
  const amplitudeUniform = useAnimatableUniform<number>(amplitude);
  const wavelengthUniform = useAnimatableUniform<number>(wavelength);
  const decayUniform = useAnimatableUniform<number>(decay);

  const parsedColor = useMemo(() => parseColor(color), [color]);

  const centerVec = useMemo(() => new Vector2(center[0], center[1]), []);
  const centerUniform = useMemo(() => uniform(centerVec), [centerVec]);

  useEffect(() => {
    centerVec.set(center[0], center[1]);
  }, [centerVec, center]);

  const resVec = useMemo(() => new Vector2(1920, 1080), []);
  const resUniform = useMemo(() => uniform(resVec), [resVec]);

  useEffect(() => {
    const [canvasWidth, canvasHeight] = resize.get();

    if (canvasWidth > 0 && canvasHeight > 0) resVec.set(canvasWidth, canvasHeight);

    return resize.on('change', ([updatedWidth, updatedHeight]) =>
      resVec.set(updatedWidth, updatedHeight),
    );
  }, [resize, resVec]);

  useEffect(() => {
    if (!shaderContext) return;

    const material = buildDotFieldMaterial(
      spacingUniform,
      dotSizeUniform,
      speedUniform,
      amplitudeUniform,
      wavelengthUniform,
      decayUniform,
      centerUniform,
      resUniform,
      parsedColor,
    );
    const mesh = new Mesh(new PlaneGeometry(2, 2), material);

    shaderContext.scene.add(mesh);

    return () => {
      shaderContext.scene.remove(mesh);
      try {
        material.dispose();
      } catch {
        /* benign during rebuild */
      }
      try {
        mesh.geometry.dispose();
      } catch {
        /* same */
      }
    };
  }, [
    shaderContext,
    parsedColor,
    spacingUniform,
    dotSizeUniform,
    speedUniform,
    amplitudeUniform,
    wavelengthUniform,
    decayUniform,
    centerUniform,
    resUniform,
  ]);

  return null;
}
```
Note on the `center` effect deps: listing `center` (the tuple) is fine here because this effect is trivial (a `Vector2.set`), not the heavy material rebuild — the rule in Gotcha #19 is about keeping tuples out of *heavy* effect deps. The material effect depends only on the stable `centerUniform` node, so a new tuple identity each render mutates the Vector2 without recompiling the material.

- [ ] **Step 4: Verify the shader compiles (read-only)**

After the user confirms the chunks are in, the assistant may `Read` `shader.tsx` to verify (read-only), then:
```bash
pnpm --filter @matter/registry typecheck
```
Expected: PASS. Surface any issue back to the user — do not silently edit `shader.tsx`.

- [ ] **Step 5: Add the new props to the wrapper `dot-field.tsx`**

```tsx
'use client';

import type { AnimatableProp } from '@lovo/matter-react';

import { DotFieldShader } from './shader';

export interface DotFieldProps {
  /** Grid cell size in pixels. */
  spacing?: AnimatableProp<number>;
  /** Dot radius in pixels. */
  dotSize?: AnimatableProp<number>;
  /** Dot color — hex, `oklch()`, or `oklab()`. */
  color?: string;
  /** Ripple travel speed (rings expand faster as this grows). */
  speed?: AnimatableProp<number>;
  /** Peak radial displacement, as a fraction of `spacing` (≈0–0.9). */
  amplitude?: AnimatableProp<number>;
  /** Distance between wave crests, in pixels. */
  wavelength?: AnimatableProp<number>;
  /** How quickly ripples fade with distance from `center`. 0 = no decay (uniform field). */
  decay?: AnimatableProp<number>;
  /** Ripple origin in normalized UV; `[0.5, 0.5]` is centered. */
  center?: [number, number];
}

export function DotField({
  spacing = 30,
  dotSize = 2,
  color = '#8B918C',
  speed = 1,
  amplitude = 0.4,
  wavelength = 160,
  decay = 1,
  center = [0.5, 0.5],
}: DotFieldProps) {
  return (
    <DotFieldShader
      amplitude={amplitude}
      center={center}
      color={color}
      decay={decay}
      dotSize={dotSize}
      spacing={spacing}
      speed={speed}
      wavelength={wavelength}
    />
  );
}
```

- [ ] **Step 6: Add the new props to the demo scene `scene.tsx`**

```tsx
'use client';

import type { ReactNode } from 'react';

import { ShaderScene } from '@lovo/matter-react';
import { DotField } from '@matter/registry/dot-field';

import { INITIAL, type Params } from './params';

export default function DotFieldScene({
  params = INITIAL,
  children,
}: {
  params?: Params;
  children?: ReactNode;
} = {}) {
  return (
    <ShaderScene>
      <DotField
        amplitude={params.amplitude}
        center={[params.centerX, params.centerY]}
        color={params.color}
        decay={params.decay}
        dotSize={params.dotSize}
        spacing={params.spacing}
        speed={params.speed}
        wavelength={params.wavelength}
      />
      {children}
    </ShaderScene>
  );
}
```

- [ ] **Step 7: Add the new params `params.ts`**

```ts
export interface Params {
  color: string;
  spacing: number;
  dotSize: number;
  speed: number;
  amplitude: number;
  wavelength: number;
  decay: number;
  centerX: number;
  centerY: number;
}

export const INITIAL: Params = {
  color: 'oklch(0.65 0.01 150)',
  spacing: 30,
  dotSize: 2,
  speed: 1,
  amplitude: 0.4,
  wavelength: 160,
  decay: 1,
  centerX: 0.5,
  centerY: 0.5,
};
```

- [ ] **Step 8: Add the new Tweakpane bindings + inline snippet in `page.tsx`**

Replace the binding callback body:
```ts
      // Wide-gamut color picker: the built-in picker is sRGB and rejects
      // oklch()/oklab() strings, so register color-plus for P3-capable input.
      pane.registerPlugin(TweakpanePluginColorPlus);
      pane.addBinding(local, 'color', {
        label: 'color',
        view: 'color-plus',
        color: { formatLocked: true },
      });
      pane.addBlade({ view: 'separator' });
      pane.addBinding(local, 'spacing', { min: 8, max: 80, step: 1 });
      pane.addBinding(local, 'dotSize', {
        label: 'dot size',
        min: 1,
        max: 8,
        step: 0.5,
      });
      pane.addBlade({ view: 'separator' });
      pane.addBinding(local, 'speed', { min: 0, max: 4, step: 0.05 });
      pane.addBinding(local, 'amplitude', { min: 0, max: 0.9, step: 0.01 });
      pane.addBinding(local, 'wavelength', { min: 20, max: 400, step: 5 });
      pane.addBinding(local, 'decay', { min: 0, max: 5, step: 0.05 });
      pane.addBlade({ view: 'separator' });
      pane.addBinding(local, 'centerX', { label: 'center x', min: 0, max: 1, step: 0.01 });
      pane.addBinding(local, 'centerY', { label: 'center y', min: 0, max: 1, step: 0.01 });
      pane.on('change', sync);
```

Update the inline usage snippet (`<pre>` block):
```tsx
          {`<ShaderScene>
  <DotField spacing={30} dotSize={2} color="oklch(0.65 0.01 150)" speed={1} amplitude={0.4} />
</ShaderScene>`}
```

- [ ] **Step 9: Typecheck + lint**

```bash
pnpm --filter @matter/registry typecheck && pnpm --filter @matter/docs typecheck && pnpm lint
```
Expected: PASS.

- [ ] **Step 10: Stop-and-play gate (the feel decision)**

Restart `pnpm dev:docs`, open the dot-field page. Watch the ripple: concentric rings should expand from center and fade toward the edges. Sweep `speed`, `wavelength`, `amplitude`, `decay`, and drag `center x`/`center y`. **User decides the shipped defaults** (`speed`/`wavelength`/`amplitude`/`decay`) here. If any default changes, update both the wrapper (`dot-field.tsx`) and `INITIAL` (`params.ts`) to match before committing. Also decide here whether the exponential falloff feels right or should become a `smoothstep` band (a small co-write follow-up if so).

- [ ] **Step 11: Commit**

```bash
git add registry/dot-field apps/docs/src/app/components/dot-field
git commit -m "feat(dot-field): self-driven radial ripple with distance decay"
```

---

## Phase 4: Regenerate poster + baselines, full verification, finish

**Why:** Phases 2–3 changed the default rendered look (interactive grid → animated ripple), which invalidates the dot-field poster and Playwright baseline. The animated frame is deterministic via the existing `VisualTestPause` seam (clock reset on frame 1, pause at frame 2), so only asset regeneration is needed — no spec/test-code changes.

**Files:**
- Regenerate: `apps/docs/public/posters/dot-field.png`
- Regenerate: `apps/docs-tests/visual/dot-field.spec.ts-snapshots/dot-field-default-chromium-{darwin,linux}.png`

> **Environment:** run on pinned **Node 22** (`project_docs_build_node23`); `pnpm snap` needs Docker (`project_ci_gotchas`). Confirm the toolchain before running.

- [ ] **Step 1: Build the CLI (poster generator dependency)**

```bash
pnpm --filter @lovo/matter-cli build
```
Expected: `packages/matter-cli/dist/index.js` exists (the poster script checks for it).

- [ ] **Step 2: Regenerate the dot-field poster**

```bash
pnpm posters
```
Confirm `apps/docs/public/posters/dot-field.png` now shows the animated ripple's deterministic frame (concentric rings from center). Only `dot-field.png` should change meaningfully in `git status`.

- [ ] **Step 3: Regenerate visual baselines**

```bash
pnpm snap
```
Confirm only the dot-field baselines moved; nothing unrelated should change.

- [ ] **Step 4: Run the visual regression suite**

```bash
pnpm test:visual
```
Expected: PASS against the regenerated baselines.

- [ ] **Step 5: Full project verification**

```bash
pnpm typecheck && pnpm lint && pnpm format:check && pnpm build
```
Expected: all PASS. (Run `pnpm format` first if `format:check` flags anything.)

- [ ] **Step 6: Commit regenerated assets**

```bash
git add apps/docs/public/posters/dot-field.png "apps/docs-tests/visual/dot-field.spec.ts-snapshots/"
git commit -m "test(docs): regenerate dot-field poster and visual baselines"
```

- [ ] **Step 7: Final stop-and-play gate + branch finish**

Walk the user through the full diff. Then use `superpowers:finishing-a-development-branch` to decide merge/PR for **both** branches (MAT-43 decode PR + this refactor PR). PR prose follows `feedback_pr_style` (concise, lead with why, run through `superpowers:humanizer`, no Test plan / Follow-ups sections, no planning-artifact links, no Claude attribution).

---

## Self-Review

**Spec coverage** (each spec section → task):
- *Modernize the pattern (wrapper + shader.tsx split, JSDoc, destructured defaults, keep `parseColor`)* → Phase 1 (split, verbatim) + Phase 2/3 (JSDoc'd wrapper); `parseColor` preserved throughout, import path fixed in Phase 1.
- *Remove interactiveness (cursor plumbing + `reach`/`strength`/`interactive`/`inputs`)* → Phase 2.
- *Radial concentric ripple off the scene clock* → Phase 3 Steps 1–3 (`elapsedTime`, `sin`, radial `dir·wave`).
- *Decay with distance (`decay` prop, resolution-normalized `exp` falloff)* → Phase 3 Step 2 (`distNorm`, `falloff`).
- *Prop surface table (spacing/dotSize/color kept; reach/strength/interactive/inputs removed; speed/amplitude/wavelength/decay/center added; amplitude as fraction of spacing)* → wrapper/shader props in Phases 2–3; amplitude-as-fraction documented in JSDoc + the builder comment.
- *Demo + deterministic baselines* → Phase 2/3 (scene/params/page) + Phase 4 (regeneration); determinism confirmed via existing `VisualTestPause`.
- *Branch/PR plan (commit MAT-43, then branch)* → Phase 0.
- *Out of scope (colorSpace/hueInterpolation, shared hooks, multiple/non-radial sources)* → not present in any task; Global Constraints restate the colorSpace/hook exclusions.

**Placeholder scan:** No "TBD"/"handle edge cases"/"write tests for the above". Co-write steps carry the exact target code; mechanical steps show full files or exact replacement blocks. The one open item (exp vs smoothstep falloff) is an explicit feel-gate decision in Phase 3 Step 10, not a placeholder.

**Type consistency:** `DotFieldShaderProps` and `DotFieldProps` carry the same field names across phases; `speed`/`amplitude`/`wavelength`/`decay` are `AnimatableProp<number>`, `center` is `[number, number]`, in wrapper, shader, and (as `centerX`/`centerY`) demo params. `buildDotFieldMaterial`'s parameter order matches its call site in every phase. `elapsedTime`/`displace` import from `@lovo/matter`; `sin`/`exp`/`length` from `three/tsl`. `parseColor` from `../utils/color` (directory depth corrected in Phase 1).

# M9 — Drop pure TSL re-exports from `@lovo/matter` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the pure pass-through re-exports of TSL primitives (`uv`, `vec2`, `vec3`, `vec4`, `uniform`, `mix`, `smoothstep`, `mod`, `sin`, `cos`, `length`, `dot`, `normalize`, `max`, `min`) from `@lovo/matter`'s public surface; keep `time` (Matter-owned, reduced-motion gated) and all named-and-wrapped primitives (`fbm`, `noise`, `voronoi`, `colorRamp`, `sdfCircle`, `displace`, `cursorRipple`, `quantize`). Ship as 0.2.0.

**Architecture:** Honest layering — Matter owns the value-add primitives; users import raw TSL from `three/tsl` directly. The whole change is mechanical: one new file (`primitives/time.ts`), one deleted file (`primitives/tsl-reexports.ts`), one updated index, and ~12 consumer files split their imports between `three/tsl` and `@lovo/matter`. Phases are ordered so the tree stays green (typecheck + build) between every commit: consumers migrate FIRST, engine drops the exports LAST.

**Tech Stack:** TypeScript 5 strict, pnpm 9 workspaces, Vite+ wrapping (`vp run` ≡ `pnpm`), tsup, Vitest 4, changesets (fixed package group). No new dependencies. Validation via existing `vp run typecheck`, `vp run build`, `vp test`, `pnpm smoke`, and the M5 Playwright visual regression suite.

**Breaking change:** Yes. Pre-1.0 convention: use `minor` in the changeset → 0.1.0 → 0.2.0 across all three fixed-group packages.

---

## File Inventory

**Engine package — `packages/matter/`**
- Create: `packages/matter/src/primitives/time.ts` — new home for the gated `time` export.
- Modify: `packages/matter/src/primitives/tsl-reexports.ts` — strip the `time` block (leaves only the pure pass-throughs).
- Modify: `packages/matter/src/index.ts` — add explicit `export { time } from './primitives/time.js'`.
- Rename: `packages/matter/src/primitives/tsl-reexports.test.ts` → `packages/matter/src/primitives/time.test.ts`. Update internal import to `./time.js`.
- Delete: `packages/matter/src/primitives/tsl-reexports.ts` (in Phase 9.4, after consumers migrate).
- Modify: `packages/matter/src/index.ts` (Phase 9.4) — remove `export * from './primitives/tsl-reexports.js'`.

**Registry components — `registry/`**
- Modify: `registry/linear-gradient.tsx` (line 5).
- Modify: `registry/mesh-gradient.tsx` (lines 8–9).
- Modify: `registry/noise-field.tsx` (lines 8–10).
- Modify: `registry/dot-field.tsx` (lines 8–9).
- Modify: `registry/waves.tsx` (lines 8–9).
- No change: `registry/aurora/shader.tsx` — already imports only `time, noise` from `@lovo/matter`.

**Docs site — `apps/docs/src/`**
- Modify: `apps/docs/src/app/dev/fbm-playground/FbmScene.tsx` (line 12).
- Modify: `apps/docs/src/app/dev/mesh-gradient-playground/MeshGradientPlaygroundScene.tsx` (lines 14–15).
- Modify: `apps/docs/src/components/RecipeScene.tsx` (line 5).
- Modify: `apps/docs/src/components/PrimitiveScene.tsx` (lines 7–26).
- Modify: `apps/docs/src/app/recipes/_builds.ts` (lines 23–38).
- Modify: `apps/docs/src/data/recipes.ts` — rewrite the four `source:` template-literal strings (lines 39, 72, 104, 134).
- Modify: `apps/docs/src/data/primitives.ts` — drop the `uv` PRIMITIVES entry; refresh the `time` entry description.

**MDX docs — `apps/docs/content/`**
- Modify: `apps/docs/content/docs/reference/matter.mdx` — replace the "TSL re-exports" section with a layering note + explicit `time` documentation.
- Modify: `apps/docs/content/docs/react/api.mdx` (lines 44, 70) — switch example imports of `uv`/`uniform` to `three/tsl`.
- Modify: `apps/docs/content/docs/changelog.mdx` — add 0.2.0 entry.

**Spec & backlog — `docs/superpowers/`**
- Modify: `docs/superpowers/specs/2026-05-02-matter-design.md` § 4.1 — update the engine API description.
- Modify: `docs/superpowers/ideas-backlog.md` — strike through / mark the "Drop pure TSL re-exports" entry as shipped in 0.2.0.

**Release artifacts**
- Create: `.changeset/drop-tsl-reexports.md`.
- Tag (after merge): `m9-complete`, `v0.2.0`.

---

## Phase 9.1 — Move `time` to its own file (additive, non-breaking)

**Files:**
- Create: `packages/matter/src/primitives/time.ts`
- Modify: `packages/matter/src/primitives/tsl-reexports.ts`
- Modify: `packages/matter/src/index.ts`
- Rename: `packages/matter/src/primitives/tsl-reexports.test.ts` → `packages/matter/src/primitives/time.test.ts`

### Task 9.1.1: Extract `time` into its own primitive file

- [ ] **Step 1: Create `packages/matter/src/primitives/time.ts`**

File: `packages/matter/src/primitives/time.ts`

```ts
// Engine-gated `time` — equals the TSL built-in `time` multiplied by the
// reduced-motion scale uniform. Components consuming `time` from `@lovo/matter`
// automatically respect `prefers-reduced-motion` and the policy override set
// via `setReducedMotionPolicy`.
//
// If you want raw uncapped time (e.g. for a debug overlay), import `time`
// from `three/tsl` directly.

import { time as _builtinTime } from 'three/tsl';
import type { ShaderNodeObject } from 'three/tsl';
import type { Node } from 'three/webgpu';
import { getReducedMotionTimeScale } from '../runtime/reducedMotion.js';

export const time: ShaderNodeObject<Node> = _builtinTime.mul(
  getReducedMotionTimeScale(),
);
```

- [ ] **Step 2: Strip the `time` block from `tsl-reexports.ts`**

Edit `packages/matter/src/primitives/tsl-reexports.ts` so it contains only the pure pass-throughs (we'll delete this whole file in Phase 9.4, but for now it stays so existing imports keep working).

Final content:

```ts
// Pure pass-throughs of TSL primitives. To be removed in 0.2.0 (M9 Phase 9.4).
// Kept transiently so consumers can migrate before the engine drops them.

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
  uv,
  max,
  min,
} from 'three/tsl';
```

- [ ] **Step 3: Add the explicit `time` export to `index.ts`**

Edit `packages/matter/src/index.ts`. Add a line near the other primitive exports (alongside `colorRamp`, `noise`, `fbm`, etc.):

```ts
export { time } from './primitives/time.js'
```

Leave `export * from './primitives/tsl-reexports.js'` in place for now — it no longer exports `time`, but it does still export the pure pass-throughs (consumers haven't migrated yet).

- [ ] **Step 4: Rename the test file and update its import**

```bash
git mv packages/matter/src/primitives/tsl-reexports.test.ts packages/matter/src/primitives/time.test.ts
```

Then edit `packages/matter/src/primitives/time.test.ts`:

```ts
// CHANGE: import path
import { time } from './time.js'
```

The rest of the test file is unchanged.

- [ ] **Step 5: Build + typecheck + test the engine package**

```bash
vp run @lovo/matter#build
vp run @lovo/matter#typecheck
vp run @lovo/matter#test
```

Expected: all three green. `time` is now exported from `./primitives/time.js`; the pure pass-throughs are still re-exported from the (now leaner) `tsl-reexports.ts`.

- [ ] **Step 6: Typecheck the whole monorepo**

```bash
vp run typecheck
```

Expected: green. Consumers still import everything from `@lovo/matter` and the surface is identical from their perspective.

- [ ] **Step 7: Commit**

```bash
git add packages/matter/src/primitives/time.ts \
        packages/matter/src/primitives/tsl-reexports.ts \
        packages/matter/src/primitives/time.test.ts \
        packages/matter/src/index.ts
git commit -m "refactor(matter): split gated time out of tsl-reexports

Moves the engine-owned reduced-motion-gated time export into its own
primitive file (primitives/time.ts), leaving tsl-reexports.ts holding
only the pure TSL pass-throughs ahead of their removal in 0.2.0."
```

---

## Phase 9.2 — Migrate registry components to import pure pass-throughs from `three/tsl`

**Files:**
- Modify: `registry/linear-gradient.tsx`
- Modify: `registry/mesh-gradient.tsx`
- Modify: `registry/noise-field.tsx`
- Modify: `registry/dot-field.tsx`
- Modify: `registry/waves.tsx`

Each registry file gets exactly one logical change: split its `@lovo/matter` imports into two — pure-TSL from `three/tsl`, Matter-owned from `@lovo/matter`. After this phase, the registry components themselves no longer rely on the pass-throughs.

### Task 9.2.1: Migrate `registry/linear-gradient.tsx`

- [ ] **Step 1: Replace lines 5–6**

Before:

```ts
import { vec3, vec2, mod, length, uv, time, uniform } from '@lovo/matter'
import { colorRamp, type ColorRampStop } from '@lovo/matter'
```

After:

```ts
import { vec3, vec2, mod, length, uv, uniform } from 'three/tsl'
import { time, colorRamp, type ColorRampStop } from '@lovo/matter'
```

- [ ] **Step 2: Typecheck the registry workspace**

```bash
vp run @matter/registry#typecheck
```

Expected: green.

### Task 9.2.2: Migrate `registry/mesh-gradient.tsx`

- [ ] **Step 1: Replace lines 8–9**

Before:

```ts
import { vec2, vec3, vec4, length, max, min, time, uv, uniform } from '@lovo/matter'
import { noise } from '@lovo/matter'
```

After:

```ts
import { vec2, vec3, vec4, length, max, min, uv, uniform } from 'three/tsl'
import { time, noise } from '@lovo/matter'
```

- [ ] **Step 2: Typecheck**

```bash
vp run @matter/registry#typecheck
```

### Task 9.2.3: Migrate `registry/noise-field.tsx`

- [ ] **Step 1: Replace lines 8–10**

Before:

```ts
import { vec2, vec3, uv, time, uniform } from '@lovo/matter'
import { colorRamp, type ColorRampStop } from '@lovo/matter'
import { fbm, voronoi, quantize } from '@lovo/matter'
```

After:

```ts
import { vec2, vec3, uv, uniform } from 'three/tsl'
import { time, colorRamp, fbm, voronoi, quantize, type ColorRampStop } from '@lovo/matter'
```

- [ ] **Step 2: Typecheck**

```bash
vp run @matter/registry#typecheck
```

### Task 9.2.4: Migrate `registry/dot-field.tsx`

- [ ] **Step 1: Replace lines 8–9**

Before:

```ts
import { vec2, vec3, vec4, mix, mod, length, smoothstep, uv, uniform } from '@lovo/matter'
import { sdfCircle, displace } from '@lovo/matter'
```

After:

```ts
import { vec2, vec3, vec4, mix, mod, length, smoothstep, uv, uniform } from 'three/tsl'
import { sdfCircle, displace } from '@lovo/matter'
```

(`dot-field` doesn't import `time` — it relies on `cursorRipple`/`displace`-driven motion only — so this one is the simplest split.)

- [ ] **Step 2: Typecheck**

```bash
vp run @matter/registry#typecheck
```

### Task 9.2.5: Migrate `registry/waves.tsx`

- [ ] **Step 1: Replace lines 8–9**

Before:

```ts
import { vec2, vec3, vec4, sin, mix, smoothstep, uv, time, uniform } from '@lovo/matter'
import { cursorRipple } from '@lovo/matter'
```

After:

```ts
import { vec2, vec3, vec4, sin, mix, smoothstep, uv, uniform } from 'three/tsl'
import { time, cursorRipple } from '@lovo/matter'
```

- [ ] **Step 2: Typecheck**

```bash
vp run @matter/registry#typecheck
```

### Task 9.2.6: Validate the registry visually + commit

- [ ] **Step 1: Run the visual regression suite (M5 Playwright)**

```bash
vp run @matter/docs-tests#test:visual
```

Expected: green. Same TSL math, same uniforms, same `time` semantics — pixels should be identical.

If the suite fails on baselines for unrelated reasons (canvas size drift etc.), regenerate per the M8 pattern from commit `d421882`; do NOT regenerate to mask a real visual regression introduced by this migration.

- [ ] **Step 2: Sanity check in the dev server**

```bash
vp run @matter/docs#dev
```

Open the six component routes and confirm they render visually identical:
- `http://localhost:3000/components/linear-gradient`
- `http://localhost:3000/components/mesh-gradient`
- `http://localhost:3000/components/noise-field`
- `http://localhost:3000/components/dot-field`
- `http://localhost:3000/components/waves`
- `http://localhost:3000/components/aurora`

- [ ] **Step 3: Commit**

```bash
git add registry/linear-gradient.tsx \
        registry/mesh-gradient.tsx \
        registry/noise-field.tsx \
        registry/dot-field.tsx \
        registry/waves.tsx
git commit -m "refactor(registry): import pure TSL primitives from three/tsl

Splits the @lovo/matter import block in each Tier 1 component into
two — pure TSL primitives (vec2/3/4, uv, uniform, mix, smoothstep,
mod, sin, cos, length, max, min, dot, normalize) now come straight
from three/tsl. Matter-owned primitives (time, colorRamp, fbm, noise,
voronoi, quantize, sdfCircle, displace, cursorRipple) still come
from @lovo/matter. Prep for dropping the pass-through re-exports in
0.2.0."
```

---

## Phase 9.3 — Migrate docs site internal code

**Files:**
- Modify: `apps/docs/src/app/dev/fbm-playground/FbmScene.tsx`
- Modify: `apps/docs/src/app/dev/mesh-gradient-playground/MeshGradientPlaygroundScene.tsx`
- Modify: `apps/docs/src/components/RecipeScene.tsx`
- Modify: `apps/docs/src/components/PrimitiveScene.tsx`
- Modify: `apps/docs/src/app/recipes/_builds.ts`
- Modify: `apps/docs/src/data/recipes.ts`
- Modify: `apps/docs/src/data/primitives.ts`

### Task 9.3.1: Migrate `FbmScene.tsx`

- [ ] **Step 1: Replace line 12**

Before:

```ts
import { vec2, vec3, uv, time, uniform } from '@lovo/matter'
```

After:

```ts
import { vec2, vec3, uv, uniform } from 'three/tsl'
import { time } from '@lovo/matter'
```

- [ ] **Step 2: Typecheck**

```bash
vp run @matter/docs#typecheck
```

### Task 9.3.2: Migrate `MeshGradientPlaygroundScene.tsx`

- [ ] **Step 1: Replace lines 14–15**

Before:

```ts
import { vec2, vec3, vec4, length, uv, time, uniform } from '@lovo/matter'
import { noise } from '@lovo/matter'
```

After:

```ts
import { vec2, vec3, vec4, length, uv, uniform } from 'three/tsl'
import { time, noise } from '@lovo/matter'
```

- [ ] **Step 2: Typecheck**

```bash
vp run @matter/docs#typecheck
```

### Task 9.3.3: Migrate `RecipeScene.tsx`

- [ ] **Step 1: Replace line 5**

Before:

```ts
import { uniform } from '@lovo/matter'
```

After:

```ts
import { uniform } from 'three/tsl'
```

- [ ] **Step 2: Typecheck**

```bash
vp run @matter/docs#typecheck
```

### Task 9.3.4: Migrate `PrimitiveScene.tsx`

- [ ] **Step 1: Replace lines 7–26**

Before:

```ts
import {
  uv,
  vec2,
  vec3,
  vec4,
  time,
  uniform,
  sin,
  smoothstep,
  mix,
  noise,
  fbm,
  voronoi,
  quantize,
  sdfCircle,
  displace,
  cursorRipple,
  colorRamp,
  type ColorRampStop,
} from '@lovo/matter'
```

After:

```ts
import { uv, vec2, vec3, vec4, uniform, sin, smoothstep, mix } from 'three/tsl'
import {
  time,
  noise,
  fbm,
  voronoi,
  quantize,
  sdfCircle,
  displace,
  cursorRipple,
  colorRamp,
  type ColorRampStop,
} from '@lovo/matter'
```

- [ ] **Step 2: Typecheck**

```bash
vp run @matter/docs#typecheck
```

### Task 9.3.5: Migrate `apps/docs/src/app/recipes/_builds.ts`

- [ ] **Step 1: Replace lines 23–38 (the import block above `RECIPE_BUILDS`)**

Before:

```ts
import {
  uv,
  time,
  vec2,
  vec3,
  vec4,
  sin,
  length,
  smoothstep,
  fbm,
  voronoi,
  quantize,
  colorRamp,
  max,
  type ColorRampStop,
} from '@lovo/matter'
import type { uniform } from '@lovo/matter'
```

After:

```ts
import { uv, vec2, vec3, vec4, sin, length, smoothstep, max } from 'three/tsl'
import type { uniform } from 'three/tsl'
import {
  time,
  fbm,
  voronoi,
  quantize,
  colorRamp,
  type ColorRampStop,
} from '@lovo/matter'
```

- [ ] **Step 2: Typecheck**

```bash
vp run @matter/docs#typecheck
```

### Task 9.3.6: Rewrite the `source:` strings in `recipes.ts`

The strings are shown to users on the `/recipes/*` pages. They must match the new convention.

- [ ] **Step 1: Find each `source:` block**

```bash
grep -n "from '@lovo/matter'" apps/docs/src/data/recipes.ts
```

Expected: 4 matches at lines 39, 72, 104, 134.

- [ ] **Step 2: Rewrite each source string**

For each `source: \`...\`` template literal, replace its first import line(s) so pure pass-throughs come from `three/tsl` and Matter-owned primitives come from `@lovo/matter`.

Line 39 (animated-stripes):

```ts
// BEFORE
source: `import { uv, time, vec3, vec4, sin, colorRamp } from '@lovo/matter'
...

// AFTER
source: `import { uv, vec3, vec4, sin } from 'three/tsl'
import { time, colorRamp } from '@lovo/matter'
...
```

Line 72 (cursor-glow):

```ts
// BEFORE
source: `import { uv, vec4, length, smoothstep, uniform } from '@lovo/matter'
import { Vector2 } from 'three/webgpu'
...

// AFTER
source: `import { uv, vec4, length, smoothstep, uniform } from 'three/tsl'
import { Vector2 } from 'three/webgpu'
...
```

Line 104 (flowing-bands):

```ts
// BEFORE
source: `import { uv, time, vec2, vec3, vec4, fbm, colorRamp } from '@lovo/matter'
...

// AFTER
source: `import { uv, vec2, vec3, vec4 } from 'three/tsl'
import { time, fbm, colorRamp } from '@lovo/matter'
...
```

Line 134 (cellular):

```ts
// BEFORE
source: `import { uv, vec4, voronoi, quantize } from '@lovo/matter'
...

// AFTER
source: `import { uv, vec4 } from 'three/tsl'
import { voronoi, quantize } from '@lovo/matter'
...
```

- [ ] **Step 3: Typecheck**

```bash
vp run @matter/docs#typecheck
```

### Task 9.3.7: Update `primitives.ts` — drop `uv` entry, refresh `time` entry

`uv` is no longer a Matter export; remove its `PrimitiveEntry`. `time` stays, but its description must no longer say "Re-exported from three/tsl" — explain the gating instead.

- [ ] **Step 1: Remove the `uv` PRIMITIVES entry**

In `apps/docs/src/data/primitives.ts`, delete the entire `uv` entry block:

```ts
// DELETE THIS BLOCK
{
  slug: 'uv',
  name: 'uv',
  description: '2D fragment coordinate, 0..1 across the canvas.',
  signature: `function uv(): TSLNode
// Re-exported from three/tsl. Returns a vec2 in UV-space (0,0)→(1,1).`,
  usedBy: ['linear-gradient', 'noise-field', 'dot-field', 'waves', 'mesh-gradient', 'aurora'],
  controls: [],
},
```

- [ ] **Step 2: Update the `time` entry**

Replace the `time` entry's `description` and `signature` so it documents the gated behavior:

```ts
{
  slug: 'time',
  name: 'time',
  description: 'Reduced-motion-gated seconds since the scene mounted.',
  signature: `const time: TSLNode
// Equals three/tsl's built-in time * reducedMotionScale. Honors
// prefers-reduced-motion and any setReducedMotionPolicy override.
// Import from '@lovo/matter'. For raw uncapped time, import from
// 'three/tsl' directly.`,
  usedBy: ['linear-gradient', 'noise-field', 'waves', 'mesh-gradient', 'aurora'],
  controls: [],
},
```

- [ ] **Step 3: Confirm no `/primitives/uv` route 404s break the site**

```bash
grep -rn "'uv'" apps/docs/src apps/docs/content 2>/dev/null
```

If anything else still references the `uv` slug as a primitive (e.g., nav config, cross-link lists), update it. Most likely zero hits.

- [ ] **Step 4: Typecheck + dev server**

```bash
vp run @matter/docs#typecheck
vp run @matter/docs#dev
```

Open `http://localhost:3000/primitives` and confirm:
- The list no longer includes `uv`.
- The `time` entry renders with the new description.
- No console errors about missing slug.

### Task 9.3.8: Commit Phase 9.3

- [ ] **Step 1: Stage and commit**

```bash
git add apps/docs/src/app/dev/fbm-playground/FbmScene.tsx \
        apps/docs/src/app/dev/mesh-gradient-playground/MeshGradientPlaygroundScene.tsx \
        apps/docs/src/components/RecipeScene.tsx \
        apps/docs/src/components/PrimitiveScene.tsx \
        apps/docs/src/app/recipes/_builds.ts \
        apps/docs/src/data/recipes.ts \
        apps/docs/src/data/primitives.ts
git commit -m "refactor(docs): import pure TSL primitives from three/tsl

Migrates all docs-site internal code (dev pages, scene components,
recipe builds, primitive catalog) and the displayed recipe source
strings to the new convention: pure TSL primitives from three/tsl,
Matter-owned primitives from @lovo/matter. Drops the uv entry from
the documented PRIMITIVES list since it's no longer a Matter export;
updates the time entry to describe the reduced-motion gating
explicitly."
```

---

## Phase 9.4 — Drop the pure pass-throughs from the engine

After Phases 9.2 and 9.3, no in-tree code imports the pass-throughs from `@lovo/matter`. Safe to delete now.

**Files:**
- Delete: `packages/matter/src/primitives/tsl-reexports.ts`
- Modify: `packages/matter/src/index.ts`

### Task 9.4.1: Confirm no in-tree consumer of the pass-throughs remains

- [ ] **Step 1: Grep for any leftover consumer**

```bash
grep -rn "from '@lovo/matter'" packages/ registry/ apps/ \
  | grep -E "\\b(uv|vec[234]|uniform|mix|smoothstep|mod|sin|cos|length|dot|normalize|max|min)\\b"
```

Expected: zero hits. If anything matches, migrate that file before continuing.

Note: matches inside `apps/docs/src/data/recipes.ts` source strings are fine — they live inside template literals and are user-visible documentation, not imports the bundler resolves; if you see them, double-check Task 9.3.6 actually rewrote them.

### Task 9.4.2: Delete `tsl-reexports.ts`

- [ ] **Step 1: Delete the file**

```bash
git rm packages/matter/src/primitives/tsl-reexports.ts
```

- [ ] **Step 2: Remove the wildcard re-export from `index.ts`**

Delete this line from `packages/matter/src/index.ts`:

```ts
// DELETE
// TSL re-exports — stable surface
export * from './primitives/tsl-reexports.js'
```

Confirm `export { time } from './primitives/time.js'` (added in Phase 9.1) is still present.

- [ ] **Step 3: Build + typecheck the engine package**

```bash
vp run @lovo/matter#build
vp run @lovo/matter#typecheck
vp run @lovo/matter#test
```

Expected: green. The `dist/index.d.ts` should no longer mention `uv`, `vec2`, `vec3`, `vec4`, `uniform`, `mix`, `smoothstep`, `mod`, `sin`, `cos`, `length`, `dot`, `normalize`, `max`, or `min`.

- [ ] **Step 4: Verify by inspecting `dist/index.d.ts`**

```bash
grep -E "^export.*\\b(uv|vec[234]|uniform|mix|smoothstep|mod|sin|cos|length|dot|normalize|max|min)\\b" \
  packages/matter/dist/index.d.ts
```

Expected: zero hits.

- [ ] **Step 5: Whole-monorepo typecheck + build + tests**

```bash
vp run typecheck
vp run build
vp test
```

Expected: green across the board.

- [ ] **Step 6: Visual regression**

```bash
vp run @matter/docs-tests#test:visual
```

Expected: green. (Final guard — same TSL math reaches the GPU through different import paths.)

- [ ] **Step 7: Commit**

```bash
git add packages/matter/src/primitives/tsl-reexports.ts \
        packages/matter/src/index.ts
git commit -m "feat(matter)!: drop pure TSL re-exports from public API

BREAKING CHANGE: @lovo/matter no longer re-exports pure TSL
primitives (uv, vec2, vec3, vec4, uniform, mix, smoothstep, mod,
sin, cos, length, dot, normalize, max, min). Import them from
three/tsl instead.

Matter-owned primitives (time, fbm, noise, voronoi, colorRamp,
sdfCircle, displace, cursorRipple, quantize) remain exported
from @lovo/matter unchanged. time keeps its reduced-motion
gating; its raw uncapped counterpart is still available from
three/tsl directly.

Rationale: Matter sits on top of TSL — it doesn't own those
primitives. Re-exporting them muddied the layer boundary and
provided no value (no rename, no added docs, no future-swap
benefit). Honest layering is the goal of 0.2.0."
```

---

## Phase 9.5 — Update docs MDX, spec, backlog

**Files:**
- Modify: `apps/docs/content/docs/reference/matter.mdx`
- Modify: `apps/docs/content/docs/react/api.mdx`
- Modify: `apps/docs/content/docs/changelog.mdx`
- Modify: `docs/superpowers/specs/2026-05-02-matter-design.md`
- Modify: `docs/superpowers/ideas-backlog.md`

### Task 9.5.1: Rewrite the `reference/matter.mdx` re-exports section

- [ ] **Step 1: Update frontmatter description**

Replace line 3 of `apps/docs/content/docs/reference/matter.mdx`:

```yaml
# BEFORE
description: '@lovo/matter — primitives, runtime, inputs, and TSL re-exports.'

# AFTER
description: '@lovo/matter — primitives, runtime, inputs, and reduced-motion-gated time.'
```

- [ ] **Step 2: Replace the "TSL re-exports" section**

Find the section starting with `## TSL re-exports` (around line 25). Replace it through the end of the code block with:

````mdx
## Layering and `time`

Matter sits on top of Three.js's TSL. Pure TSL primitives (`uv`, `vec2`, `vec3`, `vec4`, `uniform`, `mix`, `smoothstep`, `mod`, `sin`, `cos`, `length`, `dot`, `normalize`, `max`, `min`) live in `three/tsl` — import them directly from there:

```ts
import { uv, vec3, uniform, mix } from 'three/tsl'
```

Matter exports one TSL node of its own: **`time`**. It's the TSL built-in `time` multiplied by an engine-owned reduced-motion scale uniform, so every component that animates against `time` from `@lovo/matter` automatically respects `prefers-reduced-motion` and the policy override set via `setReducedMotionPolicy`.

```ts
import { time } from '@lovo/matter'
//  → equivalent to three/tsl's `time.mul(reducedMotionScale)`

// If you specifically want raw uncapped time (e.g. a debug overlay):
import { time as rawTime } from 'three/tsl'
```

> **Migrating from 0.1.x?** Before 0.2.0, `@lovo/matter` re-exported the TSL primitives listed above as a convenience. They're gone in 0.2.0 — replace `import { vec3, uv, … } from '@lovo/matter'` with `import { vec3, uv, … } from 'three/tsl'`. `time` is the only carry-over and stays imported from `@lovo/matter`.
````

- [ ] **Step 3: Save + view**

```bash
vp run @matter/docs#dev
```

Open `http://localhost:3000/reference/matter` and confirm the section renders cleanly.

### Task 9.5.2: Update `react/api.mdx` example imports

- [ ] **Step 1: Edit line 44**

```ts
// BEFORE
import { fbm, uv } from '@lovo/matter'

// AFTER
import { uv } from 'three/tsl'
import { fbm } from '@lovo/matter'
```

- [ ] **Step 2: Edit line 70**

```ts
// BEFORE
import { uniform } from '@lovo/matter'

// AFTER
import { uniform } from 'three/tsl'
```

- [ ] **Step 3: Save + view**

Open `http://localhost:3000/react/api` and confirm both code blocks render.

### Task 9.5.3: Add the 0.2.0 changelog entry

- [ ] **Step 1: Edit `apps/docs/content/docs/changelog.mdx`**

Prepend a new section above the existing 0.1.0 entry (preserve existing content below):

```mdx
## 0.2.0

**Breaking change — `@lovo/matter` no longer re-exports pure TSL primitives.**

The following 15 nodes are no longer exported by `@lovo/matter`. Import them directly from `three/tsl`:

`uv`, `vec2`, `vec3`, `vec4`, `uniform`, `mix`, `smoothstep`, `mod`, `sin`, `cos`, `length`, `dot`, `normalize`, `max`, `min`

```ts
// Before (0.1.x)
import { vec3, uv, time } from '@lovo/matter'

// After (0.2.0)
import { vec3, uv } from 'three/tsl'
import { time } from '@lovo/matter'  // still here — reduced-motion-gated
```

`time` continues to be exported from `@lovo/matter` because Matter owns its semantics (reduced-motion gating). For raw uncapped time, import from `three/tsl` directly.

All Matter-owned primitives (`fbm`, `noise`, `voronoi`, `colorRamp`, `sdfCircle`, `displace`, `cursorRipple`, `quantize`) remain exported from `@lovo/matter` unchanged. Registry component sources at 0.2.0 use the new convention; existing 0.1.x copies in user repos continue to work as their imports still resolve through `three/tsl` once they update.

**Why:** Re-exporting pure TSL primitives provided no value beyond shared import paths — no rename, no added docs, no future-swap benefit. Dropping them clarifies the layer boundary: Matter ships value-add primitives, TSL provides the math. See the [matter engine reference](/reference/matter) for the current public surface.
```

### Task 9.5.4: Update the spec § 4.1

- [ ] **Step 1: Edit `docs/superpowers/specs/2026-05-02-matter-design.md`**

Find the `#### TSL re-exports (stable surface)` subheading (around line 164). Replace that subsection AND its code block with:

```md
#### Layering — Matter and TSL

Matter sits *on top of* TSL. Pure TSL primitives (`uv`, `vec2`, `vec3`, `vec4`, `uniform`, `mix`, `smoothstep`, `mod`, `sin`, `cos`, `length`, `dot`, `normalize`, `max`, `min`) are imported directly from `three/tsl` by Tier 1 components and by recipe snippets — Matter does **not** re-export them. The single TSL node Matter owns is `time`, which wraps `three/tsl`'s built-in `time` with a reduced-motion scale uniform so every component honoring `time` automatically respects `prefers-reduced-motion`.

> Pre-0.2.0 history: `@lovo/matter` originally re-exported the pure TSL primitives as a "stable surface" against future TSL renames. In 0.2.0 we judged the boundary muddier than the cost it claimed to mitigate and dropped them. See the M9 plan and the 0.2.0 changelog.
```

- [ ] **Step 2: Check for stale "re-export" mentions elsewhere in the spec**

```bash
grep -n "re-export\|re export" docs/superpowers/specs/2026-05-02-matter-design.md
```

Two stale references will likely turn up:
- Line ~103 (the engine package description): "Exports TSL primitive re-exports, …" — change to "Exports Matter-specific primitives, the reduced-motion-gated `time`, runtime utilities …".
- Line ~807 (the risks section, "Three.js TSL stability"): "mitigated by re-exporting TSL primitives through `@lovo/matter`" — change to "mitigated by wrapping load-bearing TSL primitives where Matter adds value (e.g., the reduced-motion-gated `time`); consumers handle pure-TSL renames at their import site".

Edit both inline.

### Task 9.5.5: Strike the backlog entry

- [ ] **Step 1: Edit `docs/superpowers/ideas-backlog.md` line 395-400**

Replace the `### Drop pure TSL re-exports from @lovo/matter public API` entry with a shipped marker:

```md
### ~~Drop pure TSL re-exports from `@lovo/matter` public API~~ — shipped in 0.2.0 (M9)

Shipped 2026-05-?? — see `docs/superpowers/plans/2026-05-25-matter-m9-drop-tsl-reexports.md` and the 0.2.0 changelog.
```

Fill in the actual ship date when you cut the release (Phase 9.6).

### Task 9.5.6: Commit Phase 9.5

- [ ] **Step 1: Stage and commit**

```bash
git add apps/docs/content/docs/reference/matter.mdx \
        apps/docs/content/docs/react/api.mdx \
        apps/docs/content/docs/changelog.mdx \
        docs/superpowers/specs/2026-05-02-matter-design.md \
        docs/superpowers/ideas-backlog.md
git commit -m "docs: rewrite TSL layering story for 0.2.0

Updates the engine reference doc, react API examples, changelog,
spec § 4.1, and backlog to reflect that Matter no longer
re-exports pure TSL primitives. Explains the layering rule and
gives an explicit migration block for 0.1.x users."
```

---

## Phase 9.6 — Release 0.2.0

**Files:**
- Create: `.changeset/drop-tsl-reexports.md`

### Task 9.6.1: Write the changeset

- [ ] **Step 1: Create `.changeset/drop-tsl-reexports.md`**

```md
---
'@lovo/matter': minor
'@lovo/matter-react': minor
'@lovo/matter-cli': minor
---

Drop pure TSL re-exports from @lovo/matter public API.

The following 15 nodes are no longer exported by @lovo/matter:
uv, vec2, vec3, vec4, uniform, mix, smoothstep, mod, sin, cos,
length, dot, normalize, max, min.

Import them directly from three/tsl instead:

  // Before (0.1.x)
  import { vec3, uv, time } from '@lovo/matter'

  // After (0.2.0)
  import { vec3, uv } from 'three/tsl'
  import { time } from '@lovo/matter'  // still here — reduced-motion-gated

The Matter-owned `time` (reduced-motion gated) continues to be
exported from @lovo/matter unchanged. For raw uncapped time,
import from three/tsl directly.

@lovo/matter-react and @lovo/matter-cli have no API change in
this release; they bump alongside @lovo/matter to stay in the
fixed-version group.
```

`minor` is the right level for a breaking change against a 0.x package — changesets bumps 0.1.x → 0.2.0 (not 1.0.0). All three packages bump together via the fixed group declared in `.changeset/config.json`.

### Task 9.6.2: Run the full release-readiness pipeline

- [ ] **Step 1: Clean install**

```bash
vp install
```

- [ ] **Step 2: Run the same gates the `release` script will run**

```bash
vp run build
vp run typecheck
vp lint
vp test
pnpm smoke
```

Each must be green. `pnpm smoke` exercises the CLI end-to-end against a fresh `/tmp` project — this confirms the CLI keeps copying registry components correctly and that those copied components compile in a fresh dependency tree.

- [ ] **Step 3: Visual regression one more time**

```bash
vp run @matter/docs-tests#test:visual
```

- [ ] **Step 4: Verify `changeset status`**

```bash
pnpm exec changeset status --verbose
```

Expected output: all three packages (`@lovo/matter`, `@lovo/matter-react`, `@lovo/matter-cli`) bumping to `0.2.0`.

### Task 9.6.3: Apply changeset and tag

- [ ] **Step 1: Apply the changeset (bumps versions, updates CHANGELOG.md per package)**

```bash
pnpm exec changeset version
```

This rewrites the three `package.json` files to `0.2.0` and prepends entries to each package's `CHANGELOG.md`.

- [ ] **Step 2: Re-run install (lockfile rewrite on versions)**

```bash
vp install
```

- [ ] **Step 3: Final green check**

```bash
vp run build && vp run typecheck && vp lint && vp test && pnpm smoke
```

- [ ] **Step 4: Backfill the ship date in the backlog**

Update `docs/superpowers/ideas-backlog.md` "Shipped 2026-05-??" placeholder with today's date.

- [ ] **Step 5: Commit the version bump**

```bash
git add .changeset \
        packages/matter/package.json \
        packages/matter/CHANGELOG.md \
        packages/matter-react/package.json \
        packages/matter-react/CHANGELOG.md \
        packages/matter-cli/package.json \
        packages/matter-cli/CHANGELOG.md \
        docs/superpowers/ideas-backlog.md \
        pnpm-lock.yaml
git commit -m "chore: release 0.2.0"
```

- [ ] **Step 6: Tag the milestone and the release**

```bash
git tag m9-complete
git tag v0.2.0
```

- [ ] **Step 7: Push (user-driven — don't auto-push)**

Stop here. The user pushes and runs `pnpm publish -r --access public` (or the `pnpm release` umbrella script) when they're ready to cut the npm release. Verify with them before pushing tags.

---

## Self-review

Spec coverage check:
- Backlog item ([ideas-backlog.md:395-400](../../ideas-backlog.md#L395-L400)) — addressed end-to-end across Phases 9.1–9.6, including the migration story and the deferred-cleanup of the spec/backlog text in Phase 9.5.
- `time`-stays-Matter-owned decision (from this session's discussion) — Phase 9.1 carries it into its own primitive file; Phase 9.5 documents the rationale.
- Hard cut at 0.2.0 — Phase 9.6 uses `minor` against a fixed-group 0.1.0, producing 0.2.0.
- Standalone (not paired with `colorSpace`) — `colorSpace` is not mentioned in any task; this plan touches only the re-exports surface.

Placeholder scan: no TBDs, no "fill in details", no "similar to above" without code. Every import block has its concrete before/after. Every command shows expected output or the green-bar gate it has to clear. The ship-date placeholder in the backlog (`2026-05-??`) is intentional — backfilled at release time in Task 9.6.3 step 4.

Type & symbol consistency check:
- `time` is exported from `./primitives/time.js` from Phase 9.1 step 3 onward; every later reference matches.
- The 15 dropped symbols are listed identically in: the changeset (9.6.1), changelog (9.5.3), reference doc (9.5.1), spec (9.5.4), and the engine grep guard (9.4.1). Spot-checked: `uv, vec2, vec3, vec4, uniform, mix, smoothstep, mod, sin, cos, length, dot, normalize, max, min` — 15 names, consistent everywhere.
- Phase ordering guarantees the monorepo typechecks green between every commit: consumers migrate (9.2, 9.3) before the engine drops (9.4).

---

**Plan complete and saved to `docs/superpowers/plans/2026-05-25-matter-m9-drop-tsl-reexports.md`.**

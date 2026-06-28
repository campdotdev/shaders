# Vignette Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Shader-edit convention (CRITICAL):** Per `feedback_shader_co_write` and `feedback_shader_phase_gates`, all edits to `registry/vignette/shader.tsx` are **co-written by the user, chunk by chunk** — the assistant describes the next small chunk (concept + exact code + where it goes), the user types it, confirms, then the next chunk. The assistant does **not** call Edit/Write on `shader.tsx`. Non-shader files (demo scene, params, page wiring, the wrapper's prop plumbing) may be edited directly. Every phase ends at a **stop-and-play gate** — something the user runs in the browser and reacts to before moving on.

**Goal:** Bring `<Vignette>` up to the current component standard — strip the demo-only film grain, tighten the prop surface for clarity, and explore adding `colorSpace` + `hueInterpolation` to the overlay blend.

**Architecture:** Vignette is already structurally current (wrapper + `shader.tsx` split, stable-uniform pattern per Gotcha #17, `usePostProcessPass` overlay, poster SSOT scene module). It does **not** use `elapsedTime`, so MAT-41 deterministic-start work does not apply. The substantive change is the blend: today it uses `tslMix(input, color, factor)` (a linear-space mix); the exploration swaps that for `mixColor(input.rgb, color, factor, colorSpace, hueInterpolation)` so the overlay can darken/tint in a chosen perceptual space and along a chosen hue arc — the same MAT-5 capability LinearGradient / MeshGradient / SimplexNoise already expose.

**Tech Stack:** React 19, Three.js TSL (`three/tsl`, `three/webgpu`), `@lovo/matter` (`mixColor`, `ColorSpace`, `HueInterpolation` — all exported from package root, already in built dist), `@lovo/matter-react` (`usePostProcessPass`, `useAnimatableUniform`, `useResize`), Tweakpane (docs panel), Playwright visual regression.

## Global Constraints

- **No emojis** in code or commit messages.
- **Conventional Commits**, scope = package without `@lovo/` prefix. Registry/docs changes: use `feat(vignette):` / `refactor(vignette):` / `chore(docs):` as fits.
- **Never push to main** — all work on a PR branch (`feedback_never_push_to_main`).
- **No Claude attribution** in commits or PRs.
- **Destructure props inline** at the function signature with defaults (`feedback_destructure_props`) — never `props.X`.
- **Clear names over abbreviations** (CLAUDE.md convention; MAT-34 audit).
- **TypeScript strict** + `verbatimModuleSyntax` — `import type` for type-only imports.
- **YAGNI** — do not add capability beyond what each task specifies. In particular: do **not** extract shared `useColorUniform` / aspect-uniform hooks across components in this plan (every component inlines them today; cross-component refactor is out of scope and not what was asked).
- **Vignette is published (v0.4.1) and copy-paste delivered from `registry/`.** Treat any prop **rename/removal** as a breaking change — gate it on explicit user approval (Phase 2).
- Docs site consumes `@lovo/matter` from **built dist**, but `mixColor` already ships there (MeshGradient uses it), so **no engine rebuild is required** for this work. `@matter/registry` is consumed as source via `transpilePackages`.

---

## File map

| File | Responsibility | Touched in |
| --- | --- | --- |
| `registry/vignette/vignette.tsx` | Public wrapper: prop defaults, JSDoc, forwards to shader | Phase 2, 3 |
| `registry/vignette/shader.tsx` | Post-process pass; uniforms + blend math (**co-write only**) | Phase 3 |
| `apps/docs/src/app/components/vignette/scene.tsx` | Demo composition (currently composes `<Grain>`) | Phase 1 |
| `apps/docs/src/app/components/vignette/params.ts` | Demo params type + `INITIAL` | Phase 1, 3 |
| `apps/docs/src/app/components/vignette/page.tsx` | Tweakpane panel + copy-code formatters | Phase 1, 3 |
| `apps/docs/public/posters/vignette.jpg` | Poster asset (regenerated, not hand-edited) | Phase 4 |
| `apps/docs/tests/**` visual baselines for the vignette route | Regenerated | Phase 4 |

---

## Phase 0: Branch + baseline observation (gate before any change)

**Files:** none (setup only)

- [ ] **Step 1: Create the PR branch**

```bash
git checkout -b vignette-refactor
```

- [ ] **Step 2: Run the docs site and observe current Vignette**

```bash
pnpm dev:docs
```

Open the Vignette component page. Note the current behavior so later diffs are legible:
- The demo stacks `<LinearGradient>` + `<Vignette>` + `<Grain>`, with a "Stack with Grain" folder (`grain first?`, `grain intensity`).
- The vignette darkening is a **linear-space** mix today (`tslMix`).

**Stop-and-play gate:** Confirm with the user that this is the component/demo we're refactoring and that the three-bullet scope (remove grain → prop clarity → explore colorSpace/hueArc) is right before proceeding.

---

## Phase 1: Strip film grain from the Vignette demo

**Why:** Grain is **not** part of the Vignette component — it is a separate `<Grain>` overlay composed only in the demo scene, plus its two driving params and a Tweakpane folder. The user wants the Vignette demo to be about the vignette alone. (The `<Grain>` component itself and its own demo are untouched.)

**Files:**
- Modify: `apps/docs/src/app/components/vignette/scene.tsx`
- Modify: `apps/docs/src/app/components/vignette/params.ts`
- Modify: `apps/docs/src/app/components/vignette/page.tsx`

**Interfaces:**
- Produces: a `VignetteParams` with **no** `grainOrderFirst` / `grainIntensity` fields; a `VignetteScene` that renders only `<LinearGradient>` + `<Vignette>`.

- [ ] **Step 1: Remove grain from the demo scene**

In `scene.tsx`, delete the `Grain` import, the `grainEl`, and the `grainOrderFirst` conditional. Result:

```tsx
'use client';

import type { ReactNode } from 'react';

import { ShaderScene } from '@lovo/matter-react';
import { LinearGradient } from '@matter/registry/linear-gradient';
import { Vignette } from '@matter/registry/vignette';

import { INITIAL, type VignetteParams } from './params';

export default function VignetteScene({
  params = INITIAL,
  children,
}: {
  params?: VignetteParams;
  children?: ReactNode;
} = {}) {
  return (
    <ShaderScene>
      <LinearGradient />
      <Vignette
        center={[params.centerX, params.centerY]}
        color={params.color}
        intensity={params.intensity}
        radius={params.radius}
        softness={params.softness}
      />
      {children}
    </ShaderScene>
  );
}
```

- [ ] **Step 2: Remove grain fields from params**

In `params.ts`, delete `grainOrderFirst` and `grainIntensity` from both the `VignetteParams` interface and the `INITIAL` constant. Keep the existing vignette defaults (`intensity: 0.7, softness: 0.5, centerX: 0.5, centerY: 0.5, radius: 0.6, color: '#000000'`).

- [ ] **Step 3: Remove the grain controls from the Tweakpane panel**

In `page.tsx`, delete the entire `stackFolder` block (the `addFolder({ title: 'Stack with Grain' })` and its two `addBinding` calls for `grainOrderFirst` / `grainIntensity`). Leave the vignette bindings, reset button, and copy buttons intact.

- [ ] **Step 4: Typecheck the docs app**

```bash
pnpm --filter @matter/docs typecheck
```
Expected: PASS (no dangling references to the removed params).

- [ ] **Step 5: Stop-and-play gate**

Restart `pnpm dev:docs`, open the Vignette page. Confirm: no grain, no "Stack with Grain" folder, copy-code output no longer mentions grain, vignette still controllable. **User reacts before continuing.**

- [ ] **Step 6: Commit**

```bash
git add apps/docs/src/app/components/vignette/
git commit -m "refactor(docs): remove film grain from vignette demo"
```

---

## Phase 2: Prop clarity pass

**Why:** The user wants the props to be "clear and obvious." Current surface: `intensity` (0–1 blend strength), `softness` (0–1 edge feather), `center` (`[x, y]`), `radius` (0–1.5 normalized outer edge), `color`. The non-obvious part is the `radius`/`softness` interplay — internally `innerRadius = radius * (1 - softness)` and `mask = smoothstep(innerRadius, radius, distance)`, i.e. `radius` is where the vignette reaches **full** strength and `softness` is how far **inward** the feather begins. Names are conventional for a vignette, and the component is published, so the default recommendation is **document, don't rename**.

**Files:**
- Modify: `registry/vignette/vignette.tsx` (JSDoc on each prop)

- [ ] **Step 1: Present the prop audit to the user (decision gate)**

Show this table and get a decision on each row **before** editing. Default recommendation in the last column:

| Prop | Type | Default | Clarity verdict | Recommendation |
| --- | --- | --- | --- | --- |
| `intensity` | `AnimatableProp<number>` | `0.4` | clear | keep + JSDoc (0 = off, 1 = full color at the edge) |
| `softness` | `AnimatableProp<number>` | `0.5` | interplay with `radius` is non-obvious | keep + JSDoc (fraction of `radius` over which the edge feathers in) |
| `center` | `[number, number]` | `[0.5, 0.5]` | clear | keep + JSDoc (normalized UV, `[0,0]` top-left) |
| `radius` | `AnimatableProp<number>` | `0.7` | "radius of what?" is non-obvious | keep + JSDoc (normalized distance from center at which the vignette is fully applied) |
| `color` | `string` | `'#0B0F0D'` | clear | keep + JSDoc (the overlay color blended in toward the edges) |

**Gate:** If the user wants any **rename** instead of doc-only, flag it as a breaking change (registry copy-paste consumers + docs params + page bindings all update together) and capture the new name here before editing.

- [ ] **Step 2: Add JSDoc to the wrapper props**

In `vignette.tsx`, add a doc comment above each field in `VignetteProps` reflecting the agreed wording from Step 1. Keep the inline destructured defaults in the function signature unchanged (per `feedback_destructure_props`). Example shape (final wording per gate):

```ts
export interface VignetteProps {
  /** Overlay strength toward the edges. 0 = no vignette, 1 = full `color`. */
  intensity?: AnimatableProp<number>;
  /** Fraction of `radius` over which the edge feathers in. 0 = hard ring, 1 = feather from center. */
  softness?: AnimatableProp<number>;
  /** Vignette center in normalized UV; `[0,0]` is one corner, `[0.5,0.5]` is centered. */
  center?: [number, number];
  /** Normalized distance from `center` at which the vignette reaches full strength. */
  radius?: AnimatableProp<number>;
  /** Color blended in toward the edges (hex). */
  color?: string;
}
```

- [ ] **Step 3: Typecheck + lint**

```bash
pnpm --filter @lovo/matter-react typecheck && pnpm lint
```
(`registry/` lints under the root config.) Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add registry/vignette/vignette.tsx
git commit -m "docs(vignette): document prop semantics and radius/softness interplay"
```

---

## Phase 3: Explore `colorSpace` + `hueInterpolation` on the overlay blend

**Why:** This is the "latest update" Vignette is genuinely missing. MAT-5 deliberately **excluded** Vignette from colorSpace because it was framed as a single-color overlay rather than a palette/ramp blend — but the overlay **is** a per-pixel blend (`upstream pixel → vignette color` by `factor`), so `mixColor` applies cleanly and unlocks perceptual darkening (oklab) and hue-shifting tinted vignettes (oklch/lch + a hue arc). Because the spec deferred it, this phase is **exploratory** and ends in a keep/discard/default decision.

**This phase edits `shader.tsx` — co-write only.** The assistant describes each chunk; the user types it.

**Files:**
- Modify (co-write): `registry/vignette/shader.tsx`
- Modify: `registry/vignette/vignette.tsx` (new optional props + defaults)
- Modify: `apps/docs/src/app/components/vignette/params.ts` (two new fields)
- Modify: `apps/docs/src/app/components/vignette/page.tsx` (two `options` bindings)

**Interfaces:**
- Consumes: `mixColor(colorA, colorB, t, colorSpace, hueInterpolation)` and types `ColorSpace`, `HueInterpolation` from `@lovo/matter`. `mixColor` operates on **vec3 linear color**; `input` inside `usePostProcessPass` is a **vec4** scene color, so the blend works on `input.rgb` and reassembles alpha.
- Produces: `VignetteShaderProps` and `VignetteProps` each gain `colorSpace: ColorSpace` and `hueInterpolation: HueInterpolation`.

### Decision gate up front: what should the *default* color space be?

Today's blend is linear (`tslMix`). Two options for the new default — **decide with the user before touching the shader**, because it determines whether existing visual baselines change:

- **Default `'oklab'` / `'shorter'`** (recommended, matches LinearGradient/MeshGradient/SimplexNoise): consistent across the library, perceptually smoother darkening — **but the default vignette look shifts** vs today's linear mix, so the poster + visual baselines regenerate (Phase 4) and copy-paste consumers see a subtle change on upgrade.
- **Default `'linear'` / `'shorter'`** (conservative): pixel-identical to today by default, oklab/oklch become opt-in — no baseline churn, but Vignette's default diverges from the other components'.

- [ ] **Step 1 (co-write): Add the two props to the shader interface and signature**

Chunk concept: extend `VignetteShaderProps` with `colorSpace: ColorSpace` and `hueInterpolation: HueInterpolation` (note: these are plain enums, **not** `AnimatableProp` — they restructure the TSL graph, not animate), and destructure them in `VignetteShader(...)`. Add the type import:

```ts
import type { ColorSpace, HueInterpolation } from '@lovo/matter';
import { mixColor } from '@lovo/matter';
```

(Explain: `mixColor` is a TSL primitive that converts both colors into the chosen space, lerps — using the chosen hue arc for cylindrical spaces — then converts back to linear. For `linear`/`oklab` the hue arg is inert.)

- [ ] **Step 2 (co-write): Swap the blend in the post-process pass**

Chunk concept: replace the final `tslMix(...)` line. `input` is a vec4; `mixColor` wants vec3s. Blend the rgb and keep the original alpha:

```ts
// before:
//   return tslMix(input, vec4(colorUniform, 1), factor);
// after:
const blendedRgb = mixColor(input.rgb, colorUniform, factor, colorSpace, hueInterpolation);
return vec4(blendedRgb, input.a);
```

Explain the GPU semantics: at `factor=0` the pixel is untouched; at `factor=1` it equals the vignette color; in between, the *path* between them follows `colorSpace` (e.g. oklch rotates hue along `hueInterpolation`'s arc — a near-black `color` has ~0 chroma so the arc barely shows; a saturated `color` produces a tinted, hue-shifting edge). Note `colorSpace`/`hueInterpolation` are **not** in the pass dependency array as uniforms — they are baked into the graph, so they belong with the structural rebuild. Confirm whether `usePostProcessPass`'s dep array needs them listed (it rebuilds the pass on change); add them to the dep array so changing the Tweakpane dropdown rebuilds the pass.

- [ ] **Step 3 (co-write): Verify the shader file compiles**

After the user confirms the chunks are in, the assistant may `Read` `shader.tsx` to verify (read-only), then:

```bash
pnpm --filter @lovo/matter-react typecheck
```
Expected: PASS. Surface any issue back to the user — do not silently fix.

- [ ] **Step 4: Add the props to the wrapper**

In `vignette.tsx` (direct edit OK — this is plumbing, not shader math), add the two optional props with the defaults chosen at the decision gate, and forward them:

```ts
import type { AnimatableProp, ColorSpace, HueInterpolation } from '@lovo/matter';
// ...
colorSpace?: ColorSpace;
hueInterpolation?: HueInterpolation;
// ...defaults in signature (example assumes the recommended default):
colorSpace = 'oklab',
hueInterpolation = 'shorter',
// ...forward to <VignetteShader colorSpace={colorSpace} hueInterpolation={hueInterpolation} ... />
```

(Confirm whether `AnimatableProp` and the new types both import cleanly from `@lovo/matter` vs `@lovo/matter-react`; match whatever the existing wrapper already imports `AnimatableProp` from, and add the color types from `@lovo/matter`.)

- [ ] **Step 5: Wire the Tweakpane controls**

In `params.ts`, add `colorSpace: ColorSpace` and `hueInterpolation: HueInterpolation` to `VignetteParams` + `INITIAL` (matching the wrapper defaults). In `page.tsx`, add two `options` bindings after the `color` binding, mirroring LinearGradient's panel:

```ts
pane.addBinding(local, 'colorSpace', {
  options: { Linear: 'linear', OKLab: 'oklab', OKLch: 'oklch', LCh: 'lch', HSL: 'hsl', HSV: 'hsv' },
});
pane.addBinding(local, 'hueInterpolation', {
  options: { Shorter: 'shorter', Longer: 'longer', Increasing: 'increasing', Decreasing: 'decreasing' },
});
```

Confirm the copy-code formatters (`formatJsx` / `formatParams`) pick up the new params automatically; if they enumerate fields explicitly, add the two new keys.

- [ ] **Step 6: Typecheck the docs app**

```bash
pnpm --filter @matter/docs typecheck
```
Expected: PASS.

- [ ] **Step 7: Stop-and-play gate (the feel decision)**

Restart `pnpm dev:docs`. With a **saturated** `color` (e.g. a warm orange) and a wide `softness`, sweep `colorSpace` through oklab → oklch → hsl and `hueInterpolation` through shorter/longer. Observe how the edge tint shifts. **User decides:**
1. Keep the feature? (If it doesn't earn its complexity for a vignette, discard Phase 3 — that's a legitimate outcome of an exploration.)
2. If keeping: confirm the **default** (`oklab` vs `linear`) — this gates Phase 4 baseline regeneration.

- [ ] **Step 8: Commit (only if kept)**

```bash
git add registry/vignette/ apps/docs/src/app/components/vignette/
git commit -m "feat(vignette): add colorSpace and hueInterpolation to the overlay blend"
```

---

## Phase 4: Regenerate posters + visual baselines, full verification

**Why:** Phase 1 changed the demo composition (grain removed) and — if Phase 3 landed with a non-`linear` default — Phase 3 changed the default vignette look. Both invalidate the poster and the Playwright visual baselines for the vignette route.

**Files:**
- Regenerate: `apps/docs/public/posters/vignette.jpg`
- Regenerate: vignette-route visual baseline snapshots

> **Environment note:** poster/baseline generation must run on pinned **Node 22** (`project_docs_build_node23` — `next build` silently produces no output on Node 23), and `pnpm snap` needs Docker (`project_ci_gotchas`). Confirm the toolchain before running.

- [ ] **Step 1: Regenerate the vignette poster**

```bash
pnpm posters
```
(or the scoped invocation for a single component if `scripts/build-posters.sh` supports it). Confirm `apps/docs/public/posters/vignette.jpg` now shows the grain-free demo (and the new default blend if Phase 3 changed it).

- [ ] **Step 2: Regenerate visual baselines**

```bash
pnpm snap
```
Confirm only the vignette-route baselines changed (grain removal + any blend default change); nothing unrelated should move.

- [ ] **Step 3: Run the visual regression suite**

```bash
pnpm test:visual
```
Expected: PASS against the regenerated baselines.

- [ ] **Step 4: Full project verification**

```bash
pnpm typecheck && pnpm lint && pnpm format:check && pnpm build
```
Expected: all PASS. (Run `pnpm format` first if `format:check` flags anything.)

- [ ] **Step 5: Commit regenerated assets**

```bash
git add apps/docs/public/posters/vignette.jpg apps/docs/tests/
git commit -m "test(docs): regenerate vignette poster and visual baselines"
```

- [ ] **Step 6: Final stop-and-play gate + branch finish**

Walk the user through the full diff. Then use `superpowers:finishing-a-development-branch` to decide merge/PR. PR prose follows `feedback_pr_style` (concise, lead with why, run through `superpowers:humanizer`, no Test plan / Follow-ups sections, no Claude attribution).

---

## Self-Review

**Spec/scope coverage** (the user's four asks):
1. "All the latest updates from refactored components" → Phase 3 (colorSpace/hueInterpolation, the one genuinely-missing update) + research confirming MAT-41 N/A, poster SSOT already done, no shared-hook extraction in scope.
2. "Review props, make them clear and obvious" → Phase 2 (audit table + JSDoc, rename gated).
3. "Remove the film grain" → Phase 1 (it lives only in the demo scene, not the component).
4. "Explore colorSpace and hue arc" → Phase 3, framed as exploratory with a keep/discard gate.

**Placeholder scan:** No "TBD"/"handle edge cases"/"add tests for the above" — shader steps are co-write chunks with exact code; mechanical steps show full code.

**Type consistency:** `colorSpace: ColorSpace`, `hueInterpolation: HueInterpolation` named identically in shader props, wrapper props, and demo params. `mixColor(colorA, colorB, t, colorSpace, hueInterpolation)` signature matches `@lovo/matter`'s export. Blend operates on `input.rgb` (vec3) + reassembles `input.a` — consistent with `mixColor` being vec3-typed and `usePostProcessPass` input being vec4.

**Open decisions deliberately left to gates (not placeholders):** (a) any prop rename in Phase 2; (b) default color space in Phase 3; (c) keep-or-discard the whole colorSpace exploration. Each is a feel/breaking-change call that belongs with the user, per the project's phase-gate preference.

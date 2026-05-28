# `<FilmGrain>` + Overlay Pipeline — Design Document

**Status:** Approved through brainstorming, awaiting user review of this written spec
**Date:** 2026-05-28
**Author:** Hunter Garrett (with brainstorming support)
**Branch:** `hunter/mat-16-standalone-filmgrain-component`
**Backlog ticket:** `<FilmGrain>` entry under "Surfaces (overlays meant to layer)" in `docs/superpowers/ideas-backlog.md`

---

## 1. Overview

Matter is committing to its overlay-component category — a class of Tier 1 components that layer visual effects on top of any base shader (gradients, fields, etc.) without each base needing to bake the effect into its own shader. This milestone ships the architecture for that category plus its first two members:

- **`<FilmGrain>`** — standalone overlay version of the centered film grain already shipped as a Tier 2 primitive in MAT-8 phase 6b.
- **`<Vignette>`** — radial darkening at the edges of the canvas, the first overlay that genuinely reads upstream pixels (multiplicative blending against the rendered scene).

Two overlays were chosen instead of one because `<FilmGrain>` alone is a poor architectural test — it self-generates from UV coords and doesn't need to read upstream pixels. `<Vignette>` exercises the read-upstream case and confirms the pipeline generalizes to every future overlay (Bloom, ChromaticAberration, etc.).

As part of the same milestone, MeshGradient's bundled `grain` and `grainSpeed` props are removed from the registry component. Grain becomes an overlay concern across the whole library, and MeshGradient becomes a pure gradient renderer. Existing users keep their pulled copy unchanged; the registry's new copy is the canonical version going forward.

---

## 2. Goals and non-goals

### Goals

- Commit to a single architecture for the v2 overlay category, validated against two diverse overlays before the next overlay lands.
- Ship `<FilmGrain>` and `<Vignette>` with prop APIs consistent with existing Tier 1 components (animatable props, hex colors, `AnimatableProp<number>` for scalars).
- Preserve every existing base-component visual output through the MatterScene refactor — zero visible regressions on Aurora, LinearGradient, NoiseField, DotField, Waves, MeshGradient.
- Honor the user's pacing preference: six phases, each ending at a runnable observable point with an explicit stop-and-play beat.

### Non-goals (this milestone)

- Bloom, ChromaticAberration, or any other v2 overlay beyond FilmGrain and Vignette.
- Color-tint and blend-mode props on `<FilmGrain>` (mentioned in the backlog) — those belong with the `colorSpace` cross-component infrastructure work, not here.
- Extracting a `radialMask` Tier 2 primitive — vignette math is inlined for this milestone. Extract when a second consumer (spherize, zoom blur, lens flare) materializes.
- Migration tooling for users who already pulled MeshGradient — the registry copy-paste model means their version keeps working without intervention.
- Cross-overlay performance benchmarking — one quad pass per frame is well-understood as negligible relative to base-shader cost; no need to measure.

---

## 3. Architecture

### 3.1 The pipeline change

`MatterScene` swaps its single `renderer.three.render(scene, camera)` call for a `PostProcessing` instance from `three/webgpu`:

```ts
// packages/matter-react/src/MatterScene.tsx (sketch)
const postProcessing = new PostProcessing(renderer.three)
const basePass = pass(scene, camera)  // TSL node that samples the rendered scene

postProcessing.outputNode = basePass
scheduler.add(() => postProcessing.render())
```

`pass(scene, camera)` is a TSL node that evaluates to the rendered scene as a texture sample. When zero overlays are mounted, `outputNode = pass(scene, camera)` and the visual result is one fullscreen quad sampling a freshly-rendered base scene. This costs roughly one texture sample + tone-map per fragment per frame — on the order of 0.05ms at 1080p on integrated GPUs, an order of magnitude below the work each shader-heavy base component is already doing.

The `PostProcessing` instance's lifecycle is tied to the `renderer` instance — created once during `MatterScene`'s setup effect alongside the renderer, and released in the same cleanup. Any future code path that recreates the renderer (e.g., `maxDPR` prop change) recreates `PostProcessing` along with it.

### 3.2 Overlay registration

`MatterContext` grows one method:

```ts
type OverlayTransform = (input: ShaderNodeObject<Node>) => ShaderNodeObject<Node>

interface MatterContextValue {
  renderer
  scene
  camera
  scheduler
  registerOverlay(transform: OverlayTransform): () => void  // new
}
```

`MatterScene` keeps an ordered registration map keyed by stable symbols. On any registration change, it rebuilds the output node and flags PostProcessing for an update:

```ts
const transforms = Array.from(overlayMap.values())
const output = transforms.reduce((node, transform) => transform(node), pass(scene, camera))
postProcessing.outputNode = output
postProcessing.needsUpdate = true
```

Ordering = mount order = sibling JSX declaration order. React fires sibling effects in declaration order on mount, so for static JSX the rendered order matches what the developer sees in their source. For dynamic JSX (`{showGrain && <FilmGrain />}`), the order tracks mount sequence rather than JSX position — documented as a known v1 constraint. An explicit `order` prop on overlays is not in scope for this milestone.

Strict Mode safety follows the pattern from `useCursor.ts` (CLAUDE.md gotcha #14): register inside a single `useEffect`, return the cleanup function from `registerOverlay`. Strict Mode double-mount produces register → unregister → register, which settles to the correct final state.

### 3.3 The `useOverlayPass` hook

Wraps `ctx.registerOverlay` with `useEffect`-shaped ergonomics:

```ts
function useOverlayPass(transform: OverlayTransform, deps: DependencyList): void
```

The transform function closes over TSL uniform nodes, which are mutable — uniform value changes propagate without re-registering. Only structural changes (e.g., a `mode: 'centered' | 'subtractive'` prop swap) need to be in deps to force a re-register.

### 3.4 Why not the alternatives

**Overlay-mesh with custom blend equations (Path A in brainstorming)** was rejected because centered grain (mean = 0, range [-intensity, +intensity]) cannot be expressed as a fixed-function blend equation. Standard additive blending clips negative pixel values to 0, losing half the grain. The only way to get true centered modulation is for the overlay shader to read the destination color — which is exactly what post-process passes provide via `pass()`. Path A would have forced subtractive-only grain (the wrong default per the MAT-8 backlog notes) and would have ruled out Bloom and ChromaticAberration too.

**Lazy PostProcessing (Path C in brainstorming)** was rejected because the savings are negligible (one fullscreen quad pass per frame) and the cost is a dual code path in MatterScene with mid-frame branching when overlays mount or unmount. Always-on is simpler and cheap enough.

---

## 4. Public API

### 4.1 `useOverlayPass` (exported from `@lovo/matter-react`)

```ts
type OverlayTransform = (input: ShaderNodeObject<Node>) => ShaderNodeObject<Node>

export function useOverlayPass(transform: OverlayTransform, deps: DependencyList): void
```

Registers an overlay TSL transform with the parent `MatterScene` on mount, unregisters on unmount, and re-registers when any value in `deps` changes (`useEffect` semantics). When called outside a `MatterScene` provider, the hook is a no-op — matching the existing `useMatterContext` convention (returns `null` outside the provider; consumers check and bail).

### 4.2 `<FilmGrain>` (registry component)

```ts
interface FilmGrainProps {
  /** Grain strength. 0 = clean, 1 = heavy. Default 0.08. */
  intensity?: AnimatableProp<number>
  /** Twinkle rate. 0 = static, 1 = ~60Hz, 0.4 = ~24Hz film cadence. Default 1. */
  speed?: AnimatableProp<number>
  /** 'centered' (default): brightens half, darkens half, mean-preserving (the MAT-8 default).
   *  'subtractive': only darkens (silver-emulsion film-stock look; crushes blacks). */
  mode?: 'centered' | 'subtractive'
}
```

Internal structure mirrors Aurora and MeshGradient: a thin wrapper (`registry/film-grain/film-grain.tsx`) that defaults props and forwards to the shader component (`registry/film-grain/shader.tsx`). The shader calls `useOverlayPass` with a transform that adds (centered) or subtracts (subtractive) the `filmGrain` primitive's output.

### 4.3 `<Vignette>` (registry component)

```ts
interface VignetteProps {
  /** How dark the edges go. 0 = no vignette, 1 = full black at corners. Default 0.4. */
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
```

Internal structure same as FilmGrain. Vignette math is inlined in the shader file (no Tier 2 primitive extracted this milestone) — aspect-corrected radial distance, smoothstep against an inner/outer radius derived from `radius` and `softness`, mixed into the input via the resulting mask scaled by `intensity`.

### 4.4 Usage

```tsx
import { MatterScene } from '@lovo/matter-react'
import { MeshGradient } from '@/components/matter/mesh-gradient'
import { FilmGrain } from '@/components/matter/film-grain'
import { Vignette } from '@/components/matter/vignette'

<MatterScene>
  <MeshGradient paletteA={['#001a2c','#0a3d62','#1e6091','#3c91e6']}
                paletteB={['#2c0a1e','#62200a','#911e3c','#e63c70']} />
  <FilmGrain intensity={0.1} speed={0.6} />
  <Vignette intensity={0.5} radius={0.6} />
</MatterScene>
```

Stacking order in JSX = pass order on the GPU = visually "FilmGrain applies first, then Vignette darkens the grainy result."

---

## 5. MeshGradient backwards-compatibility

The new `registry/mesh-gradient/` entry has `grain` and `grainSpeed` props removed and no `filmGrain` call in the shader. Users who pulled MeshGradient before this milestone keep their existing copy unchanged — the registry copy-paste model means we're not breaking any installed code. The new docs page at `/components/mesh-gradient` demonstrates stacking `<FilmGrain>` on top, with grain Tweakpane controls moved into a clearly-labeled "FilmGrain overlay" section.

Visual note: bundled grain composed in linear color space before tone-map; post-process grain composes after tone-map on display values. For centered grain at low intensity these are visually indistinguishable. Post-process is arguably more "correct" — grain is a physical noise source on the display surface. No deprecation period needed.

---

## 6. Testing strategy

| Layer | What | Where |
|---|---|---|
| `useOverlayPass` | Vitest: register/unregister, deps invalidation, Strict Mode double-mount | `packages/matter-react/src/useOverlayPass.test.tsx` (new) |
| `MatterScene` PostProcessing wiring | Extend existing MatterScene tests: assert `outputNode` rebuilds on registration changes, cleanup on unmount | `packages/matter-react/src/MatterScene.test.tsx` (modified) |
| `<FilmGrain>`, `<Vignette>` | Playwright snapshot per CLAUDE.md ("don't mock the GPU") | `apps/docs-tests/visual/film-grain.spec.ts`, `vignette.spec.ts` (new) |
| Vignette math correctness | Covered transitively by Playwright snapshot — no separate test | — |
| Regression coverage | Re-baseline every existing component snapshot once at the end of the milestone, manually visually diff before accepting | `apps/docs-tests/visual/*-snapshots/` |

---

## 7. Phase breakdown

Six phases on the same branch. Each ends at a runnable, observable point with an explicit stop-and-play beat for the user to validate by feel before moving on.

### Phase 1 — MatterScene → PostProcessing swap (invisible-by-design)

**What:** Replace `renderer.three.render(scene, camera)` in `MatterScene.tsx` with a `PostProcessing` instance whose `outputNode` is `pass(scene, camera)`. No public API change.

**Files:** `packages/matter-react/src/MatterScene.tsx`, `packages/matter-react/src/MatterScene.test.tsx`.

**Stop-and-play beat:** open every existing docs page (Aurora, LinearGradient, NoiseField, DotField, Waves, MeshGradient) — they render identically to today. User feels: "pipeline swapped under the hood, nothing broke."

**Learning beat:** what `pass(scene, camera)` is — a TSL node that evaluates to the rendered scene as a texture sample.

**Size:** ~1 day

### Phase 2 — `useOverlayPass` + dev-only tint overlay

**What:** Add `registerOverlay` to `MatterContext`. Add `useOverlayPass` hook. Add a dev-only `<TintOverlay>` (NOT exported) on `apps/docs/src/app/dev/overlay-test/` to prove the pipeline works.

**Files:** `packages/matter-react/src/matter-context.ts`, `MatterScene.tsx`, new `useOverlayPass.ts` and `.test.tsx`, new `apps/docs/src/app/dev/overlay-test/page.tsx`.

**Stop-and-play beat:** navigate to `/dev/overlay-test`. See MeshGradient base + red tint overlay. Toggle JSX order — feel the stacking work.

**Learning beat:** how TSL nodes compose; why uniforms in the closure flow through but `mode`-style props need to be in deps.

**Size:** ~1.5 days

### Phase 3 — `<FilmGrain>` component (both modes) + docs page

**What:** Ship `<FilmGrain>` as a registry component. Both `centered` and `subtractive` modes. Tweakpane controls for intensity, speed, mode. Demo on a simple base layer (e.g., LinearGradient).

**Files:** new `registry/film-grain/film-grain.tsx` + `shader.tsx`, `registry/package.json`, `registry/registry.json`, new `apps/docs/src/app/components/film-grain/page.tsx`, navigation update.

**Stop-and-play beat:** open `/components/film-grain`. Drag intensity, speed, toggle mode. Compare side-by-side with `/components/mesh-gradient` (still has bundled grain at this point).

**Learning beat:** color-space implications of grain in post-process vs. in-shader; why centered preserves the tonal midpoint.

**Size:** ~2 days

### Phase 4 — `<Vignette>` component + docs page

**What:** Ship `<Vignette>`. Tweakpane controls for intensity, softness, center, radius, color. Demo standalone and stacked with `<FilmGrain>` — both stacking orders demonstrated explicitly.

**Files:** new `registry/vignette/vignette.tsx` + `shader.tsx`, `registry/package.json`, `registry/registry.json`, new `apps/docs/src/app/components/vignette/page.tsx`.

**Stop-and-play beat:** open `/components/vignette`. Swap `<FilmGrain>` and `<Vignette>` order via a toggle button — feel the difference (grain darkens with vignette vs. grain stays bright in dark corners).

**Learning beat:** what multiplicative blending does. How "read-upstream-pixels" passes differ from "generate-from-uv" passes. The moment the architecture choice pays off.

**Size:** ~1.5 days

### Phase 5 — Drop bundled grain from MeshGradient

**What:** Remove `grain` and `grainSpeed` props from `registry/mesh-gradient/`. Remove the `filmGrain` call from its shader. Update `apps/docs/src/app/components/mesh-gradient/page.tsx` to demonstrate stacking `<FilmGrain>` on top.

**Files:** `registry/mesh-gradient/shader.tsx`, `registry/mesh-gradient/mesh-gradient.tsx`, `apps/docs/src/app/components/mesh-gradient/page.tsx`.

**Stop-and-play beat:** open `/components/mesh-gradient`. Page feels identical to today's experience; grain controls now live in a labeled FilmGrain section. Toggle the overlay off — confirm MeshGradient renders without grain.

**Learning beat:** how composition expresses the same visual output as a single feature-rich component, with the bonus that the overlay generalizes to any base.

**Size:** ~1 day

### Phase 6 — Visual snapshots + changesets + cleanup

**What:** Regenerate Playwright snapshots for every page. Manually visually diff. Write changesets: `@lovo/matter-react` minor (new `useOverlayPass`, MatterScene signature change), `@matter/registry` minor (FilmGrain + Vignette added, MeshGradient grain props removed). Update navigation. Update `MEMORY.md` and `CLAUDE.md` with any new gotchas surfaced during execution.

**Files:** `apps/docs-tests/visual/*-snapshots/`, `.changeset/*.md`, `apps/docs/src/components/SiteNav.tsx` (or wherever the nav lives), `docs/superpowers/ideas-backlog.md` (mark FilmGrain done).

**Stop-and-play beat:** `pnpm test:visual` all green. Manual snapshot review (open the PNGs, don't trust `git diff`).

**Size:** ~0.5 day

**Total milestone size:** ~7.5 working days.

---

## 8. Out of scope (firm)

- Bloom, ChromaticAberration, or any other v2 overlay. They'll inherit the pipeline shipped here but are separate milestones.
- A `radialMask` Tier 2 primitive. Vignette math is inlined; primitive extraction waits for a second consumer.
- Color tinting on `<FilmGrain>` (separate concern; pairs with `colorSpace` infra).
- An explicit `order` prop on overlays for deterministic ordering under dynamic JSX. Mount order is the v1 contract.
- Migration tooling for users with pulled MeshGradient copies. The registry model handles this naturally.

---

## 9. Decision log

| Question | Decision | Alternative considered | Why this choice |
|---|---|---|---|
| Milestone scope | Architecture + FilmGrain + Vignette | FilmGrain-only, or 3+ overlays | Two diverse overlays validate the architecture without overcommitting; FilmGrain alone doesn't test read-upstream cases. |
| Compositor architecture | three/webgpu's `PostProcessing` (always-on) | Overlay-mesh with custom blend equations; lazy PostProcessing | Centered grain requires reading destination pixels; lazy compositor's perf savings are negligible and add dual code paths. |
| Overlay registration | Mount-order ordering | Explicit `order` prop | Static JSX is the dominant case; mount-order matches developer intuition. Explicit `order` deferred. |
| `<FilmGrain>` prop names | `intensity`, `speed` | `grain`, `grainSpeed` (mirroring MeshGradient) | Component name carries the "grain" qualifier; props describe the role, not the component identity. |
| `<Vignette>` color type | hex string | richer color object | Matches existing convention (`paletteA: [string, ...]`). Upgrades uniformly when `colorSpace` infra lands. |
| `vignette` Tier 2 primitive | Inline math | Extract `radialMask` primitive | Single consumer; YAGNI per CLAUDE.md. Extract on the second user. |
| MeshGradient bundled grain | Remove from new registry entry | Keep as shortcut; soft-deprecate | Registry copy-paste model means existing users keep their copy; single canonical way to do grain across all base components. |
| Always-on PostProcessing perf | Accept the one-quad-pass cost | Lazy compositor | One texture sample per fragment is sub-millisecond at 1080p; an order of magnitude below base-shader cost. |

---

## 10. Open questions

None at spec time. Surface here if any emerge during execution.

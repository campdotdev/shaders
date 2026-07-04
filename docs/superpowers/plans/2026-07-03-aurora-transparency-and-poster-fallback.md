# Aurora Transparency + Poster Fallback Migration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Shader co-writing exception:** `registry/aurora/shader.tsx` is written by the user, not by agents. Its transparency change (Phase 1) is **already complete**. No task in this plan edits `shader.tsx`.

**Goal:** Make `<Aurora>` render as a transparent layer (drop its `background` prop), and migrate all demo pages off the "static poster behind an opaque canvas" fallback onto a transparency-safe `onFirstPaint` mechanism.

**Architecture:** Aurora's shader now outputs premultiplied `vec4(rgb, alpha)` with coverage alpha (done). The demo pages currently hide a server-rendered poster by covering it with an opaque canvas — an assumption transparency breaks. We add an `onFirstPaint?: () => void` callback to `ShaderScene` that fires once the shader's first frame is on screen; each page keeps its SSR poster but removes it on that callback instead of relying on opacity.

**Tech Stack:** React 19, TypeScript 5 (strict, `verbatimModuleSyntax`, `noUncheckedIndexedAccess`), Three.js TSL / WebGPU, Next.js 15 (docs), Playwright (visual regression), pnpm workspaces + tsup.

## Global Constraints

- No emojis in code or commits.
- Conventional Commits; scope = package without `@lovo/` prefix (`feat(matter-react):`, `fix(docs):`, etc.).
- `import type` for type-only imports (lint-enforced).
- Docs consume **built `dist`** of `@lovo/matter` / `@lovo/matter-react`. Any engine edit requires `pnpm --filter @lovo/matter-react build` + docs dev-server restart before it takes effect.
- Never rebuild a `NodeMaterial` on prop change; never re-run the heavy `ShaderScene` init effect on a callback-identity change (route callbacks through a ref).
- No GPU unit tests. Verification is: `typecheck`, `build`, existing `pnpm test` staying green, visual inspection at gates, and regenerated Playwright baselines.
- Phase gates are non-negotiable: stop at each GATE, show the diff, let the user run the dev server and react before continuing.

---

## Status / Phase 1 (already complete — do not redo)

`registry/aurora/shader.tsx` has been edited by the user:
- Removed the `AuroraBackground` interface, the `background` prop, the `useColorUniform` helper, and the `horizonNode`/`skyNode` nodes.
- Removed the `sky` gradient blend; output is now `material.colorNode = vec4(rgb, alpha)` where `rgb = curtains.max(0)` and `alpha = rgb.x.max(rgb.y).max(rgb.z).clamp(0, 1)`.
- Set `material.transparent = true`.
- Cleaned up `smoothstep`/`sub` imports and the effect deps array.

Consequence: `registry/aurora/aurora.tsx` currently imports `AuroraBackground` from `./shader`, which no longer exists — a TypeScript error fixed in Task 2.

---

## Task 1: Add `onFirstPaint` callback to `ShaderScene`

**Files:**
- Modify: `packages/matter-react/src/components/shader-scene/shader-scene.tsx` (props interface ~line 27-32; state ~line 55; render loop ~line 140-146)
- Modify: `packages/matter-react/CHANGELOG.md`

**Interfaces:**
- Produces: `ShaderScene` accepts `onFirstPaint?: () => void`, invoked exactly once per mount, on the animation frame after the first content frame composites (same tick `firstFramePainted` flips `true`). Consumed by every `scene.tsx` wrapper in Tasks 3–4.

- [ ] **Step 1: Add the prop to the props interface**

In the `ShaderSceneProps` interface (the block containing `children`, `fallback`, `className`, `style` around lines 27–32), add:

```ts
  /** Fires once, on the frame after the shader's first content frame is on screen. */
  onFirstPaint?: () => void;
```

- [ ] **Step 2: Destructure the prop**

Where props are destructured in the component signature (alongside `children`, `fallback`, `className`, `style`), add `onFirstPaint`.

- [ ] **Step 3: Add a ref so the callback never re-runs the init effect**

Immediately after the `const [firstFramePainted, setFirstFramePainted] = useState(false);` line (~line 55), add:

```ts
  const onFirstPaintRef = useRef(onFirstPaint);
  useEffect(() => {
    onFirstPaintRef.current = onFirstPaint;
  }, [onFirstPaint]);
```

Ensure `useRef` is in the `react` import at the top of the file (add it if missing).

- [ ] **Step 4: Fire the callback when the first frame paints**

In `renderFrame`, change the first-paint block (currently lines 140–146):

```ts
          if (!firstPaintSignaled && hasContent) {
            firstPaintSignaled = true;
            firstPaintRaf = requestAnimationFrame(() => {
              firstPaintRaf = null;
              if (!cancelled) setFirstFramePainted(true);
            });
          }
```

to also invoke the ref:

```ts
          if (!firstPaintSignaled && hasContent) {
            firstPaintSignaled = true;
            firstPaintRaf = requestAnimationFrame(() => {
              firstPaintRaf = null;
              if (!cancelled) {
                setFirstFramePainted(true);
                onFirstPaintRef.current?.();
              }
            });
          }
```

Do **not** add `onFirstPaint` to the init effect's dependency array — the ref is what keeps the callback current without re-initializing the renderer.

- [ ] **Step 5: Typecheck the package**

Run: `pnpm --filter @lovo/matter-react typecheck`
Expected: exit 0, no errors.

- [ ] **Step 6: Add a CHANGELOG entry**

In `packages/matter-react/CHANGELOG.md`, under the top/unreleased section, add a bullet:

```markdown
- `ShaderScene` gains an `onFirstPaint?: () => void` prop, fired once when the shader's first frame is on screen. Lets consumers dismiss a server-rendered poster without relying on the shader being opaque.
```

- [ ] **Step 7: Build the package (docs consume dist)**

Run: `pnpm --filter @lovo/matter-react build`
Expected: exit 0; `dist/` regenerated.

- [ ] **Step 8: Run the existing test suite (guard against regression)**

Run: `pnpm --filter @lovo/matter-react test`
Expected: PASS (or `passWithNoTests` green).

- [ ] **Step 9: Commit**

```bash
git add packages/matter-react/src/components/shader-scene/shader-scene.tsx packages/matter-react/CHANGELOG.md
git commit -m "feat(matter-react): add ShaderScene onFirstPaint callback"
```

---

## Task 2: Remove the `background` prop from the Aurora wrapper + registry

**Files:**
- Modify: `registry/aurora/aurora.tsx` (lines 5-12, 24-25, 36-39, 51, 54-57, 61)
- Modify: `registry/registry.json` (Aurora entry, only if it enumerates `background`)

**Interfaces:**
- Consumes: `AuroraShader` from `./shader` no longer accepts `background` (Phase 1).
- Produces: `<Aurora>` no longer accepts a `background` prop; `AuroraBackground` type is no longer exported.

- [ ] **Step 1: Drop the `AuroraBackground` type import + re-export**

Change the import block (lines 5-10) to remove `type AuroraBackground,`:

```ts
import { type AuroraDirection, type AuroraLayer, AuroraShader } from './shader';
```

Change the re-export (line 12) to:

```ts
export type { AuroraDirection, AuroraLayer } from './shader';
```

- [ ] **Step 2: Remove the `background` prop from `AuroraProps`**

Delete lines 24-25:

```ts
  /** Background gradient behind the aurora curtains. */
  background?: Partial<AuroraBackground>;
```

- [ ] **Step 3: Remove `DEFAULT_BACKGROUND`**

Delete the constant (lines 36-39):

```ts
const DEFAULT_BACKGROUND: AuroraBackground = {
  horizon: '#040009',
  sky: '#146389',
};
```

- [ ] **Step 4: Remove `background` from the destructure and the resolver**

In the `Aurora({...})` signature remove `background,` (line 51). Delete the `resolvedBackground` block (lines 54-57):

```ts
  const resolvedBackground: AuroraBackground = {
    horizon: background?.horizon ?? DEFAULT_BACKGROUND.horizon,
    sky: background?.sky ?? DEFAULT_BACKGROUND.sky,
  };
```

- [ ] **Step 5: Remove `background` from the `<AuroraShader>` call**

Delete the `background={resolvedBackground}` line (line 61).

- [ ] **Step 6: Sync `registry.json`**

Run: `grep -n "background" registry/registry.json`
If the Aurora entry lists a `background` prop/example, remove that entry. If there are no matches in the Aurora block, no change needed.

- [ ] **Step 7: Typecheck the registry via the docs app**

Run: `cd apps/docs && npx tsc --noEmit -p tsconfig.json`
Expected: exit 0. (This resolves the dangling `AuroraBackground` import error introduced by Phase 1. Note: `apps/docs/src/app/components/aurora/scene.tsx` still passes `background=` and will error until Task 3 — if so, that single error is expected here and cleared next task.)

- [ ] **Step 8: Commit**

```bash
git add registry/aurora/aurora.tsx registry/registry.json
git commit -m "feat(matter): drop Aurora background prop"
```

---

## Task 3: Migrate the Aurora demo (poster fallback + transparent backdrop) — GATE

**Files:**
- Modify: `apps/docs/src/app/components/aurora/scene.tsx` (remove `background=`, add `onFirstPaint` passthrough)
- Modify: `apps/docs/src/app/components/aurora/params.ts` (remove `horizon`/`sky`)
- Modify: `apps/docs/src/app/components/aurora/page.tsx` (poster → `onFirstPaint`-dismissed, solid backdrop, drop horizon/sky controls)

**Interfaces:**
- Consumes: `ShaderScene`'s `onFirstPaint` (Task 1); `<Aurora>` without `background` (Task 2).

- [ ] **Step 1: Update the Aurora scene wrapper**

In `scene.tsx`: remove the `background={{ horizon: params.horizon, sky: params.sky }}` prop (line ~29). Add `onFirstPaint?: () => void` to the scene component's props, and forward it: `<ShaderScene onFirstPaint={onFirstPaint}>`. (Read the file first to match its exact prop shape — it currently takes `{ params, children }`.)

- [ ] **Step 2: Remove `horizon`/`sky` from demo params**

In `params.ts`: delete `horizon` and `sky` from both the `Params` interface and the `INITIAL` object.

- [ ] **Step 3: Wire the poster dismissal + solid backdrop in the page**

In `page.tsx`:
- Add state: `const [painted, setPainted] = useState(false);`
- Gate the poster `<Image>` on `{!painted && ( <Image ... /> )}` (keep all existing attrs: `alt`, `fill`, `priority`, `sizes`, `src`, `style`).
- Pass `onFirstPaint={() => setPainted(true)}` to `<AuroraScene>`.
- Change the demo container background from `#0a0a14` to a solid color that reads well behind Aurora's greens/blues (recommend a deep neutral, e.g. `#0b0f1a`; final value is a gate decision with the user).
- Remove the `horizon` and `sky` Tweakpane bindings from the pane setup.

- [ ] **Step 4: Typecheck**

Run: `cd apps/docs && npx tsc --noEmit -p tsconfig.json`
Expected: exit 0.

- [ ] **Step 5: Build engine + run docs dev server**

Run: `pnpm --filter @lovo/matter-react build` (if not already fresh from Task 1), then start the docs dev server.

- [ ] **Step 6: GATE — user validation**

Stop. Have the user open the Aurora page and confirm:
- The poster shows briefly, then the live shader appears and the poster is gone (no bleed-through).
- The curtains animate over the solid backdrop; the backdrop color reads well.
- No flash of solid color between poster and shader.
- Tweakpane no longer has horizon/sky; other controls work.

Do not proceed to Task 4 until the user approves the look (including final backdrop color).

- [ ] **Step 7: Commit**

```bash
git add apps/docs/src/app/components/aurora/
git commit -m "fix(docs): Aurora demo uses onFirstPaint poster dismissal + solid backdrop"
```

---

## Task 4: Migrate the remaining 7 demo pages to `onFirstPaint` — GATE

The other pages keep **opaque** shaders, so this is behavior-preserving: the poster shows until first paint, then the opaque shader covers it exactly as before. The change future-proofs them for transparency and removes the opacity assumption.

**Files (each has a `scene.tsx` + `page.tsx`):**
`dot-field`, `grain`, `linear-gradient`, `mesh-gradient`, `simplex-noise`, `vignette`, `waves` under `apps/docs/src/app/components/<name>/`.

**Interfaces:**
- Consumes: `ShaderScene.onFirstPaint` (Task 1).

- [ ] **Step 1: Apply the same edit pattern to each page**

For each of the 7 components, make the identical transformation used in Task 3 (Steps 1 + 3, minus the Aurora-only backdrop/params changes):

In `scene.tsx`: add `onFirstPaint?: () => void` to props and forward to `<ShaderScene onFirstPaint={onFirstPaint}>`.

In `page.tsx`:
- `const [painted, setPainted] = useState(false);`
- Wrap the existing poster `<Image>` in `{!painted && ( ... )}` (preserve all attrs).
- Pass `onFirstPaint={() => setPainted(true)}` to the `<XScene>`.
- Leave the container background as-is (opaque shader covers it).

Poster `src` per page (verify against each file — do not guess): each page already references `/posters/<name>.*`; keep that exact `src`/`alt`.

- [ ] **Step 2: Typecheck**

Run: `cd apps/docs && npx tsc --noEmit -p tsconfig.json`
Expected: exit 0.

- [ ] **Step 3: Lint + format**

Run: `pnpm lint && pnpm format:check`
Expected: exit 0.

- [ ] **Step 4: GATE — user validation**

Stop. Have the user spot-check 2-3 of the migrated pages in the dev server: poster shows, then the shader covers it, no regression vs before.

- [ ] **Step 5: Commit**

```bash
git add apps/docs/src/app/components/
git commit -m "fix(docs): migrate demo posters to onFirstPaint dismissal"
```

---

## Task 5: Regenerate visual baselines + final verification

**Files:**
- Modify: Playwright baseline snapshots (regenerated, not hand-edited)

- [ ] **Step 1: Confirm whether opaque-page baselines changed**

The 6 opaque pages should be pixel-identical post-paint (poster gone by capture time). Only Aurora's baseline changes (transparency + new backdrop). Run the visual regression suite to see which snapshots differ.

Run: the project's Playwright visual regression command (via Docker per the CI baseline workflow — see the CI gotchas memory; baselines must be generated in the pinned Node 22 / Docker environment, not ad hoc).

- [ ] **Step 2: Regenerate the Aurora baseline (and any legitimately-changed snapshot)**

Run the baseline-update command in Docker. Review the diff images to confirm only intended changes (Aurora now transparent over the new backdrop) — reject any unexpected diffs on the other 6.

- [ ] **Step 3: Full verification sweep**

Run: `pnpm typecheck && pnpm lint && pnpm format:check && pnpm build`
Expected: all exit 0.

- [ ] **Step 4: Commit**

```bash
git add apps/docs
git commit -m "test(docs): regenerate Aurora visual baseline for transparent render"
```

---

## Self-Review Notes

- **Spec coverage:** transparency (Phase 1, done) ✓; drop `background` prop (Task 2) ✓; `onFirstPaint` API (Task 1) ✓; all 8 demos migrated (Tasks 3-4) ✓; solid backdrop for Aurora (Task 3) ✓; baselines (Task 5) ✓; registry sync (Task 2) ✓.
- **Ordering:** Task 1 (API) precedes Tasks 3-4 (consumers). Task 2 fixes the Phase-1 dangling type before demo work. Aurora's `scene.tsx` `background=` error from Task 2 is explicitly noted as cleared in Task 3.
- **SSR/LCP:** posters remain server-rendered in `page.tsx` (client components still SSR their initial render), dismissed via `onFirstPaint` — no LCP regression.
- **Known caveat:** on an init error, `ShaderScene` renders its error UI and `onFirstPaint` never fires, so `painted` stays `false` and the poster remains — correct graceful degradation.

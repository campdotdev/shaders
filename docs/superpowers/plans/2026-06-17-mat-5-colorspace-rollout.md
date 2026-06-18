# colorSpace + hueInterpolation rollout — SimplexNoise & MeshGradient (MAT-5, Plan 3 of 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Roll the already-built `colorSpace` and `hueInterpolation` props out to the two remaining components that actually interpolate between colors — `<SimplexNoise>` (via `colorRamp`) and `<MeshGradient>` (via swapping `mix()`→`mixColor`) — then document the `mixColor` primitive, amend the spec scope, and cut a minor version.

**Architecture:** Both props already exist end-to-end on `<LinearGradient>` and in the engine (`colorRamp(t, stops, colorSpace, hueInterpolation)` and `mixColor(a, b, t, colorSpace, hueInterpolation)`). This plan applies the same wiring to two more components. SimplexNoise already colors via `colorRamp`, so it's pure plumbing identical to LinearGradient. MeshGradient blends two palettes with four `mix()` calls, which become `mixColor`. **Aurora and Waves are intentionally excluded** — they composite color additively (no pairwise blend for the prop to govern); the spec's original "all five" scope is amended here.

**Tech Stack:** TypeScript 5 (strict, `verbatimModuleSyntax`, `noUncheckedIndexedAccess`), `three@0.170.0` TSL, React 19, Next.js 15 (docs), Playwright visual regression (`@matter/docs-tests`), `@lovo/matter` engine, Changesets.

## Global Constraints

- TypeScript strict, `verbatimModuleSyntax`, `noUncheckedIndexedAccess`; `import type` for type-only imports. Registry/docs imports are extensionless (per existing files).
- Clear descriptive identifiers (CLAUDE.md naming convention). No emojis in code or commits.
- Conventional Commits. Scopes: `registry` (Tier 1 components), `docs` (docs app), `docs-tests` (visual tests), `matter` (engine — not expected this plan).
- Destructure props in component signatures with defaults (CLAUDE.md `feedback_destructure_props`).
- `colorSpace` (default `'oklab'`) and `hueInterpolation` (default `'shorter'`) are **structural / rebuild props** — they must sit in the material-construction `useEffect` dep array, NOT be pushed through uniforms (CLAUDE.md gotcha #17). They join the same dep array that already rebuilds on `stopsKey` / palette-color changes.
- After editing imports from `@lovo/matter`, the `sort-imports` ESLint rule reorders named members case-insensitively (`colorRamp, type ColorSpace, elapsedTime, type HueInterpolation, …`). Run `pnpm --filter <pkg> lint` and let `eslint --fix` settle the order rather than hand-sorting.
- **Build/verify environment:** a clean static `next build` does NOT complete in this sandbox (it stops after webpack compile with no `out/`); turbo only appears to work by restoring a cached `out/`. Verify rendered behavior against the **dev server** (`pnpm --filter @matter/docs exec next dev -p 3000`, then point Playwright at it with `PLAYWRIGHT_BASE_URL=http://localhost:3000` and `reuseExistingServer`). The dev server consumes `@lovo/matter`'s built `dist`, so rebuild the engine if engine code changes (none expected here).
- **Visual baselines:** SimplexNoise's and MeshGradient's default renders shift (their default interpolation becomes `oklab`), so `*-chromium-darwin.png` and `*-chromium-linux.png` must regenerate. Because the static build is broken here, **baseline regeneration is a CI task** (run `test:visual:update` on the linux CI runner / Playwright docker image, commit both platforms). Do NOT update baselines from a dev-server render. Flag, don't fake.
- This is **not** TDD-by-unit-test: per CLAUDE.md, Tier-1 shader components have no meaningful unit tests. Per-task verification is `typecheck` + `lint`; per-phase verification is a dev-server eyeball gate plus the (CI) baseline regen. The engine math is already covered by the color-space and hue-arc probes.

---

## File Structure

Modify (registry — SimplexNoise):
- `registry/simplex-noise/shader.tsx` — accept `colorSpace` + `hueInterpolation`, pass both to `colorRamp`, add to rebuild deps.
- `registry/simplex-noise/simplex-noise.tsx` — add both optional props (defaults `'oklab'` / `'shorter'`), pass down.

Modify (registry — MeshGradient):
- `registry/mesh-gradient/shader.tsx` — import `mixColor` + types, accept both props, swap the four palette `mix()` calls for `mixColor`, drop the now-unused `mix` import, add both props to rebuild deps.
- `registry/mesh-gradient/mesh-gradient.tsx` — add both optional props, pass down.

Modify (docs):
- `apps/docs/src/app/components/simplex-noise/page.tsx` — `colorSpace` + `hueInterpolation` Tweakpane dropdowns, threaded through params/JSX/copy output.
- `apps/docs/src/app/components/mesh-gradient/page.tsx` — same.
- `apps/docs/src/data/primitives.ts` — add a `mixColor` entry; update the `colorRamp` entry's signature to show the new params.

Amend (spec):
- `docs/superpowers/specs/2026-06-17-mat-5-colorspace-interpolation-design.md` — scope note: Aurora/Waves excluded (additive compositing); `hueInterpolation` added alongside `colorSpace`.

Create (version):
- `.changeset/<name>.md` — minor bump for the `@lovo/*` fixed group.

Regenerate (CI only):
- `apps/docs-tests/visual/simplex-noise.spec.ts-snapshots/*` and `mesh-gradient.spec.ts-snapshots/*` — both platforms, on CI.

---

# PHASE 1 — SimplexNoise (spec phase 4)

SimplexNoise already colors via `colorRamp(bandedValue, rampStops)`; this is the same plumbing as LinearGradient (no new TSL math). Its scalar `mix(quantized, contrastedValue, softnessUniform)` is a noise-value mix, NOT a color mix — leave it alone.

## Task 1.1: Thread both props through the SimplexNoise shader

**Files:**
- Modify: `registry/simplex-noise/shader.tsx`

**Interfaces:**
- Consumes: `colorRamp(t, stops, colorSpace, hueInterpolation)`, `ColorSpace`, `HueInterpolation` (all from `@lovo/matter`).
- Produces: `SimplexNoiseShaderProps` gains `colorSpace: ColorSpace` and `hueInterpolation: HueInterpolation`.

- [ ] **Step 1: Import the types**

Change the `@lovo/matter` import (currently `import { colorRamp, elapsedTime, quantize, simplexNoise } from '@lovo/matter';`) to add the two types:

```ts
import {
  colorRamp,
  type ColorSpace,
  elapsedTime,
  type HueInterpolation,
  quantize,
  simplexNoise,
} from '@lovo/matter';
```

- [ ] **Step 2: Add both fields to `SimplexNoiseShaderProps`**

After `seed: number;` add:

```ts
  colorSpace: ColorSpace;
  hueInterpolation: HueInterpolation;
```

- [ ] **Step 3: Destructure them in the shader signature**

Add `colorSpace` and `hueInterpolation` to the destructured parameter list of `SimplexNoiseShader({ … })` (after `seed`).

- [ ] **Step 4: Pass both to `colorRamp`**

Change the ramp call (currently `colorRamp(bandedValue, rampStops)`) to:

```ts
    colorRamp(bandedValue, rampStops, colorSpace, hueInterpolation);
```

(Keep the surrounding assignment exactly as-is — only the argument list changes.)

- [ ] **Step 5: Add both to the material-rebuild dep array**

In the material-construction `useEffect` dependency array (the one with the `eslint-disable-next-line react-hooks/exhaustive-deps` comment, ending `…, stopsKey ]`), append:

```ts
      colorSpace,
      hueInterpolation,
```

- [ ] **Step 6: Typecheck**

Run: `pnpm --filter @matter/registry typecheck`
Expected: errors at the SimplexNoise call site in `simplex-noise.tsx` about the two missing props (fixed in Task 1.2). The shader file itself is type-correct.

---

## Task 1.2: Add both props to the SimplexNoise wrapper

**Files:**
- Modify: `registry/simplex-noise/simplex-noise.tsx`

**Interfaces:**
- Produces: `SimplexNoiseProps` gains `colorSpace?: ColorSpace` (default `'oklab'`) and `hueInterpolation?: HueInterpolation` (default `'shorter'`).

- [ ] **Step 1: Import the types**

Add to `registry/simplex-noise/simplex-noise.tsx`:

```ts
import type { ColorSpace, HueInterpolation } from '@lovo/matter';
```

- [ ] **Step 2: Add the optional props**

Add to `SimplexNoiseProps`:

```ts
  colorSpace?: ColorSpace;
  hueInterpolation?: HueInterpolation;
```

- [ ] **Step 3: Default and pass down**

Add `colorSpace = 'oklab'` and `hueInterpolation = 'shorter'` to the destructured signature, and pass `colorSpace={colorSpace}` and `hueInterpolation={hueInterpolation}` to `<SimplexNoiseShader />`.

- [ ] **Step 4: Typecheck and lint**

Run: `pnpm --filter @matter/registry typecheck && pnpm --filter @matter/registry lint`
Expected: no errors (lint may auto-fix the `@lovo/matter` member order in the shader — re-run if needed).

- [ ] **Step 5: Commit 1.1 + 1.2 together**

```bash
git add registry/simplex-noise/shader.tsx registry/simplex-noise/simplex-noise.tsx
git commit -m "feat(registry): add colorSpace + hueInterpolation to SimplexNoise"
```

---

## Task 1.3: Add both controls to the SimplexNoise docs page

**Files:**
- Modify: `apps/docs/src/app/components/simplex-noise/page.tsx`

**Interfaces:**
- Consumes: SimplexNoise's two new props; `ColorSpace` / `HueInterpolation` types.

- [ ] **Step 1: Import the types and extend `Params`**

Add `import type { ColorSpace, HueInterpolation } from '@lovo/matter';`. Add to the `Params` interface:

```ts
  colorSpace: ColorSpace;
  hueInterpolation: HueInterpolation;
```

- [ ] **Step 2: Default them in `INITIAL`**

Add to the `INITIAL` object:

```ts
  colorSpace: 'oklab',
  hueInterpolation: 'shorter',
```

- [ ] **Step 3: Add the two dropdowns**

After the `seed` binding (`pane.addBinding(local, 'seed', { min: 0, max: 100, step: 1 });`) and BEFORE `pane.addBlade({ view: 'separator' });`, add:

```ts
      pane.addBinding(local, 'colorSpace', {
        options: {
          OKLab: 'oklab',
          OKLch: 'oklch',
          Linear: 'linear',
          LCH: 'lch',
          HSL: 'hsl',
          HSV: 'hsv',
        },
      });
      pane.addBinding(local, 'hueInterpolation', {
        label: 'hue arc',
        options: {
          shorter: 'shorter',
          longer: 'longer',
          increasing: 'increasing',
          decreasing: 'decreasing',
        },
      });
```

- [ ] **Step 4: Thread through copy output and the component**

In `formatJsx`, add two lines after the `seed` line (inside the `<SimplexNoise … />`):

```ts
    colorSpace="${params.colorSpace}"
    hueInterpolation="${params.hueInterpolation}"
```

In `formatParams`, add after the `seed` line:

```ts
  colorSpace: '${params.colorSpace}',
  hueInterpolation: '${params.hueInterpolation}',
```

In the live `<SimplexNoise … />` JSX usage, add:

```tsx
            colorSpace={params.colorSpace}
            hueInterpolation={params.hueInterpolation}
```

(No `remountKey` exists on this page and none is needed — the shader rebuilds in place via the dep array, exactly as it already does for `stopsKey`.)

- [ ] **Step 5: Typecheck, lint, format**

Run: `pnpm --filter @matter/docs typecheck && pnpm --filter @matter/docs lint && pnpm exec prettier --write apps/docs/src/app/components/simplex-noise/page.tsx`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/docs/src/app/components/simplex-noise/page.tsx
git commit -m "docs: add colorSpace + hueInterpolation controls to the SimplexNoise page"
```

---

## Task 1.4: Verify SimplexNoise and flag the baseline

- [ ] **Step 1: Start the dev server (if not running)**

Run: `pnpm --filter @matter/docs exec next dev -p 3000` (background). Wait until `http://localhost:3000/components/simplex-noise` responds.

- [ ] **Step 2: Sanity-check the page compiles and renders**

Run: `curl -sf http://localhost:3000/components/simplex-noise -o /dev/null && echo OK`
Expected: `OK` (route compiles without error).

### GATE 1 (stop and play — shader phase gate)

Have the user open `http://localhost:3000/components/simplex-noise`, cycle `colorSpace` and `hue arc`, and confirm the noise field's color blend changes character (oklab smooth default; linear; the cylindrical spaces' hue paths) while the stop colors hold. Explain: like LinearGradient, these are structural props that rebuild the material (in-place via the dep array here, since the page has no remountKey).

- [ ] **Step 3: Flag the baseline (CI)**

The SimplexNoise default render now interpolates in `oklab` (was `linear`), so `simplex-noise.spec.ts-snapshots/*-chromium-{darwin,linux}.png` are stale. Regenerate on CI (`pnpm --filter @matter/docs-tests test:visual:update -- simplex-noise`) and commit both platforms. Do not regenerate from the local dev server.

Proceed to Phase 2 only on approval.

---

# PHASE 2 — MeshGradient (spec phase 5)

MeshGradient cross-fades two palettes with four color `mix()` calls. Each becomes `mixColor(…, colorSpace, hueInterpolation)`. The palette colors flow through stable `uniform` nodes (live-editable), and `mixColor` accepts node colors, so palettes stay live while `colorSpace` is structural.

> This touches the visual shader's color logic (the four `mix`→`mixColor` swaps). If executing under the user's shader co-write preference, guide the swaps and let the user type them; otherwise apply directly. The change is a mechanical 1:1 swap, not new TSL math.

## Task 2.1: Swap the palette mixes and thread both props through the MeshGradient shader

**Files:**
- Modify: `registry/mesh-gradient/shader.tsx`

**Interfaces:**
- Consumes: `mixColor(colorA, colorB, t, colorSpace, hueInterpolation)`, `ColorSpace`, `HueInterpolation` (from `@lovo/matter`).
- Produces: `MeshGradientShaderProps` gains `colorSpace: ColorSpace` and `hueInterpolation: HueInterpolation`.

- [ ] **Step 1: Import `mixColor` and the types**

Change the `@lovo/matter` import (currently `import { elapsedTime, simplexNoise } from '@lovo/matter';`) to:

```ts
import {
  type ColorSpace,
  elapsedTime,
  type HueInterpolation,
  mixColor,
  simplexNoise,
} from '@lovo/matter';
```

- [ ] **Step 2: Drop the now-unused `mix` from the three/tsl import**

The only uses of `mix` are the four palette blends being replaced. Remove `mix` from the `three/tsl` import line (`import { abs, cos, mix, pow, sign, sin, smoothstep, uniform, uv, vec2, vec4 } from 'three/tsl';` → drop `mix`). (If lint later reports `mix` still used, restore it — but the inventory shows lines 152/153/156 use `.mul/.add`, not `mix`.)

- [ ] **Step 3: Add both fields to `MeshGradientShaderProps`**

After `palettes: [Palette, Palette];` add:

```ts
  colorSpace: ColorSpace;
  hueInterpolation: HueInterpolation;
```

- [ ] **Step 4: Destructure them**

Add `colorSpace` and `hueInterpolation` to the destructured parameter list of `MeshGradientShader({ … })` (after `palettes`).

- [ ] **Step 5: Swap the four palette mixes**

Replace the four color blends (they read `const colorN = mix(paletteAColorN, paletteBColorN, eased);`) with:

```ts
    const color0 = mixColor(paletteAColor0, paletteBColor0, eased, colorSpace, hueInterpolation);
    const color1 = mixColor(paletteAColor1, paletteBColor1, eased, colorSpace, hueInterpolation);
    const color2 = mixColor(paletteAColor2, paletteBColor2, eased, colorSpace, hueInterpolation);
    const color3 = mixColor(paletteAColor3, paletteBColor3, eased, colorSpace, hueInterpolation);
```

(Leave the `layer1`/`layer2`/`color` composition lines below them unchanged — those are `.mul/.add` blends of already-resolved colors, not pairwise color interpolation.)

- [ ] **Step 6: Add both to the material-rebuild dep array**

In the material-construction `useEffect` dependency array (the one ending `…, paletteBColor3 ]`), append `colorSpace,` and `hueInterpolation,`. (This array has no eslint-disable; the two props are genuinely used in the effect now, so exhaustive-deps wants them.)

- [ ] **Step 7: Typecheck**

Run: `pnpm --filter @matter/registry typecheck`
Expected: errors at the MeshGradient call site in `mesh-gradient.tsx` (fixed in Task 2.2). The shader file is type-correct.

---

## Task 2.2: Add both props to the MeshGradient wrapper

**Files:**
- Modify: `registry/mesh-gradient/mesh-gradient.tsx`

**Interfaces:**
- Produces: `MeshGradientProps` gains `colorSpace?: ColorSpace` (default `'oklab'`) and `hueInterpolation?: HueInterpolation` (default `'shorter'`).

- [ ] **Step 1: Import the types**

Add: `import type { ColorSpace, HueInterpolation } from '@lovo/matter';`

- [ ] **Step 2: Add the optional props**

Add to `MeshGradientProps`:

```ts
  colorSpace?: ColorSpace;
  hueInterpolation?: HueInterpolation;
```

- [ ] **Step 3: Default and pass down**

Add `colorSpace = 'oklab'` and `hueInterpolation = 'shorter'` to the destructured signature, and pass `colorSpace={colorSpace}` and `hueInterpolation={hueInterpolation}` to `<MeshGradientShader />`.

- [ ] **Step 4: Typecheck and lint**

Run: `pnpm --filter @matter/registry typecheck && pnpm --filter @matter/registry lint`
Expected: no errors.

- [ ] **Step 5: Commit 2.1 + 2.2 together**

```bash
git add registry/mesh-gradient/shader.tsx registry/mesh-gradient/mesh-gradient.tsx
git commit -m "feat(registry): add colorSpace + hueInterpolation to MeshGradient (mix -> mixColor)"
```

---

## Task 2.3: Add both controls to the MeshGradient docs page

**Files:**
- Modify: `apps/docs/src/app/components/mesh-gradient/page.tsx`

- [ ] **Step 1: Import the types and extend `Params`**

Add `import type { ColorSpace, HueInterpolation } from '@lovo/matter';`. Add to `Params`:

```ts
  colorSpace: ColorSpace;
  hueInterpolation: HueInterpolation;
```

- [ ] **Step 2: Default them in `INITIAL`**

Add to `INITIAL`:

```ts
  colorSpace: 'oklab',
  hueInterpolation: 'shorter',
```

- [ ] **Step 3: Add the two dropdowns**

After the `cycleEase` binding (`pane.addBinding(local, 'cycleEase', { … });`) and before the palette folders (`aFolder`/`bFolder`), add:

```ts
    pane.addBinding(local, 'colorSpace', {
      options: {
        OKLab: 'oklab',
        OKLch: 'oklch',
        Linear: 'linear',
        LCH: 'lch',
        HSL: 'hsl',
        HSV: 'hsv',
      },
    });
    pane.addBinding(local, 'hueInterpolation', {
      label: 'hue arc',
      options: {
        shorter: 'shorter',
        longer: 'longer',
        increasing: 'increasing',
        decreasing: 'decreasing',
      },
    });
```

- [ ] **Step 4: Thread through copy output and the component**

In `formatJsx`, add after the `cycleEase` line (before `palettes={[`):

```ts
    colorSpace="${params.colorSpace}"
    hueInterpolation="${params.hueInterpolation}"
```

In `formatParams`, add after the `cycleEase` line (before `palettes: [`):

```ts
  colorSpace: '${params.colorSpace}',
  hueInterpolation: '${params.hueInterpolation}',
```

In the live `<MeshGradient … />` JSX, add:

```tsx
            colorSpace={params.colorSpace}
            hueInterpolation={params.hueInterpolation}
```

(No `remountKey` needed — palette colors update via uniforms; `colorSpace`/`hueInterpolation` rebuild in place via the shader dep array.)

- [ ] **Step 5: Typecheck, lint, format**

Run: `pnpm --filter @matter/docs typecheck && pnpm --filter @matter/docs lint && pnpm exec prettier --write apps/docs/src/app/components/mesh-gradient/page.tsx`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/docs/src/app/components/mesh-gradient/page.tsx
git commit -m "docs: add colorSpace + hueInterpolation controls to the MeshGradient page"
```

---

## Task 2.4: Verify MeshGradient and flag the baseline

- [ ] **Step 1: Sanity-check the page renders**

With the dev server running: `curl -sf http://localhost:3000/components/mesh-gradient -o /dev/null && echo OK`
Expected: `OK`.

### GATE 2 (stop and play — shader phase gate)

Have the user open `http://localhost:3000/components/mesh-gradient`, cycle `colorSpace` and `hue arc`, and confirm the palette cross-fade blends in the chosen space (default `oklab` should look smoother/more vivid than `linear`; palettes remain live-editable while switching spaces). Explain: the four palette blends now go through `mixColor`; palette colors stay uniform-driven (live), only `colorSpace`/`hueInterpolation` rebuild the material.

- [ ] **Step 2: Flag the baseline (CI)**

MeshGradient's default render now interpolates in `oklab` (was a linear `mix`), so `mesh-gradient.spec.ts-snapshots/*-chromium-{darwin,linux}.png` are stale. Regenerate on CI (`pnpm --filter @matter/docs-tests test:visual:update -- mesh-gradient`) and commit both platforms.

Proceed to Phase 3 only on approval.

---

# PHASE 3 — Docs, spec amendment, and version

## Task 3.1: Document the `mixColor` primitive and update `colorRamp`

**Files:**
- Modify: `apps/docs/src/data/primitives.ts`

**Interfaces:**
- Consumes: the existing `colorRamp` entry shape (read it first — `name`, `signature`, `description`, and whatever other fields entries carry).

- [ ] **Step 1: Read the existing `colorRamp` entry**

Open `apps/docs/src/data/primitives.ts`, find the `colorRamp` entry (around line 21), and note every field it sets — the new `mixColor` entry must use the same shape.

- [ ] **Step 2: Update the `colorRamp` entry's signature**

Edit `colorRamp`'s `signature` to reflect the two new trailing params, e.g.:

```ts
signature: `function colorRamp(
  t: TSLNode,
  stops: ColorRampStop[],
  colorSpace?: ColorSpace,        // default 'oklab' at the component layer
  hueInterpolation?: HueInterpolation, // default 'shorter'
): ShaderNodeObject<Node>`,
```

(Match the existing entry's exact field names and formatting; adjust the prose `description` to mention interpolation space + hue arc.)

- [ ] **Step 3: Add a `mixColor` entry**

Add a sibling entry mirroring `colorRamp`'s shape:

```ts
{
  name: 'mixColor',
  signature: `function mixColor(
  colorA: TSLNode,
  colorB: TSLNode,
  t: TSLNode,
  colorSpace?: ColorSpace,        // default 'oklab'
  hueInterpolation?: HueInterpolation, // default 'shorter'
): ShaderNodeObject<Node>`,
  description:
    'Blend two linear-sRGB colors in a chosen color space (perceptual oklab by default), with a selectable hue-arc direction for the cylindrical spaces. Used by MeshGradient; the pairwise sibling of colorRamp.',
  // …any remaining fields the colorRamp entry uses (category, example, etc.)
},
```

- [ ] **Step 4: Typecheck, lint, format**

Run: `pnpm --filter @matter/docs typecheck && pnpm --filter @matter/docs lint && pnpm exec prettier --write apps/docs/src/data/primitives.ts`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/docs/src/data/primitives.ts
git commit -m "docs: document mixColor and colorRamp's colorSpace/hueInterpolation params"
```

---

## Task 3.2: Amend the spec's scope

**Files:**
- Modify: `docs/superpowers/specs/2026-06-17-mat-5-colorspace-interpolation-design.md`

- [ ] **Step 1: Correct the scope decision and rollout**

In Decision 3 ("Scope: all multi-color components …") and the "Per-component rollout" list, note that **Aurora and Waves are excluded**: they composite color additively (no pairwise blend), so `colorSpace`/`hueInterpolation` have no target there. The applied scope is LinearGradient, SimplexNoise, MeshGradient. Add a one-line note that `hueInterpolation` (four CSS Color 4 keywords, default `'shorter'`) was added alongside `colorSpace` after the spec was written, and that LCH's XYZ→sRGB green coefficient was corrected during the rollout.

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-06-17-mat-5-colorspace-interpolation-design.md
git commit -m "docs: amend MAT-5 spec scope (Aurora/Waves additive, exclude; add hueInterpolation)"
```

---

## Task 3.3: Cut a minor version via changeset

**Files:**
- Create: `.changeset/<descriptive-name>.md`

**Interfaces:**
- Consumes: the changeset config (`fixed` group `@lovo/matter` + `@lovo/matter-react` + `@lovo/matter-cli`; `@matter/registry`/`docs`/`docs-tests` ignored). A single `@lovo/matter` minor bumps all three fixed packages together (currently `0.5.0` → `0.6.0`).

- [ ] **Step 1: Write the changeset**

Create `.changeset/mat-5-colorspace-hue-interpolation.md`:

```markdown
---
'@lovo/matter': minor
---

Add color-space-aware interpolation. `colorRamp` and the new `mixColor` primitive
accept `colorSpace` ('linear' | 'oklab' | 'oklch' | 'lch' | 'hsl' | 'hsv',
default 'oklab') and `hueInterpolation` ('shorter' | 'longer' | 'increasing' |
'decreasing', default 'shorter'). LinearGradient, SimplexNoise, and MeshGradient
gain matching props. Foundation fix: hex colors now decode to linear-sRGB (true
color), and the LCH conversion's green coefficient was corrected. This shifts the
default appearance of those components (pre-1.0 breaking color change).
```

- [ ] **Step 2: Verify the changeset is recognized**

Run: `pnpm changeset status`
Expected: lists `@lovo/matter` (and the fixed-group siblings) for a minor bump. (Do NOT run `version-packages` here — releasing is a separate, deliberate step the user runs.)

- [ ] **Step 3: Commit**

```bash
git add .changeset/mat-5-colorspace-hue-interpolation.md
git commit -m "chore: changeset for colorSpace + hueInterpolation (minor)"
```

### GATE 3 (final review)

Summarize for the user: SimplexNoise + MeshGradient now carry `colorSpace`/`hueInterpolation`; Aurora/Waves are documented-out; `mixColor` is in the primitive reference; a minor changeset is staged. Remaining non-blocking follow-ups: **CI baseline regen** (SimplexNoise + MeshGradient, both platforms — the static build can't run here) and **poster regen** (stale since the foundation color shift; `docs/superpowers/plans/2026-06-07-matter-poster-cli.md`). Confirm before any PR/merge.

---

## Self-Review

**Spec coverage (phases 4–8, as amended):**
- Phase 4 SimplexNoise `colorSpace` (via `colorRamp`) — Tasks 1.1–1.3; `hueInterpolation` folded in. ✅
- Phase 5 MeshGradient `mix`→`mixColor` + `colorSpace` — Tasks 2.1–2.3; `hueInterpolation` folded in. ✅
- Phases 6–7 Aurora/Waves — **descoped** (additive compositing); spec amended in Task 3.2. ✅
- Phase 8 docs + version — `mixColor` primitive doc (3.1), changeset (3.3). ✅
- Baseline regen — flagged CI per component (1.4, 2.4); cannot run locally (broken static build). ✅
- Gates — GATE 1 (SimplexNoise), GATE 2 (MeshGradient), GATE 3 (final). ✅

**Placeholder scan:** Task 3.1 references "any remaining fields the colorRamp entry uses" — this is a deliberate instruction to match an existing on-disk shape (the executor reads `primitives.ts` in Step 1), not an unfilled blank. No TBD/TODO elsewhere.

**Type consistency:** `colorSpace: ColorSpace` / `hueInterpolation: HueInterpolation` are the prop names across both shaders, both wrappers, and both docs pages; defaults `'oklab'` / `'shorter'` at the wrapper + docs layers; `colorRamp(t, stops, colorSpace, hueInterpolation)` and `mixColor(a, b, t, colorSpace, hueInterpolation)` match the engine signatures already shipped this session.

**Known gaps (intentionally deferred):** CI baseline regen (both components, both platforms); poster regen; the actual `changeset version` + publish (user-run release step). All flagged, none block the gates.

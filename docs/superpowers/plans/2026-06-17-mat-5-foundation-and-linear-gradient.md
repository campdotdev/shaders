# Color foundation fix + LinearGradient colorSpace (MAT-5, Plan 2 of 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the double-encode foundation so all components render true sRGB colors (decode hex→linear once, at `parseHex`), then expose a `colorSpace` prop on `<LinearGradient>` end-to-end (default `oklab`), wired to the Plan 1 `colorRamp` parameter.

**Architecture:** Two gated phases. Phase A changes the single shared color entry point — `registry/utils/color.ts` `parseHex` — to decode sRGB→linear via the engine's already-tested `srgbChannelToLinear`; because every component parses colors through `parseHex`, this corrects all of them at once, and all visual baselines regenerate. Phase B threads a `colorSpace` prop through the LinearGradient wrapper → shader → `colorRamp`, and adds a Tweakpane control on the docs page.

**Tech Stack:** TypeScript 5 (strict, `verbatimModuleSyntax`), `three@0.170.0` TSL, React 19, Next.js 15 (docs), Playwright visual regression (`@matter/docs-tests`), `@lovo/matter` engine.

**Scope note:** Plan 2 of 3 for the MAT-5 spec (`docs/superpowers/specs/2026-06-17-mat-5-colorspace-interpolation-design.md`), covering spec **Phase 2 (foundation) + Phase 3 (LinearGradient)**. Plan 1 (engine primitives) is complete. Plan 3 will roll `colorSpace` out to SimplexNoise/MeshGradient/Aurora/Waves and handle docs/version.

## Global Constraints

- TypeScript strict, `verbatimModuleSyntax`, `noUncheckedIndexedAccess`; `import type` for type-only imports; relative imports end in `.js` (engine) / extensionless within registry+docs per existing files.
- Clear descriptive identifiers (CLAUDE.md naming convention). No emojis in code or commits.
- Conventional Commits. Scopes: `matter` (engine), `registry` (Tier 1 components), `docs` (docs app), `docs-tests` (visual tests).
- Destructure props in component signatures with defaults (CLAUDE.md `feedback_destructure_props`).
- `colorSpace` is a **structural / rebuild** prop — it must be in the material-construction `useEffect` dep array, NOT pushed through a uniform (CLAUDE.md gotcha #17; same class as `stops`).
- **Foundation default stays `'oklab'` at the component layer; `colorRamp`'s own param default remains `'linear'`** (set in Plan 1).
- **Platform baselines:** visual baselines have `-chromium-darwin.png` and `-chromium-linux.png` variants. `test:visual:update` regenerates only the **current** platform. Linux baselines must be regenerated in a linux environment (CI runner or the Playwright docker image) — this cannot be done on macOS; flag it, do not fake it.

---

## File Structure

Modify (engine):
- `packages/matter/src/primitives/color-space/index.ts` — also export `srgbChannelToLinear`.
- `packages/matter/src/index.ts` — re-export `srgbChannelToLinear`.

Modify (registry):
- `registry/utils/color.ts` — `parseHex` decodes sRGB→linear via `srgbChannelToLinear`.
- `registry/linear-gradient/shader.tsx` — accept `colorSpace`, pass to `colorRamp`, add to rebuild deps.
- `registry/linear-gradient/linear-gradient.tsx` — add `colorSpace?: ColorSpace` prop (default `'oklab'`).

Modify (docs):
- `apps/docs/src/app/components/linear-gradient/page.tsx` — Tweakpane `colorSpace` control threaded through params/JSX.

Regenerate (test artifacts):
- `apps/docs-tests/visual/*-snapshots/*-chromium-darwin.png` — all components (Phase A), then linear-gradient again (Phase B). Linux variants regenerated in CI.

Out of this plan (flagged): `apps/docs/public/posters/*` become stale after the color shift — regenerate via the poster CLI (`docs/superpowers/plans/2026-06-07-matter-poster-cli.md`) as a follow-up. Version/changeset deferred to Plan 3.

---

# PHASE A — Foundation fix (spec Phase 2)

## Task A1: Export `srgbChannelToLinear` from `@lovo/matter`

**Files:**
- Modify: `packages/matter/src/primitives/color-space/index.ts`
- Modify: `packages/matter/src/index.ts`

**Interfaces:**
- Produces: public `srgbChannelToLinear(channel: number): number` from `@lovo/matter`.

- [ ] **Step 1: Add to the color-space barrel**

In `packages/matter/src/primitives/color-space/index.ts`, add below the existing exports:

```ts
export { srgbChannelToLinear } from './transfer.js';
```

- [ ] **Step 2: Re-export from the package entry**

In `packages/matter/src/index.ts`, below the existing `mixColor`/`ColorSpace` exports:

```ts
export { srgbChannelToLinear } from './primitives/color-space/index.js';
```

- [ ] **Step 3: Build and verify the export resolves**

Run: `pnpm --filter @lovo/matter build && pnpm --filter @lovo/matter test && pnpm --filter @lovo/matter typecheck`
Expected: build succeeds, 67 tests pass, no type errors. (`srgbChannelToLinear` is already covered by `transfer.test.ts`.)

- [ ] **Step 4: Commit**

```bash
git add packages/matter/src/primitives/color-space/index.ts packages/matter/src/index.ts
git commit -m "feat(matter): export srgbChannelToLinear for the foundation fix"
```

---

## Task A2: Decode sRGB→linear in `parseHex`

**Files:**
- Modify: `registry/utils/color.ts`

**Interfaces:**
- Consumes: `srgbChannelToLinear` (Task A1).
- Produces: `parseHex(hex)` now returns **linear-sRGB** channels in [0,1] (was gamma-encoded). All callers (`toColorRampStops`, and `useColorUniform`/inline parsing in mesh-gradient, aurora, waves, vignette, dot-field) inherit the fix unchanged.

> No unit test: the registry has no test runner, and `parseHex` is now a trivial composition of the already-tested `srgbChannelToLinear` with `hex/255`. Correctness is verified empirically in Task A3 (the rendered colors must match true hex, not the lightened double-encode).

- [ ] **Step 1: Add the import**

At the top of `registry/utils/color.ts`, add:

```ts
import { srgbChannelToLinear } from '@lovo/matter';
```

- [ ] **Step 2: Decode each channel in `parseHex`**

Replace the existing `parseHex` with:

```ts
/**
 * Parse a `#rrggbb` hex string into **linear-sRGB** channels in [0, 1].
 *
 * Hex is gamma-encoded sRGB; we decode it to linear here so the value handed to
 * `material.colorNode` is genuine linear-sRGB. The renderer then re-encodes
 * linear→sRGB on output, so solid colors render at their true hex appearance.
 * (Before this decode, gamma digits were fed as if linear and re-encoded —
 * the double-encode that lightened every color.)
 */
export const parseHex = (hex: string): [number, number, number] => {
  const cleanedHex = hex.replace('#', '');

  return [
    srgbChannelToLinear(parseInt(cleanedHex.slice(0, 2), 16) / 255),
    srgbChannelToLinear(parseInt(cleanedHex.slice(2, 4), 16) / 255),
    srgbChannelToLinear(parseInt(cleanedHex.slice(4, 6), 16) / 255),
  ];
};
```

- [ ] **Step 3: Typecheck and lint the registry**

Run: `pnpm --filter @matter/registry typecheck && pnpm --filter @matter/registry lint`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add registry/utils/color.ts
git commit -m "fix(registry): decode hex to linear-sRGB in parseHex (fixes double-encode)"
```

---

## Task A3: Regenerate baselines + verify the double-encode is gone

**Files:**
- Regenerate: `apps/docs-tests/visual/*-snapshots/*-chromium-darwin.png` (all components)

- [ ] **Step 1: Regenerate the darwin baselines**

Run: `pnpm --filter @matter/docs-tests test:visual:update`
Expected: Playwright builds + previews the docs site, updates every `*-chromium-darwin.png`. All component canvases now render true (darker/more saturated) colors.

- [ ] **Step 2: Empirically confirm the fix (non-circular check)**

The default LinearGradient story uses stops `#661acc` (violet, t=0), `#9e00ba` (purple, t=0.5), `#8c0067` (magenta, t=1) at `angle=90`. Sample the regenerated baseline and confirm the stops now render at their **true** hex (naive passthrough), not the double-encoded values.

Run:

```bash
python3 - <<'PY'
from PIL import Image
p = "apps/docs-tests/visual/linear-gradient.spec.ts-snapshots/linear-gradient-default-chromium-darwin.png"
im = Image.open(p).convert("RGB"); W, H = im.size; cx = W // 2
def hx(h): return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))
print("size", im.size)
print("top    (t=1, magenta #8c0067):", im.getpixel((cx, 2)),      "expect ~", hx("8c0067"))
print("middle (t=0.5, purple #9e00ba):", im.getpixel((cx, H // 2)), "expect ~", hx("9e00ba"))
print("bottom (t=0, violet  #661acc):", im.getpixel((cx, H - 3)),   "expect ~", hx("661acc"))
PY
```

Expected: the sampled pixels are within ~±6 per channel of the TRUE hex values — e.g. bottom ≈ `(102, 26, 204)`, NOT the old double-encoded `(170, 90, 231)`. If they still match the lightened values, the decode did not take effect — stop and debug before proceeding.

- [ ] **Step 3: Confirm the visual suite passes against the new baselines**

Run: `pnpm --filter @matter/docs-tests test:visual`
Expected: all darwin specs pass (they now compare against the regenerated baselines). The `color-space` spec (Plan 1) still passes.

- [ ] **Step 4: Commit the regenerated darwin baselines**

```bash
git add apps/docs-tests/visual
git commit -m "test(docs-tests): regenerate darwin baselines for true-color foundation"
```

- [ ] **Step 5: Flag the linux baselines**

Linux baselines (`*-chromium-linux.png`) are now stale and CANNOT be regenerated on macOS. They must be regenerated in a linux environment. Options to surface to the user:
- Run `test:visual:update` on the CI linux runner and commit the result, or
- `docker run --rm -v "$(pwd)":/work -w /work mcr.microsoft.com/playwright:v1.<match>-jammy bash -lc "corepack enable && pnpm install && pnpm --filter @matter/docs-tests test:visual:update"` (match the installed Playwright version).

Do not claim the linux baselines are updated until they have been regenerated on linux.

### GATE A (stop and play — shader phase gate)

Show the user the regenerated baselines / dev render. Have them run `pnpm --filter @matter/docs dev` and click through every component page: colors now render at their true hex (darker, more saturated) instead of lightened. Confirm:
1. The brand palette still looks good in true color — **re-tune `apps/docs/src/lib/palette.ts` only if something looks off** (likely a no-op; the palette was designed in OKLCH as true colors). This is the one place palette work happens.
2. Note the now-stale posters (`apps/docs/public/posters`) — flagged for a follow-up poster-CLI regen.

Proceed to Phase B only on approval.

---

# PHASE B — LinearGradient colorSpace (spec Phase 3)

## Task B1: Thread `colorSpace` through the LinearGradient shader

**Files:**
- Modify: `registry/linear-gradient/shader.tsx`

**Interfaces:**
- Consumes: `colorRamp(t, stops, colorSpace)` (Plan 1), `ColorSpace` type (`@lovo/matter`).
- Produces: `LinearGradientShaderProps` gains `colorSpace: ColorSpace`.

- [ ] **Step 1: Import the `ColorSpace` type**

In `registry/linear-gradient/shader.tsx`, extend the existing `@lovo/matter` import:

```ts
import { type ColorSpace, colorRamp, elapsedTime } from '@lovo/matter';
```

- [ ] **Step 2: Add `colorSpace` to the props and signature**

Add to `LinearGradientShaderProps`:

```ts
  colorSpace: ColorSpace;
```

Add `colorSpace` to the destructured parameters of `LinearGradientShader({ ... })`.

- [ ] **Step 3: Pass `colorSpace` to `colorRamp`**

Change the colorNode assignment:

```ts
    material.colorNode = colorRamp(animatedGradientCoord, rampStops, colorSpace);
```

- [ ] **Step 4: Add `colorSpace` to the material rebuild deps**

In the material-construction `useEffect` dependency array (the one with the `eslint-disable-next-line react-hooks/exhaustive-deps` comment), add `colorSpace`:

```ts
  }, [shaderContext, stopsKey, cursor, speedUniform, cursorUniform, dirNode, colorSpace]);
```

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter @matter/registry typecheck`
Expected: errors about missing `colorSpace` at the call site in `linear-gradient.tsx` (fixed in Task B2). The shader file itself is type-correct.

---

## Task B2: Add the `colorSpace` prop to the LinearGradient wrapper

**Files:**
- Modify: `registry/linear-gradient/linear-gradient.tsx`

**Interfaces:**
- Produces: `LinearGradientProps` gains `colorSpace?: ColorSpace` (default `'oklab'`).

- [ ] **Step 1: Import the `ColorSpace` type**

Add to `registry/linear-gradient/linear-gradient.tsx`:

```ts
import type { ColorSpace } from '@lovo/matter';
```

- [ ] **Step 2: Add the prop with a default and pass it down**

Add `colorSpace?: ColorSpace;` to `LinearGradientProps`. Add `colorSpace = 'oklab'` to the destructured signature, and pass `colorSpace={colorSpace}` to `<LinearGradientShader />`.

- [ ] **Step 3: Typecheck and lint the registry**

Run: `pnpm --filter @matter/registry typecheck && pnpm --filter @matter/registry lint`
Expected: no errors.

- [ ] **Step 4: Commit B1 + B2 together**

```bash
git add registry/linear-gradient/shader.tsx registry/linear-gradient/linear-gradient.tsx
git commit -m "feat(registry): add colorSpace prop to LinearGradient (default oklab)"
```

---

## Task B3: Add a `colorSpace` control to the docs LinearGradient page

**Files:**
- Modify: `apps/docs/src/app/components/linear-gradient/page.tsx`

**Interfaces:**
- Consumes: `LinearGradient`'s `colorSpace` prop (B2); `ColorSpace` type.

- [ ] **Step 1: Import the type and extend `Params`**

Add `import type { ColorSpace } from '@lovo/matter';` and add to the `Params` interface:

```ts
  colorSpace: ColorSpace;
```

- [ ] **Step 2: Default `colorSpace` in `INITIAL`**

Add to the `INITIAL` object:

```ts
  colorSpace: 'oklab',
```

- [ ] **Step 3: Add the Tweakpane dropdown**

After the `focalY` binding (before the `separator` blade), add:

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
```

- [ ] **Step 4: Pass `colorSpace` to the component and include it in the copy output**

Add `colorSpace={params.colorSpace}` to the `<LinearGradient ... />` usage. In `formatJsx`, add a `colorSpace="${params.colorSpace}"` line; in `formatParams`, add `colorSpace: '${params.colorSpace}',`. Add `colorSpace` to `remountKey` so switching spaces remounts:

```ts
  const remountKey =
    params.colorSpace + '|' + params.stops.map((stop) => `${stop.color}@${stop.position}`).join('|');
```

- [ ] **Step 5: Typecheck and lint the docs app**

Run: `pnpm --filter @matter/docs typecheck && pnpm --filter @matter/docs lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/docs/src/app/components/linear-gradient/page.tsx
git commit -m "docs: add colorSpace control to the LinearGradient page"
```

---

## Task B4: Regenerate the LinearGradient baseline (oklab default)

**Files:**
- Regenerate: `apps/docs-tests/visual/linear-gradient.spec.ts-snapshots/linear-gradient-default-chromium-darwin.png`

- [ ] **Step 1: Regenerate just the LinearGradient darwin baseline**

Run: `pnpm --filter @matter/docs-tests test:visual:update -- linear-gradient`
Expected: the LinearGradient baseline updates. Versus Phase A, only the midpoint **path** changes (oklab vs the prior linear interpolation); the stop colors at t=0/0.5/1 are unchanged.

- [ ] **Step 2: Confirm the suite still passes**

Run: `pnpm --filter @matter/docs-tests test:visual -- linear-gradient`
Expected: pass.

- [ ] **Step 3: Commit**

```bash
git add apps/docs-tests/visual/linear-gradient.spec.ts-snapshots
git commit -m "test(docs-tests): regenerate LinearGradient baseline for oklab default"
```

### GATE B (stop and play — shader phase gate)

Have the user run `pnpm --filter @matter/docs dev`, open the LinearGradient page, and cycle the new `colorSpace` dropdown through all six spaces. Confirm the gradient's midpoint character changes (oklab smooth/vivid; linear; hsl/hsv through magenta; etc.) while the stop colors hold. Explain: `colorSpace` rebuilds the material (structural), which is why switching is a remount, not a uniform tweak.

On approval, Plan 3 rolls `colorSpace` out to SimplexNoise, MeshGradient, Aurora, Waves, plus docs/version.

---

## Self-Review

**Spec coverage (Phases 2–3):**
- Decode hex→linear at one entry point — Task A2 (`parseHex`), reused by all components. ✅
- All baselines regenerate once — Task A3 (darwin) + linux flagged. ✅
- Palette verification gate — GATE A. ✅
- `colorSpace` prop on LinearGradient (default oklab), wired to `colorRamp` — Tasks B1/B2. ✅
- Structural/rebuild prop, not a uniform — B1 Step 4 (dep array). ✅
- Tweakpane control to eyeball each space — Task B3, GATE B. ✅
- LinearGradient baseline regenerated for oklab — Task B4. ✅

**Placeholder scan:** No TBD/TODO. The one "no unit test" note is justified inline (no registry test runner + empirical Task A3 check), not a vague skip. ✅

**Type consistency:** `colorSpace: ColorSpace` is the prop name across shader (B1), wrapper (B2), and docs params (B3); default `'oklab'` at the wrapper + docs layers; `srgbChannelToLinear(channel: number): number` matches its Plan 1 definition and the A2 call. ✅

**Known gaps (intentionally deferred):** posters stale (follow-up poster-CLI regen); linux baselines (CI/docker); version/changeset (Plan 3). All flagged, none block the gates.

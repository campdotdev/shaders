# MAT-5 colorSpace — session handoff (2026-06-17)

Context handoff for resuming the color-space interpolation work in a fresh session.

## TL;DR

Adding per-component `colorSpace` interpolation (`linear` / `oklab` / `oklch` / `lch` / `hsl` / `hsv`) to Matter's shader components. **Plan 1 (engine primitives) and Plan 2 Phase A (foundation fix) are DONE and committed.** Next up: **Plan 2 Phase B** — thread the `colorSpace` prop through `<LinearGradient>` (pure plumbing). Then write + run Plan 3 (roll out to SimplexNoise/MeshGradient/Aurora/Waves + docs/version).

- Branch: `hunter/mat-5-support-colorspace-prop-across-registry-components`
- Working tree: clean. No dev servers should be running.

## Read these first

- Spec: `docs/superpowers/specs/2026-06-17-mat-5-colorspace-interpolation-design.md`
- Plan 1 (DONE): `docs/superpowers/plans/2026-06-17-mat-5-colorspace-primitives.md`
- Plan 2 (Phase A DONE, Phase B NEXT): `docs/superpowers/plans/2026-06-17-mat-5-foundation-and-linear-gradient.md`
- Plan 3: not written yet — write after Phase B passes its gate.
- Memories (auto-loaded): `project_color_pipeline_double_encode`, `project_renderer_resize_gotcha`, `project_color_features`, `feedback_shader_*`.

## Decisions (settled — do not re-litigate)

- **Fix the foundation** (decode hex→linear) — done.
- **Default interpolation space: `oklab`** (component-prop default). `colorRamp`'s own param defaults to `'linear'` (behavior-preserving).
- **Scope:** LinearGradient, SimplexNoise, MeshGradient, Aurora, Waves (the multi-color components). Overlays (Vignette/FilmGrain/DotField) excluded from the prop.
- **Architecture:** one `mixColor(a, b, t, space)` primitive + per-space conversions (internal); `colorRamp` interpolates in-space and converts back once.
- **Public API:** `mixColor`, `ColorSpace`, `srgbChannelToLinear`. Individual conversions stay internal.
- **Cylindrical spaces** (oklch/lch/hsl/hsv) use shortest-arc hue; HSL/HSV operate on gamma sRGB; OKLch/LCH clip out-of-gamut to [0,1].

## What's committed / done

1. **Engine color-space module** (`packages/matter/src/primitives/color-space/`): 6 conversions, `mixColor`, `colorRamp` `colorSpace` param, `srgbChannelToLinear` export. Verified by the Playwright probe (round-trip identity + OKLab midpoint exact).
2. **Foundation fix:** `parseHex` (`registry/utils/color.ts`) decodes hex→linear via `srgbChannelToLinear`. All components now render true-color (previously double-encoded/lightened).
3. **Renderer resize fix** (was the real cause of the apparent "uv compression" — NOT a color bug): `create-renderer.ts` resize guard now compares the renderer's logical `getSize()` (not `canvas.width`); `shader-scene.tsx` uses a `ResizeObserver` (not just window resize). The renderer had been stuck at the 300×150 default.
4. **Probe uses `uv()`** (not `screenUV` — `screenUV` reliably breaks the docs static-export build; `uv()` is correct once the renderer is sized right).
5. **turbo.json:** `build` outputs now include `.next/**` and `out/**` (were missing → cached docs builds restored an incomplete tree with no `out/` → "silent" build failures).
6. **Darwin visual baselines regenerated** for true-color (LinearGradient/SimplexNoise/Aurora/FilmGrain shifted past threshold; others stayed within tolerance).

## NEXT: Plan 2 Phase B (LinearGradient colorSpace)

Follow Plan 2's Phase B tasks (B1–B4). It is **pure plumbing — no new TSL math, so no shader co-write needed**:
- **B1** `registry/linear-gradient/shader.tsx`: add `colorSpace: ColorSpace` to props, pass to `colorRamp(animatedGradientCoord, rampStops, colorSpace)`, add `colorSpace` to the material-rebuild `useEffect` deps (it's a structural/rebuild prop).
- **B2** `registry/linear-gradient/linear-gradient.tsx`: add `colorSpace?: ColorSpace` (default `'oklab'`), pass down.
- **B3** `apps/docs/src/app/components/linear-gradient/page.tsx`: add a Tweakpane `colorSpace` dropdown (6 options), thread through params/JSX/`remountKey`.
- **B4**: regenerate the LinearGradient baseline (see build/baseline procedure below), then **Gate B** (eyeball each space in Tweakpane — the midpoint character should change while the stop colors hold).

After Gate B: write Plan 3 (rollout to SimplexNoise → MeshGradient → Aurora → Waves; MeshGradient/Aurora/Waves swap `mix()`→`mixColor`; then docs + changeset/version bump).

## Build & baseline procedure (IMPORTANT — non-obvious)

The docs static build is reliable **only via turbo** now (it tracks `out/`). The Playwright `webServer` uses the non-turbo `pnpm --filter @matter/docs build`, which is flaky in this environment. To regenerate baselines reliably:

```bash
pnpm turbo run build --filter=@matter/docs     # produces apps/docs/out/
pnpm --filter @matter/docs preview &           # serve out on :3000
pnpm --filter @matter/docs-tests exec playwright test --update-snapshots   # reuses the server
```

- **Linux baselines are stale** — only darwin is regenerated. Regenerate `*-chromium-linux.png` in CI / a linux env (Playwright docker image) before the branch is CI-green.
- Headless Playwright here falls back to **WebGL2** (`navigator.gpu` truthy but device init fails).

## Working style reminders (from CLAUDE.md / memories)

- Shader **phase gates are non-negotiable**: stop after each phase, show the diff, let the user run/eyeball. Phase B ends at Gate B.
- User co-writes TSL/shader code (Claude guides, user types) — but Phase B has no TSL.
- PR style: concise, lead with why; no Claude attribution; run prose through `superpowers:humanizer`; never push to main (PR branch).

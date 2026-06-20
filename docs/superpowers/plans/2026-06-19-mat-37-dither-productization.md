# MAT-37 — Productize output dithering (GitHub #46)

> Follow-up to the wide-gamut P3 spike. Turns the `LinearGradient`-only,
> always-on, linear-space dither into a proper **display-space, scene-wide
> output dither** that benefits every Matter-managed component.

## Decisions (locked with user, 2026-06-19)

- **Technique:** ordered **Bayer 8×8**, shader-only (no texture asset — keeps the
  registry copy-paste story clean and is deterministic/shimmer-free, which suits
  the static-scene render path). Blue-noise rejected for the texture-packaging
  tax; white-noise hash rejected as clumpy.
- **Coords:** per-pixel via `screenCoordinate` (like `filmGrain`), not `uv()`.
- **Placement:** the canonical application is a **final output stage in
  `ShaderScene`**, applied in **display-encoded space** (after the renderer's
  output transfer) so 1 LSB of noise maps to ~1 display step uniformly. The
  exported `dither()` **primitive** stays for **Mode 2** (user's own r3f canvas),
  where there is no Matter scene/post-process pipeline.
- **Gating:** **always-on, no toggle.** Banding hurts sRGB too; 1 LSB is
  imperceptible except where it helps; cost is one fullscreen pass.
- **Why a special final stage, not a `registerOverlay` pass:** the overlay
  reduce (`basePass → overlays → outputNode`) runs in **linear working space**;
  three applies the output transfer *after* `outputNode`. To dither in display
  space we set `postProcessing.outputColorTransform = false` and build
  `outputNode = dither(renderOutput(composed))`. `renderOutput` (three/tsl,
  0.170) applies tone mapping + output color-space conversion, picking up
  `toneMapping`/`outputColorSpace` from the context three sets when
  `outputColorTransform === false` (verified at three.webgpu.js:78058).

## Out of scope

- The creative `<Dither>` component (low-color/posterize, Lospec palettes) — a
  separate future deliverable. It may reuse the Bayer helper but is distinct.
- Float/HDR framebuffer (gated on a three bump; tracked separately).
- A `{ pattern, amount }` scene-level config object — easy future extension, not
  needed now.

---

## Phase 1 — Rewrite the `dither()` primitive (Bayer 8×8 + screenCoordinate)

**Files:** `packages/matter/src/primitives/dither/dither.ts`, `dither.test.ts`

- Replace `hash21` triangular-PDF noise with an ordered Bayer 8×8 threshold map
  built from `screenCoordinate.xy` (recursive `bayer2/4/8` helpers, values in
  `[0,1)`, centered to `[-0.5, 0.5)` and scaled by `amount`).
- New signature: `dither(color, amount = 1/255)` — drop the `coord` param
  (screen coords are read internally, matching `filmGrain`).
- Update docstring: remove the "linear-sRGB working space" caveat; note this is
  the per-shader/Mode-2 entry point and that the scene applies it in display
  space.
- Update tests for the new signature.

**Gate (stop & play):** `pnpm --filter @lovo/matter test` green; `pnpm typecheck`
green.

## Phase 2 — Wire the scene-wide display-space output dither

**Files:** `packages/matter-react/src/components/shader-scene/shader-scene.tsx`,
`registry/linear-gradient/shader.tsx`

- In `ShaderScene` `rebuildOutputNode`: keep the overlay reduce producing
  `composed` (linear), then set `postProcessing.outputColorTransform = false`
  and `postProcessing.outputNode = dither(renderOutput(composed))`.
- Import `renderOutput` from `three/tsl` and `dither` from `@lovo/matter`.
- Remove the per-component `dither(gradientColor, uv())` call from
  `LinearGradient` (now redundant; would double-dither). Restore
  `material.colorNode = gradientColor`.

**Gate (stop & play):** run the docs site; on `LinearGradient`, `Aurora`,
`MeshGradient`, `SimplexNoise` the banding is broken up uniformly (not just
LinearGradient). FilmGrain/Vignette overlays still look correct (their linear
pre-transform behavior is unchanged).

## Phase 3 — Visual-regression baselines

**Files:** `apps/docs-tests/visual/*`, baselines

- Relocating to display space + Bayer will likely exceed the 1-LSB screenshot
  tolerance. Run the visual suite, review diffs are only fine grain (no
  structural change), regen baselines.
- Update CLAUDE.md / MEMORY.md gotcha + milestone table; close #46 notes.

**Gate:** visual suite green against regenerated baselines; reviewed diffs are
grain-only.

---

## Outcome

- **Phase 1 ✅** — `dither()` rewritten to ordered Bayer 8×8 keyed on
  `screenCoordinate`, signature `dither(color, amount = 1/255)`. Tests/typecheck
  green.
- **Phase 2 ✅** — `ShaderScene` applies dither scene-wide in display space
  (`outputColorTransform = false` + `dither(renderOutput(composed))`); removed
  the per-component `dither()` from LinearGradient. User confirmed the look
  ("looks great") across components.
- **Also (separate concern, same branch):** removed the scene-level `gamut`
  control from the LinearGradient Tweakpane panel (a scene-level setting doesn't
  belong on a per-component panel; matches the dither rationale). The wide-gamut
  showcase stays on the dedicated gamut demos.
- **Phase 3 (in progress)** — macOS baselines regenerated natively; **Linux
  baselines pending a Docker run** (`pnpm snap`) — CI-gating, requires
  OrbStack/Docker. CLAUDE.md (gotcha #20 + milestone row) and MEMORY.md updated.
- **Decision:** shipped fully always-on, no toggle and no `<ShaderScene
  dither={false}>` escape hatch (user's call). The `{ pattern, amount }`
  scene-config object remains an easy future extension if needed.

# Poster single-source-of-truth (drift prevention) — design

**Date:** 2026-06-26
**Branch:** `hunter/mat-41-fix-issue-with-posters-lining-up-with-shader-starts` (folded onto the MAT-41 branch)
**Status:** Design approved, pending implementation plan
**Builds on:** `2026-06-26-mat-41-deterministic-shader-start-design.md` (the t=0 fix)

## Problem

The committed poster placeholder images (`apps/docs/public/posters/*`) are generated from hand-authored poster source files (`packages/matter-cli/posters/*.tsx`) that were written independently of the live demo pages (`apps/docs/src/app/components/*/page.tsx`). The two drifted, so a poster can show something the live shader's first frame does not.

Confirmed drift at the MAT-41 validation gate:

- **grain** — poster source rendered `<Grain intensity={0.45} speed={1}>`; the page's initial state is `intensity: 0.15, speed: 0.3`. The poster showed 3× the grain (and the heavy grain compounded into visible JPEG blocking + downscale aliasing — the "tiled" look). This is a **params** drift.
- **mesh-gradient** — poster source adds a `<Grain intensity={0.08}>` overlay; the live page renders no grain at all. This is a **tree** drift.
- aurora / simplex-noise / linear-gradient — currently consistent, but nothing structurally prevents future drift.

The CLI itself is not at fault: `matter poster --source <file>` faithfully renders whatever component the source module exports. The bug is that *our* poster sources are a second, hand-maintained copy of each demo's composition. (A user of the CLI avoids this by pointing `--source` at their real component / a shared config — the same principle this design applies to our own repo.)

## Goal

Make each poster render the **same scene composition at the same initial params** as its live demo page, with **one definition** shared by both — so neither params nor tree can drift again.

## Approach (chosen: shared scene module per component)

For each of the five components, introduce one co-located module that owns the demo's initial look, consumed by both the page and the poster.

### 1. Shared scene module — `apps/docs/src/app/components/<name>/scene.tsx`

Exports:

- `INITIAL` — the typed initial params object (relocated out of `page.tsx`).
- A scene component, **default-exported** (e.g. `LinearGradientScene`), rendering the exact `<ShaderScene>…shader children…</ShaderScene>` tree, with `params` defaulting to `INITIAL` so it renders standalone with no props. The **whole `<ShaderScene>` wrapper** is shared (including any `gamut`/`maxDPR` props the page sets), not just the children, so the wrapper can't drift either.

This is the single source of truth for the demo's tree + initial params — and it doubles as the poster's render target (it is literally the shader already on the docs site, factored out for reuse). The default export means the poster CLI needs no `--export-name`.

### 2. Pages consume the shared module

`page.tsx` imports `INITIAL` and `<XxxScene>`. Tweakpane is seeded from `INITIAL`; the live demo renders `<XxxScene params={tweakedParams} />`. The page keeps its existing chrome — the `<Image>` poster fallback sibling and the Tweakpane panel. The duplicated tree/params definitions leave `page.tsx`.

### 3. No separate poster entry files — point the CLI at the scene module

There are **no** dedicated poster source files. The build script points `--source` directly at each component's `scene.tsx`; the CLI renders its default-exported scene component at `INITIAL`. So the poster renders the same composition the page does, by construction — there is no second copy to drift. Delete the old `packages/matter-cli/posters/` directory entirely (referenced nowhere but the prior plan doc and ad-hoc command lines).

### 4. Regeneration script — `scripts/build-posters.sh` + root `pnpm posters`

A script that regenerates all five committed images directly from the docs scene modules:

- One invocation per poster, e.g.
  `node packages/matter-cli/dist/index.js poster --source apps/docs/src/app/components/<name>/scene.tsx --output apps/docs/public/posters/<name>.<ext> --format <png|jpg>`.
- Runs the CLI **once per poster, sequentially** — the poster server cannot be run concurrently in a tight loop (port/server collision observed during MAT-41).
- Correct format per component: `linear-gradient`→`.png`, `simplex-noise`→`.png`, `aurora`/`grain`/`mesh-gradient`→`.jpg`.
- Uses the CLI defaults (1280×720 @ DPR2 = 2560×1440) to preserve the existing asset dimensions.
- Requires the CLI to be built (`pnpm --filter @lovo/matter-cli build`) and Playwright chromium installed; the script should note/check this.

Also fix the stale flag names in `packages/matter-cli/README.md` examples: `--from`/`--out`/`--type` → `--source`/`--output`/`--format`.

### 5. Regenerate the committed posters

Run `pnpm posters`. Expected diffs:

- **mesh-gradient.jpg** — loses the grain overlay (now matches the grain-less live demo).
- **grain.jpg** — settles at the page's `INITIAL` (intensity 0.15, speed 0.3).
- **aurora.jpg / simplex-noise.png / linear-gradient.png** — should be unchanged (sources already matched), modulo the documented SwiftShader nondeterminism being absent (t=0 is deterministic post-MAT-41).

## Scope

All five components, including the three that currently match — so the SSOT pattern is uniform and none can silently drift later. Per-component work is mechanical: extract `scene.tsx`, repoint the page at it. The build script and the directory deletion are one-time, not per-component.

## Working-tree note

An in-progress quick fix from the MAT-41 gate is uncommitted in the working tree: `packages/matter-cli/posters/grain.tsx` edited to `0.15`/`0.3` and `apps/docs/public/posters/grain.jpg` regenerated. This refactor **supersedes** it — `packages/matter-cli/posters/` is deleted and all images are regenerated from the docs `scene.tsx` modules. No need to commit the quick fix separately; the first implementation task should start from the current working tree and let the extraction + regeneration subsume it.

## Non-goals

- No change to the `matter poster` CLI behavior or flags (only the README example text is corrected).
- Not touching the displayed code-snippet strings inside pages except where they are the same `INITIAL` source being relocated (illustrative snippets that show example props are out of scope unless trivially adjacent).
- The headless-SwiftShader vs real-GPU sub-pixel delta remains out of scope (per the MAT-41 spec).

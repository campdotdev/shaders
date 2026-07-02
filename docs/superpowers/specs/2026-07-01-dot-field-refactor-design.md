# Dot-Field Refactor — Design

**Date:** 2026-07-01
**Status:** Approved for planning

## Goal

Bring `<DotField>` up to the current component standard and change its identity from a
cursor-driven effect to a self-animating one. Three things:

1. **Modernize the pattern** — split the last single-file component into the standard
   wrapper + `shader.tsx` pair, destructure props inline with JSDoc + defaults, keep the
   `parseColor` color decode.
2. **Remove interactiveness** — delete all cursor plumbing and the cursor-distance
   displacement math. Interaction will return later as a separate, composable component,
   not a prop baked into this one.
3. **Keep it alive** — replace the cursor displacement with a self-driven **radial
   concentric ripple** driven by the scene clock (stone-in-a-pond).

`colorSpace` / `hueInterpolation` are explicitly **out of scope**: dot-field is a
single-color component, not an interpolating one (per the MAT-43 scope note). This matches
how MAT-5 excluded single-color components.

## Current state

- `registry/dot-field.tsx` is the only remaining single-file component. Every other
  component (aurora, vignette, grain, linear-gradient, mesh-gradient, simplex-noise, waves)
  uses a `directory/{name}.tsx` wrapper + `directory/shader.tsx` split, wired through the
  `exports` map in `registry/package.json`.
- The whole visual is cursor-driven: each cell computes distance to the cursor, an
  `influence` falloff (`reach`), and pushes its dot by `strength` along the direction to the
  cursor. Props `reach`, `strength`, `interactive`, and `inputs.cursor` exist only to feed
  this.
- **Uncommitted MAT-43 work is present on the current branch** (`hunter/mat-43-...`): the
  `parseColor` decode replacing `hexToVec3` in the component, the docs page switched to the
  wide-gamut color-plus picker, the docs params switched to an `oklch()` initial color, and
  regenerated poster + visual baselines. This is a finished, separate deliverable.

## Architecture — the split

Move `registry/dot-field.tsx` into `registry/dot-field/`:

| File | Responsibility |
| --- | --- |
| `registry/dot-field/dot-field.tsx` | Public wrapper — destructured props with defaults + JSDoc; forwards to `<DotFieldShader>`. |
| `registry/dot-field/shader.tsx` | Uniforms, TSL material build, mesh add/dispose lifecycle. |

Resolution changes are exact and minimal:

- `registry/package.json` `exports`: `"./dot-field": "./dot-field.tsx"` →
  `"./dot-field": "./dot-field/dot-field.tsx"`. No docs-side import changes needed —
  `@matter/registry/dot-field` keeps resolving through the exports map (consumed as source
  via `transpilePackages`).
- The `parseColor` import moves from `./utils/color` to `../utils/color` (now one level
  deeper, matching aurora).
- `registry/registry.json`'s `dot-field` entry updates from a single `file` to the
  directory form used by the other split components.

## Prop surface

| Prop | Before | After | Type | Meaning |
| --- | --- | --- | --- | --- |
| `spacing` | ✓ | ✓ | `AnimatableProp<number>` | grid cell size (px) |
| `dotSize` | ✓ | ✓ | `AnimatableProp<number>` | dot radius (px) |
| `color` | ✓ | ✓ | `string` | dot color — hex / `oklch()` / `oklab()` via `parseColor` |
| `reach` | ✓ | **removed** | — | cursor-only |
| `strength` | ✓ | **removed** | — | cursor-only |
| `interactive` | ✓ | **removed** | — | cursor-only |
| `inputs.cursor` | ✓ | **removed** | — | cursor-only |
| `speed` | — | **new** | `AnimatableProp<number>` | ripple travel speed |
| `amplitude` | — | **new** | `AnimatableProp<number>` | max radial displacement, as a **fraction of `spacing`** (≈0–0.9; default ≈0.4 to echo the old cursor feel) |
| `wavelength` | — | **new** | `AnimatableProp<number>` | distance between wave crests (px) |
| `decay` | — | **new** | `AnimatableProp<number>` | how quickly ripples fade with distance from `center`; `0` = uniform field (no decay), higher = faster fade |
| `center` | — | **new** | `[number, number]` | ripple origin in normalized UV; default `[0.5, 0.5]` |

`amplitude` is scale-invariant (fraction of spacing) so dots stay inside their cell
regardless of `spacing`. `useCursor`, `CursorSignal`, and the `inputs` object are dropped
entirely from the imports.

## The ripple math

The grid setup is unchanged (`pxUv`, `cellLocal`, `cellIndex`, `cellCenterUv`). Only the
displacement driver changes — the cursor block is replaced by a radial standing/traveling
wave keyed on distance from `center`:

```
cellToCenterPx = (cellCenterUv − center) · resolution
dist           = length(cellToCenterPx)
dir            = cellToCenterPx / (dist + ε)          // ε avoids div-by-zero at center
phase          = dist / wavelength − elapsedTime · speed
wave           = sin(phase · 2π)                       // −1..1
distNorm       = dist / (length(resolution) · 0.5)     // 0 at center → ~1 toward a corner
falloff        = exp(distNorm · decay · −1)            // 1 at center, fades outward; decay 0 ⇒ 1 everywhere
offset         = dir · wave · amplitude · falloff      // radial, cell-local units
displacedLocal = displace(cellLocal, offset)
```

`elapsedTime` is imported from `@lovo/matter` (same as aurora, used as
`elapsedTime.mul(speedUniform)`). The tail — `signedDistanceFieldCircle` → antialiased
`dotMask` → color mix → `vec4(dotColor, dotMask)` — is untouched. Normalizing the distance
against `length(resolution)` keeps the falloff shape scale-invariant. The exact falloff
curve (exponential above vs. a `smoothstep` band) is a feel-gate dial; `decay = 0` reduces
to the uniform endless-ripple field either way.

The stable-uniform pattern (Gotcha #17) holds: `speed`/`amplitude`/`wavelength`/`decay` push
through `uniform(...)` nodes; `center` routes through a `Vector2` uniform (like vignette's
`center`); `color` stays baked as literals (single, non-animated — material rebuild on
color change is acceptable, same as today).

## Demo + deterministic baselines

- `apps/docs/src/app/components/dot-field/scene.tsx`: drop `interactive`/`reach`/`strength`;
  pass `speed`/`amplitude`/`wavelength`/`center`.
- `params.ts`: remove `interactive`; add `speed`, `amplitude`, `wavelength`, `decay`,
  `centerX`, `centerY`. Keep the `oklch()` initial color from the MAT-43 WIP.
- `page.tsx`: remove the `interactive` toggle and `reach`/`strength` bindings; add
  `speed`/`amplitude`/`wavelength`/`decay`/`center` bindings. Keep the color-plus picker
  from the MAT-43 WIP.
- **dot-field becomes animated**, so its visual baseline must be captured at a fixed clock
  time. aurora/waves already snapshot deterministically through the existing
  `VisualTestPause` / `visualTestHooks` seam; dot-field joins them. The exact seek point is
  confirmed during planning. Poster + baselines regenerate.

## Working constraints

- **Shader files are co-written.** For `registry/dot-field/shader.tsx`, the assistant
  describes each chunk (concept + exact code + placement); the user types it. The assistant
  does not call Edit/Write on `shader.tsx`. Wrapper, demo scene, params, and page are
  edited directly.
- **Phase gates are non-negotiable.** Every phase ends at a runnable browser stop-and-play
  point; the user reacts before the next phase.
- No emojis. Conventional Commits (scope without `@lovo/`). Never push to main — PR branch.
  No Claude attribution. Destructure props inline with defaults. Clear names over
  abbreviations. TypeScript strict + `verbatimModuleSyntax` (`import type`). YAGNI.

## Branch / PR plan

Two clean PRs:

1. **MAT-43 decode fix** — commit the finished uncommitted work (component `parseColor`
   decode, docs color-plus picker, `oklch()` initial, regenerated poster/baselines) on the
   current `hunter/mat-43-...` branch as its own PR.
2. **dot-field refactor** — cut a fresh branch off that commit; do the split + interaction
   removal + ripple here.

## Out of scope (firm)

- `colorSpace` / `hueInterpolation` — single-color component.
- Shared hook extraction (`useColorUniform`, aspect-uniform, etc.) — every component inlines
  these today; cross-component refactor is not what was asked.
- Multiple ripple sources or any non-radial wave geometry — not now. (Distance decay **is**
  in scope, via the `decay` prop above.)
- The separate "interaction" component that will eventually drive displacement — future work,
  not this refactor.

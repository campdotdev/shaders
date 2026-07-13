# Aurora raymarched rebuild — design

**Issue:** MAT-46 · **Branch:** `hunter/mat-46-make-the-aurora-more-realistic`
**Status:** Implemented 2026-07-09 on the branch above (plan: `docs/superpowers/plans/2026-07-08-aurora-raymarch-rebuild.md`).

## Problem

The current Aurora sums N independent 2D-noise drapes. Even after the
premultiplied-alpha fix (MAT-45) and the natural-palette defaults, it reads as
"solid" — painted shapes rather than a veil of light. Root causes: one noise
octave per layer (no filament structure), a linear field with a hard zero
clamp (no long soft tails), opacity locked 1:1 to brightness, and no vertical
brightness profile. Rather than patch each, we rebuild the shader as a
raymarched volume, which produces all four properties inherently.

## Goals

- Aurora reads as translucent light: soft edges, wispy filaments, brightness
  concentrated at the lower border of curtains, long fades upward.
- Sky-band composition: ribbons occupy the upper region and recede toward a
  horizon with real parallax between near and far curtains. The lower region
  stays clear — natural space for hero content when used as a site background.
- Remains a clean transparent layer (premultiplied output, no opaque base).
- The rebuild doubles as a raymarching/TSL learning exercise, co-written per
  the shader rebuild process (Claude guides, user types the shader code).

## Non-goals / constraints

- No bloom or glow pass — that stays a separate deferred effect.
- No opaque sky/background — backdrop remains the consumer's job.
- No per-component dither/gamut handling (scene-level concerns).
- Registry file split stays: `aurora.tsx` wrapper + `shader.tsx` TSL graph.

## Public API (breaking; ships as v0.5.0)

```ts
interface AuroraProps {
  stops?: ColorStop[];  // altitude ramp, low → high; { color: string; position?: number }
  intensity?: AnimatableProp<number>;
  speed?: AnimatableProp<number>;
  drift?: AnimatableProp<number>;      // horizontal ribbon drift
  turbulence?: AnimatableProp<number>; // noise warp amount
  density?: AnimatableProp<number>;    // ribbon frequency
  falloff?: AnimatableProp<number>;    // vertical extent/fade of the band
  direction?: 'bottom' | 'top' | 'left' | 'right'; // edge the horizon sits on
  colorSpace?: ColorSpace;             // default 'oklab'
  hueInterpolation?: HueInterpolation; // default 'shorter'
}
```

Changes from the current API:

- `layers: AuroraLayer[]` is **removed**. Ribbon multiplicity comes from the
  march; color variety comes from the altitude ramp.
- `stops` follows the LinearGradient convention exactly (`ColorStop[]` from
  `registry/utils/color`, converted via `toColorRampStops`, wide-gamut input
  via `parseColor`). Default ramp: `palette.green.base` → `palette.teal.base`
  → `palette.sky.light` → `palette.magenta.light` — the physical emission
  order (oxygen green low, ionized blue high, pink fringe).
- `colorSpace`/`hueInterpolation` are added, matching the MAT-43 rule that
  interpolating components carry them — the altitude ramp makes Aurora an
  interpolating component. Both pass straight through to `colorRamp`.
- `driftX`/`driftY` collapse to `drift` and `densityX`/`densityY` to
  `density`. In a horizon composition only motion along the band and ribbon
  frequency are meaningful.

Color count and ramp positions are structural (baked literals, material
rebuild on change), consistent with `colorRamp` and gotcha 17's exception.
Continuous params flow through stable uniforms — no rebuild on drag.

## Output contract

Unchanged from MAT-45: `rgb` = accumulated emission (may exceed 1),
`alpha` = accumulated coverage clamped to [0, 1],
`material.transparent = true`, `material.premultipliedAlpha = true`. The
march accumulates coverage more slowly than emission, so bright cores stay
translucent — opacity is decoupled from brightness by construction.

## Architecture

- `registry/aurora/shader.tsx` — full rewrite. Camera/ray setup for the
  chosen `direction`, TSL `Loop` for the march, triangle-noise FBM helper
  (local to the shader; promoting it to a Tier 2 engine primitive is out of
  scope for MAT-46), altitude ramp, premultiplied output. Uniform-vs-structural split per gotcha 17.
- `registry/aurora/aurora.tsx` — wrapper: new props, defaults, color parsing.
- `apps/docs/src/app/components/aurora/*` — demo rework: color rows with
  add/remove (color-plus picker, oklch-format initial values, formatLocked),
  sliders for the continuous props, steps binding during development.
- Step count starts as a tuned constant, Tweakpane-bound while developing so
  the quality/cost curve is feel-able. Whether it becomes a prop is decided in
  the final phase, not up front.

## Performance

Raymarching is the most expensive shader in the catalog so far: cost ≈ steps ×
noise samples per step. Budget check happens on the docs page during the tune
phase (frame time at fullscreen on the dev machine, plus a sanity check at a
laptop-class GPU if available). Escape hatches if needed, in order: lower step
count, cheaper noise, early-out when accumulated coverage saturates.

## Testing

Per project convention: no GPU unit tests. Validation is the docs demo at
every phase gate plus Playwright visual baselines regenerated at the end
(`pnpm snap`, pinned Node 22, Docker). The poster image
(`apps/docs/public/posters/aurora.jpg`) is regenerated with the baselines.

## Rollout

- Changeset: minor bump (pre-1.0 breaking convention), notes calling out the
  removed `layers` prop and the `colors`/`stops` replacement.
- CLI copy-paste consumers get the new files wholesale; no migration path
  needed beyond the changelog note.

## Open questions (deliberately deferred)

- **`drift` naming** — the user found `driftX`/`driftY` unclear in the old
  shader and may rename `drift` once its visual effect is feel-able in the
  rebuilt version. Revisit at the wrapper/API phase gate.
- **`steps` as a public prop** — decided at the final tune phase.

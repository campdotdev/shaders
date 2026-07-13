# Aurora reference rebuild (MAT-48) — design

**Date:** 2026-07-12
**Status:** Implemented 2026-07-12 on the branch below (plan: `docs/superpowers/plans/2026-07-12-aurora-reference-rebuild.md`).
**Branch:** `hunter/mat-48-rework-aurora`

## Goal

Rebuild `registry/aurora/shader.tsx` from scratch following the structure of
the ShaderToy aurora the user supplied (see License constraint and
Appendix A for provenance), then productize it back into a Matter Tier 1
component. The
MAT-46 shader is discarded — it shares ancestry with the same reference but
diverged in the places that make the reference look alive.

### Why redo it

Diagnosed gaps in the current (MAT-46) aurora versus the reference:

1. **Color is flat.** Reference colors each raymarch slice by *slice index*
   through a cycling sin palette, so ribbons at different depths glow
   different hues. Current version ramps color by altitude only — every
   ribbon carries the same vertical gradient.
2. **Banding.** Current sin-dot hash plus 40 steps plus a hard 0.55 field
   clamp produce visible slice/contour banding. Reference uses a
   fract-dot hash, 60 steps, and ramped per-pixel jitter.
3. **Motion.** Reference rotates the whole fbm domain a little every octave
   (`p *= mm2(time * 0.01)`), giving smooth continuous evolution. Current
   version uses a static rotation.
4. **Prop bloat.** `drift` and `direction` (né `horizon`) no longer earn
   their place. `falloff` was doing something its name didn't say.

## Decisions (from brainstorm)

| Question | Decision |
| --- | --- |
| Keep user color control? | Yes — `stops` ramp stays, but indexed on **slice depth**, not altitude |
| Ramp wraps (cycles) or runs once across depth? | Deferred to Phase 4 gate — one-line toggle, decide by eye |
| Prop roster | `stops`, `intensity`, `speed`, `turbulence`, `density`, `falloff`, `colorSpace`, `hueInterpolation` |
| Dropped props | `drift`, `direction` — breaking change, noted in changelog |
| `falloff` semantics | Horizon fade steepness. High = tight fade at band bottom; 0 = no cut, aurora fills canvas. Fade must stay soft and ride the ribbon shapes — never read as a screen-space line |
| Background | Component stays a transparent premultiplied overlay. Reference's sky gradient lives only on the demo page as a page background |
| Build strategy | Reference-shaped, two-stage: rebuild the reference's structure (opaque, sin palette, literal starting constants), A/B against ShaderToy expecting "close, not pixel-identical", then productize one gate at a time |
| Execution mode | Co-write: the user types `shader.tsx` chunk-by-chunk; Claude explains and guides, and does not Edit/Write shader files |
| License stance | Technique reference only (see License constraint below) — original TSL expression, constants as starting values re-tuned at gates, inspiration credit in the file header, no verbatim-port claim |

## License constraint

nimitz's "Auroras" (ShaderToy `XtGGRt`) is CC BY-NC-SA 3.0, and the
user-supplied variant inherits that license. Matter cannot ship
CC BY-NC-SA-derived code: the NC clause conflicts with any commercial use of
`@lovo/matter`, and the SA clause would contaminate every consumer app the
CLI copies the component into. The MAT-46 rebuild already established the
stance and this rebuild keeps it:

- The reference is used as a **technique reference** — the raymarch
  structure, triangle-noise fbm idea, and average-then-accumulate trick are
  uncopyrightable techniques.
- All TSL is written as original expression. Constants from the reference
  are treated as starting values and re-tuned by eye at the phase gates;
  shipped values are ours.
- The shader file header carries an inspiration credit naming nimitz's
  Auroras. No verbatim-port claim is made anywhere.
- The reference GLSL itself is not committed to the repository (Appendix A
  is a structural description, not a transcription).

## Public API

Files keep their current shape: `registry/aurora/aurora.tsx` (wrapper with
destructured defaults) + `registry/aurora/shader.tsx` (TSL, rewritten from
empty). Demo page and Tweakpane panel updated to match.

```ts
export interface AuroraProps {
  stops?: ColorStop[];                 // depth-indexed color ramp, brand-palette default
  intensity?: AnimatableProp<number>;  // output gain
  speed?: AnimatableProp<number>;      // time multiplier (warp rotation + per-octave rotation)
  turbulence?: AnimatableProp<number>; // warp strength, multiplier around reference's dg * 0.75
  density?: AnimatableProp<number>;    // field gain, multiplier around reference's rz * 20
  falloff?: AnimatableProp<number>;    // horizon fade steepness; 0 = fills canvas
  colorSpace?: ColorSpace;             // ramp mixing space, default 'oklab'
  hueInterpolation?: HueInterpolation; // default 'shorter'
}
```

Every numeric prop is a multiplier (or normalized dial) around the reference
literal so that the default value reproduces the reference feel.

## Shader structure

### Stage 1 — reference-shaped port (opaque)

Five co-write blocks matching the reference's structure. Numeric values named
below are starting points, re-tuned at gates per the license stance:

1. **Helpers.**
   - `hashNoise(vec2)` — the reference's fract-dot hash (replaces the old
     sin-dot hash; half of the banding fix).
   - `rotate2d(angle)` — the reference's `mm2`, via TSL `mat2`.
   - `triangleWave(x)` = `abs(fract(x) - 0.5)`; `triangleWave2(p)` the vec2
     composite.
2. **`auroraField(p, warpSpeed)`** — 5-octave triangle-noise fbm:
   - initial domain bend `p *= rotate2d(p.x * 0.06)`;
   - per octave: warp offset `dg = triangleWave2(bp * 1.85) * 0.75` rotated
     by `time * warpSpeed`, applied `p -= dg / z2`; lacunarity/gain ladder
     (`bp *= 1.3`, `z2 *= 0.45`, `z *= 0.42`, `p *= 1.21 + (rz - 1) * 0.02`);
     ridge accumulation `rz += tri(p.x + tri(p.y)) * z`; and the whole-domain
     rotation `p *= rotate2d(time * 0.01)` (the smooth-motion ingredient).
   - output `clamp(1 / pow(rz * 20, 1.3), 0, 1)`.
   - Written as an unrolled JS `for` loop — 5 fixed iterations, compile-time.
3. **Raymarch** — 60 slices via TSL `Loop`, running `avgColor`/`accumColor`
   vec4 accumulators:
   - per-pixel jitter `0.006 * hashNoise(screenCoordinate) * smoothstep(0, 15, i)`
     subtracted from slice distance (other half of the banding fix; the
     scene-wide Bayer dither then swallows the residue);
   - slice distance `pt = (0.8 + pow(i, 1.4) * 0.002) / (rd.y * 2 + 0.4)`;
   - sample point `bpos = 5.5 + pt * rd`, field sampled on `bpos.zx`;
   - slice color `sin(1 - vec3(2.15, -0.5, 1.2) + i * 0.043) * 0.5 + 0.5`,
     scaled by the field value;
   - `avg = mix(avg, sliceColor, 0.5)`;
     `accum += avg * exp2(-i * 0.065 - 2.5) * smoothstep(0, 5, i)`.
   - post-loop: `accum *= clamp(rd.y * 15 + 0.4, 0, 1)` (the falloff seed).
4. **Ray setup** — `rd = normalize(vec3(ndc.xy, 1.064))` with the aspect
   correction pattern from the current shader so wide canvases don't stretch.
5. **Stage-1-only output** — opaque composite exactly like the reference:
   sky gradient `mix(vec3(0.006, 0.026, 0.095), vec3(0.007, 0.011, 0.035), uv.y)`
   plus aurora RGB, then `smoothstep(0, 1.1, pow(col, 1) * 1.5)` shaping.
   Gamma handling adapted to our pipeline: the reference hand-rolls
   `pow(col, 1/2.2)` because ShaderToy outputs raw; in Matter the
   working→output transform belongs to the scene's output pass, so the port
   must not double-encode. Exists solely to A/B against ShaderToy; deleted in
   stage 2.

All constants stay literal in stage 1 — no uniforms, no props.

### Stage 2 — productize

1. **Transparency swap.** Delete the sky mix. Output aurora RGB with
   luminance-derived alpha, `material.premultipliedAlpha = true` (MAT-45
   lesson: straight-vs-premultiplied double-multiply kills vibrancy).
   Reference shaping (`smoothstep(0, 1.1, col * 1.5)`) applies to RGB before
   alpha derivation. Demo page paints the dark sky gradient as its own
   background so the A/B still reads.
2. **Slice-indexed color ramp.** Replace the sin palette with
   `colorRamp(sliceProgress, stops)` mixed in `colorSpace`/`hueInterpolation`.
   `sliceProgress` = normalized slice index; wrap-vs-once decided at this
   gate (`fract(i * freq)` vs `i / 60`). Default stops chosen from the brand
   OKLCH palette to mimic the reference's green→teal→purple stratification.
   Gotcha #17 caveat: `colorRamp` bakes stop literals, so `stops` changes
   rebuild the material — acceptable, same as every other ramp component.
3. **Props → uniforms.** `intensity`, `speed`, `turbulence`, `density`,
   `falloff` flow through stable `uniform(...)` nodes (gotcha #17 pattern —
   no material rebuild on Tweakpane drag). Falloff maps to the
   `clamp(rd.y * k + 0.4)` steepness plus whatever soft shaping the gate
   demands to keep the bottom edge organic.
4. **Wrapper + demo + Tweakpane.** New `AuroraProps` with destructured
   defaults, drift/direction rows removed from the panel, color bindings via
   color-plus with oklch()-format initial values (standing preference).
   Defaults tuned by eye at the final gate.

## Phases (each ends runnable, gate after every one)

| # | Phase | Gate |
| --- | --- | --- |
| 1 | Helpers + `auroraField` visualized flat (grayscale plane) | See curtain filaments, feel warp motion; tri-noise fbm + domain warp explained |
| 2 | Ray setup + 60-slice march + sin palette + sky (full reference-shaped output) | Browser vs ShaderToy side-by-side (expect close, not pixel-identical); banding check |
| 3 | Transparency swap | Same vibrancy over demo background; stacks over other shaders |
| 4 | Slice-indexed color ramp | Wrap-vs-once decision; default stops picked |
| 5 | Props → uniforms + falloff shaping | Drag every dial; falloff edge organic at extremes |
| 6 | Wrapper + demo + Tweakpane + tuned defaults | Final play/tune; ship prep |

## Verification

- No unit tests for the visual (project convention — no meaningful unit test
  for "does this aurora look right").
- Playwright visual baselines are invalidated; regenerate at the end via
  `pnpm snap` on Node 22 in Docker.
- Deterministic shader start (MAT-41) must keep working — same time-uniform
  pattern as the rest of the registry.
- Registry sources are transpiled by the docs site (`transpilePackages`), so
  shader edits hot-reload; only engine (`@lovo/matter*`) edits would need a
  `pnpm --filter` rebuild (none expected).
- CI: `pnpm format:check` before push; lockfile committed if deps change
  (none expected); all work on the PR branch, never main.

## Out of scope

- Horizon variance / per-ribbon vibrancy experiments (the aurora-organic
  seed) — this rebuild replaces that direction; revisit only if the finished
  port still wants it.
- New engine primitives. Everything lives in `registry/aurora/`.
- Any other component.

## Appendix A — reference structure (description, not a transcription)

The user-supplied reference (kept out of the repo per the license
constraint; it lives in the brainstorm conversation) is a modified
derivative of nimitz's "Auroras" (`XtGGRt`). Its structure, which stage 1
mirrors:

- **Hash:** a fract-dot construction (the common "hash without sine"
  pattern) seeded from the pixel coordinate; used only for per-pixel march
  jitter.
- **Triangle noise:** `tri(x) = abs(fract(x) - 0.5)` plus a vec2 composite
  that cross-feeds the two axes.
- **fbm:** 5 octaves. An initial rotation proportional to `p.x` bends the
  domain; each octave computes a triangle-wave warp vector from a scaled
  copy of the domain, rotates that warp by `time × warpSpeed`, subtracts it,
  advances a lacunarity/gain ladder, accumulates a ridge term, and finally
  rotates the whole domain by a small time-proportional angle (the
  smooth-drift ingredient). Output is a clamped reciprocal power of the
  ridge sum, concentrating brightness into filaments.
- **March:** 60 slices. Slice distance grows super-linearly with slice
  index and is divided by a linear function of `rd.y` (band placement /
  fake curvature); a hash jitter ramps in over the first ~15 slices. The
  field is sampled on the horizontal (`z, x`) plane at each slice.
- **Color:** per-slice RGB from a sinusoidal palette phased by slice index
  (the depth-stratified hue cycling), scaled by the field value; slices are
  blended into a running average before accumulation under an `exp2`
  extinction weight, with the first few slices smoothstep-suppressed.
- **Output:** horizon clamp on `rd.y`, composite onto a dark vertical sky
  gradient, hand gamma (1/2.2), final smoothstep shaping.

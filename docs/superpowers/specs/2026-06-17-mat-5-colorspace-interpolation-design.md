# Color-space interpolation (MAT-5) — design

**Date:** 2026-06-17
**Status:** Approved (brainstorming), pending implementation plan
**Branch:** `hunter/mat-5-support-colorspace-prop-across-registry-components`

## Motivation

Matter's color blending is currently naive per-channel linear interpolation on raw
gamma-encoded sRGB values, with no color-space awareness, in two code paths:

- `colorRamp` (engine primitive) — used by `<LinearGradient>` and `<SimplexNoise>`.
- Direct `mix()` calls — `<MeshGradient>`, `<Aurora>`, `<Waves>`.

Verified 2026-06-16 (three source analysis + Playwright pixel readback of the
LinearGradient baseline): `parseHex` returns `hex/255` (gamma-encoded sRGB digits),
these are assigned to `material.colorNode`, three treats them as **linear
working-space** values, and re-encodes them linear→sRGB on output. Net effect: every
color renders **lighter** than its hex (`OETF(hex/255)`), and the blend curve is a
gamma-digit lerp pushed through a second encode — neither proper linear-light
interpolation nor clean sRGB-digit interpolation. It is a double-encode hybrid.

This feature adds a `colorSpace` prop that controls the **interpolation space** for
blending colors, and fixes the foundation so the perceptual spaces are mathematically
correct. It is orthogonal to the planned `gamut` feature (output color gamut on
`MatterScene`), which is out of scope here.

## Goals

- Let each multi-color component blend in a chosen color space.
- Make perceptual interpolation (OKLab default) correct, which requires a correct
  linear-sRGB foundation.
- Keep the public API small and the conversion math in one place.

## Decisions (settled during brainstorming)

1. **Fix the foundation.** Decode hex→linear so colors render true and conversions are
   correct. This is a deliberate, baseline-breaking pre-1.0 migration.
2. **Default space: `oklab`.** Perceptually uniform; no muddy gray midpoints, no
   over-bright linear-light midpoints. Matches CSS Color 4's gradient default.
3. **Scope: all multi-color components** — LinearGradient, SimplexNoise, MeshGradient,
   Aurora, Waves. Single-color overlays (Vignette, FilmGrain, DotField) are excluded.
4. **Architecture: a single `mixColor` primitive** with per-space conversions as
   composable internals (chosen over exposing raw conversion pairs everywhere).

## Public API

```ts
type ColorSpace = 'linear' | 'oklab' | 'oklch' | 'lch' | 'hsl' | 'hsv';
```

- New optional prop on each of the five components: `colorSpace?: ColorSpace`,
  **default `'oklab'`**. Example: `<LinearGradient colorSpace="oklab" />`.
- `colorSpace` is a **structural / rebuild prop**, not a uniform. Changing it rebuilds
  the material (it swaps which conversion math is in the TSL graph). This is acceptable
  because it is not driven at interactive frequency — same class as `colors`/`stops`,
  which already rebuild (see CLAUDE.md gotcha #17 and the deferred-rebuild memory). It
  joins the existing material-rebuild dep arrays.
- **Public exports:** `ColorSpace` (type), `mixColor`, and `colorRamp`'s new
  `colorSpace` parameter.
- **Internal (not exported):** the individual `linearToOklab`/`oklabToLinear`/etc.
  conversion functions. They are structured as clean standalone modules so promoting
  them to public later (if a recipe needs in-space manipulation) is a zero-cost minor
  release.

## Engine primitives (`@lovo/matter`)

The working representation entering every shader is **linear-sRGB**. Each space
converts from there and back.

### Conversion pairs (TSL, vec3 → vec3, internal)

One function per direction:

- `linearToOklab` / `oklabToLinear`
- `linearToOklch` / `oklchToLinear`
- `linearToLch` / `lchToLinear`
- `linearToHsl` / `hslToLinear`
- `linearToHsv` / `hsvToLinear`
- `linear` is the identity (no conversion).

Conversion specifics:

- **OKLab** (Björn Ottosson's transform). linear sRGB → LMS → cube-root → OKLab:
  - linear→LMS:
    `l = 0.4122214708·r + 0.5363325363·g + 0.0514459929·b`,
    `m = 0.2119034982·r + 0.6806995451·g + 0.1073969566·b`,
    `s = 0.0883024619·r + 0.2817188376·g + 0.6299787005·b`
  - `l_ = cbrt(l)`, `m_ = cbrt(m)`, `s_ = cbrt(s)`
  - LMS_→OKLab:
    `L = 0.2104542553·l_ + 0.7936177850·m_ − 0.0040720468·s_`,
    `a = 1.9779984951·l_ − 2.4285922050·m_ + 0.4505937099·s_`,
    `b = 0.0259040371·l_ + 0.7827717662·m_ − 0.8086757660·s_`
  - Inverse uses the standard inverse matrices and `^3` nonlinearity.
- **OKLch** = OKLab in cylindrical form: `L` unchanged, `C = length(a, b)`,
  `h = atan(b, a)`. Inverse: `a = C·cos(h)`, `b = C·sin(h)`, then OKLab→linear.
- **LCH** = CIELAB LCh: linear sRGB → CIE XYZ (sRGB D65 matrix) → CIELAB (standard
  `f(t)` nonlinearity, D65 white) → polar `LCh`. Inverse reverses each step.
- **HSL / HSV operate on gamma sRGB, not linear** (this is how they are defined and how
  CSS interpolates them). Path: linear → gamma sRGB (sRGB OETF) → HSL/HSV → lerp →
  HSL/HSV → gamma sRGB → linear (sRGB EOTF). Standard HSL/HSV formulas.

### Shortest-arc hue

Cylindrical spaces (`oklch`, `lch`, `hsl`, `hsv`) interpolate hue along the **shorter
arc** (CSS Color 4 default). For hue in degrees:
`dh = mod(h2 − h1 + 180, 360) − 180; h = h1 + t·dh` (with mod handling for negatives).
Rectangular spaces (`linear`, `oklab`, and the Lab forms before going polar) lerp
components directly.

### `mixColor(colorA, colorB, t, colorSpace)`

Pairwise blend: convert both endpoints into `colorSpace`, lerp (shortest-arc hue for
cylindrical), convert back to linear-sRGB. Returns a linear vec3 node. Used by the
direct-`mix()` components (MeshGradient, Aurora, Waves).

### `colorRamp(t, stops, colorSpace = 'oklab')`

Rebuilt to: convert stops into `colorSpace`, run the existing nested-mix chain
**in-space** (shortest-arc hue per segment), and convert the result back to linear-sRGB
**once at the end** — one inverse conversion per pixel instead of one round-trip per
segment. The nested-mix structure already collapses to clean pairwise interpolation
between adjacent stops (verified), which holds in cylindrical space too because at each
segment boundary the running result equals the previous stop exactly. Used by
LinearGradient and SimplexNoise. Default `'oklab'` matches the component default.

### Gamut

OKLch/LCH interpolation can produce colors outside the sRGB gamut (high chroma). On
convert-back to linear-sRGB we **clip to [0, 1]** for v1. Proper gamut mapping is out of
scope (known limitation; relates to the future `gamut` feature).

## The foundation fix

`parseHex` currently returns gamma-sRGB digits (`hex/255`). Add an sRGB→linear decode so
colors enter the shader graph as **linear-sRGB**, done once on the CPU (the values are
constants). This single change makes solid colors render true *and* makes every space's
conversion correct.

Audit all color entry points so there is **one decode path**: the shared
`registry/utils/color.ts` (`parseHex` / `toColorRampStops` / `useColorUniform`) plus any
per-component color parsing in Aurora and Waves.

## Per-component rollout (phased; each phase ends at a runnable, observable gate)

1. **Engine primitives** — conversion functions + `mixColor` + `colorRamp` colorSpace
   param + `ColorSpace` type. No app change yet.
   *Gate:* a color-space probe page renders flat swatches per space; a Playwright test
   samples pixels against reference values (round-trip identity + known OKLab/CSS refs).
2. **Foundation fix + palette verification** — decode hex→linear across the board;
   regenerate all baselines once. Everything now renders true color (and incidentally
   does linear-light blending). *Gate:* run the dev server, confirm the truer colors
   look right; **re-tune the palette only if something looks off** (likely a no-op,
   since the palette was designed in OKLCH as true colors). This is the one place any
   color-eye work happens.
3. **LinearGradient** — add `colorSpace` prop (default `oklab`), wire to `colorRamp`.
   Only the midpoint *path* changes vs phase 2; stop colors are unchanged. *Gate:*
   eyeball each space in Tweakpane.
4. **SimplexNoise** — add `colorSpace` prop (via `colorRamp`). Regenerate baseline.
5. **MeshGradient** — swap `mix()` calls for `mixColor`; add `colorSpace` prop.
   Regenerate baseline.
6. **Aurora** — same. Regenerate baseline.
7. **Waves** — same. Regenerate baseline.
8. **Docs + version** — `colorSpace` control in each Tweakpane panel, primitive docs for
   `mixColor`, changeset (breaking color change → minor bump pre-1.0).

Because `oklab` vs `linear` changes only the path *between* stops (not the endpoint
colors), palette tuning is genuinely a one-time concern in phase 2.

## Testing / validation

- **Conversion correctness:** a reusable probe page renders known colors through each
  space; a Playwright test samples pixels and checks against reference values
  (Ottosson OKLab references, CSS Color 4 examples). Round-trip identity
  (`linear → space → linear`) is checked too. Same pixel-readback method used to verify
  the double-encode.
- **Visual regression:** baselines regenerate per the phasing above (darwin + linux
  variants).
- Consistent with the project convention: shader "tests" are docs demos + Playwright
  visual regression; we do not evaluate TSL math on the CPU.

## Out of scope (firm)

- The `gamut` / Display-P3 output feature (separate, on `MatterScene`; orthogonal).
- A gamma-sRGB interpolation mode (not among the six requested spaces; add later only if
  CSS-parity is wanted).
- Single-color overlays: Vignette, FilmGrain, DotField.
- Proper out-of-gamut mapping (we clip).

## Migration / versioning

- Breaking color change (appearance shifts on all five components). Pre-1.0, so a
  **minor** version bump via changeset.
- Registry components are copy-paste delivered, so existing user copies are unaffected
  until re-copied.

## Known limitations

- Out-of-gamut colors from OKLch/LCH interpolation are clipped, not gamut-mapped.
- HSL/HSV are included for completeness; they are not perceptually uniform and are
  rarely the best choice for gradients.

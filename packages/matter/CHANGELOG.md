# @lovo/matter

## 3.8.0

### Minor Changes

- c6b672a: Add the `metaballs` primitive: a summed metaball field over up to 20 blob centers roaming the origin on hash-phased sine paths. Returns the field strength (threshold it for gooey merged silhouettes) and a field-weighted per-blob blend value for color ramps. Count (fractional counts grow the last blob in smoothly), size, size variation, spread, time, and seed all accept TSL nodes, so every dial can ride a uniform.

## 3.7.0

### Minor Changes

- 152c14b: Widen `fractalNoise` with turbulence folding and live gain: a new `fold` option ('none' | 'smooth' | 'sharp') — 'smooth' and 'sharp' fold each octave with abs() before summing, squared for soft billows or square-rooted for crisp veins, while 'none' keeps the raw signed noise — and `gain` now also accepts a TSL node, computing per-octave amplitude as pow(gain, i) on the GPU so a uniform-driven detail dial glides without rebuilding the material. Folded output is normalized to roughly 0..1 ('none' stays roughly -1..1).

## 3.6.0

### Minor Changes

- 0a26708: Add `voronoiCells`: the two-pass cell Voronoi (Inigo Quilez's ldl3W8) as a Tier 2 primitive. It returns three fields per pixel: `edgeDistance` (exact distance to the nearest cell border, via perpendicular bisectors, which is what makes constant-width borders possible), `seedOffset` (vector to the cell's seed), and `hash` (a stable per-cell random for coloring). Options animate the field: `time` is a pre-integrated phase, `jitter` scatters seed anchors off the grid, and `drift` orbits each seed within the room its cell offers, so the 3x3 neighbor search stays valid at any amplitude. The sibling distance-only `voronoi` (Worley) primitive is unchanged.

## 3.5.0

### Minor Changes

- 4e3feab: Add ditherThreshold, a single entry point for ordered-dither threshold maps: Bayer 2x2/4x4/8x8, halftone dots and lines, white noise, interleaved gradient noise, and a precomputed 64x64 blue-noise tile. The anti-banding dither() now builds on it. quantize() accepts a node for its step count (so a level count can ride a uniform) and an optional threshold argument that replaces the 0.5 rounding point. Passing a threshold map there turns a plain posterize into ordered dithering, which is how the Dither registry component uses the pair.

## 3.4.0

### Minor Changes

- 263403e: Add a phase-reset channel to `FrameScheduler`: accumulators register a listener with `onPhaseReset()`, and `resetPhases()` rewinds them all to zero. Accumulated phase is wall-clock history, so a harness that needs a reproducible frame (like the docs visual tests) has to rewind it together with the renderer clock. `useAnimatableSpeed` registers its phase uniform on the channel, which is what keeps a quantized shader like grain rendering the same seed on every machine.

## 3.3.0

## 3.2.1

## 3.2.0

### Minor Changes

- dd8f99b: Adds `@lovo/matter/color`, a second entry point for the CPU-side color math: `parseColorString`, the OKLab and OKLCH conversions, the gamut helpers, and the sRGB transfer functions. The root entry still exports all of them, so nothing has to move. The difference is that the subpath has no path to three, so it can be imported during a server render. The root entry cannot, because it reaches the renderer and `three/webgpu` reads `self` at module load.

  `parseColorString` now throws on input it used to mangle. Components that aren't numbers ran through `parseFloat` to NaN and came back as `[NaN, NaN, NaN]`, which reached the GPU as a blank shader with a clean console. Hex is checked for format now too: it takes `#rrggbb` and `#rrggbbaa` (alpha parsed and dropped, the same way `oklch()` and `oklab()` already handle it) and throws on anything else. `#abcdefgh` used to slice its first six digits and return a confidently wrong color.

## 3.1.0

## 3.0.0

## 2.0.0

### Major Changes

- 945657f: Rework the `<Vignette>` component. Its props are renamed for clarity — `radius` is now `falloff` and `softness` is now `feather` — and the overlay blend gains `colorSpace` (default `oklab`) and `hueInterpolation` (default `shorter`), so the vignette can darken and tint in a chosen perceptual space rather than only in linear space. Defaults shift to `intensity` 0.3, `feather` 0.6, and a dark wide-gamut `oklch()` color.

  This is a breaking change for anyone using `radius` or `softness`, or relying on the previous linear default blend.

## 1.0.0

### Major Changes

- 8d9d4ad: Rename the `filmGrain` primitive to `grain`.

  The `filmGrain(intensity, timeOffset?)` primitive is now exported as `grain` with
  an identical signature and behavior. The Tier 1 `<FilmGrain>` component (delivered
  via the CLI) is likewise renamed to `<Grain>`, and its `film-grain` registry slug
  is now `grain`.

  **Migration:** one-pass find-and-replace.

  ```ts
  // Before
  import { filmGrain } from '@lovo/matter';
  const g = filmGrain(0.08);

  // After
  import { grain } from '@lovo/matter';
  const g = grain(0.08);
  ```

## 0.6.0

### Minor Changes

- 24ec05d: Add color-space-aware interpolation. `colorRamp` and the new `mixColor` primitive
  accept `colorSpace` ('linear' | 'oklab' | 'oklch' | 'lch' | 'hsl' | 'hsv',
  default 'oklab') and `hueInterpolation` ('shorter' | 'longer' | 'increasing' |
  'decreasing', default 'shorter'). LinearGradient, SimplexNoise, and MeshGradient
  gain matching props. Foundation fix: hex colors now decode to linear-sRGB (true
  color), and the LCH conversion's green coefficient was corrected. This shifts the
  default appearance of those components (pre-1.0 breaking color change).

## 0.5.0

### Minor Changes

- c67eb98: Rename engine exports to spelled-out, domain-accurate names (breaking).

  - `fbm` → `fractalNoise` (and `FBMOptions` → `FractalNoiseOptions`)
  - `noise` → `simplexNoise`
  - `sdfCircle` → `signedDistanceFieldCircle`
  - `time` → `elapsedTime`
  - `Vec2` → `Vector2`

  `TSLNode`, `voronoi`, `colorRamp`, `quantize`, `displace`, `cursorRipple`, and `grain` are unchanged.

  **Migration:** one-pass find-and-replace in your imports and call sites. No behavioral changes.

## 0.4.1

### Patch Changes

- b4ecdda: Reorganize engine source into kebab-case module folders under `inputs/`, `primitives/`, and `runtime/` (matching `matter-react` and `registry` layout). No public API changes.

## 0.4.0

### Minor Changes

- 1c69220: Rename public API symbols to domain-accurate names.

  New primary names: `FrameScheduler`, `GpuRenderer`, `GpuBackend` (`@lovo/matter`); `ShaderScene`, `ShaderSceneProps`, `ShaderContext`, `ShaderContextValue`, `useShaderContext`, `ShaderMonitor`, `ShaderMonitorProps`, `AnimatableSignal` (`@lovo/matter-react`).

  Old names (`MatterScheduler`, `MatterRenderer`, `MatterBackend`, `MatterScene`, `MatterSceneProps`, `MatterContext`, `MatterContextValue`, `useMatterContext`, `MatterMonitor`, `MatterMonitorProps`, `MatterSignal`, `MatterBackend`) are deprecated with `@deprecated` JSDoc and continue to work. They will be removed no earlier than 0.5.0.

  **Migration:** Replace old names with new in your imports and JSX. A one-pass find-and-replace is sufficient — no behavioral changes.

## 0.3.0

### Minor Changes

- 3856367: Add `grain` primitive — hash-based, centered film grain for shader compositions.

  ```ts
  import { grain, time } from "@lovo/matter";
  import { uv } from "three/tsl";

  // Static grain:
  const grainValue = grain(uv(), 0.08);

  // Twinkling grain — caller controls the shutter rate. floor() quantizes
  // time to a discrete cadence; the hash is so sensitive that a continuous
  // time input gives no perceptible speed control.
  const grainValue = grain(uv(), 0.08, time.mul(speed).mul(60).floor());

  material.colorNode = vec4(color.add(grainValue), 1);
  ```

  Output is centered around zero (mean of `length(vec2(u, v))` for uniform
  `u, v ∈ [0, 1)` is ~0.765, subtracted at the recipe level) so the grain
  acts as a brightness-preserving texture overlay. Subtract instead of add
  at the call site for film-stock-style darkening.

## 0.2.0

### Minor Changes

- Drop pure TSL re-exports from `@lovo/matter` public API.

  The following 15 nodes are no longer exported by `@lovo/matter`. Import them directly from `three/tsl`:

  `uv`, `vec2`, `vec3`, `vec4`, `uniform`, `mix`, `smoothstep`, `mod`, `sin`, `cos`, `length`, `dot`, `normalize`, `max`, `min`

  ```ts
  // Before (0.1.x)
  import { vec3, uv, time } from "@lovo/matter";

  // After (0.2.0)
  import { vec3, uv } from "three/tsl";
  import { time } from "@lovo/matter"; // still here — reduced-motion-gated
  ```

  The Matter-owned `time` (reduced-motion gated) continues to be exported from `@lovo/matter` unchanged. For raw uncapped time, import from `three/tsl` directly.

  All Matter-owned primitives (`fbm`, `noise`, `voronoi`, `colorRamp`, `sdfCircle`, `displace`, `cursorRipple`, `quantize`) remain exported from `@lovo/matter` unchanged. Registry component sources at 0.2.0 use the new convention. If you copied a component at 0.1.x, update its imports from `@lovo/matter` to `three/tsl` for the dropped symbols (or re-add the component via the CLI to pull the 0.2.0 source).

  **Why:** Re-exporting pure TSL primitives provided no value beyond shared import paths. Dropping them clarifies the layer boundary — Matter ships value-add primitives; TSL provides the math.

## 0.1.0

### Minor Changes

- Initial public release of Matter — React shader components on WebGPU + Three.js TSL.

  **`@lovo/matter`** — Framework-agnostic engine: TSL primitives (`fbm`, `voronoi`, `colorRamp`, `quantize`, …), WebGPU renderer wrapper, visibility/intersection-aware scheduler.

  **`@lovo/matter-react`** — React binding: `<MatterScene>` (shared canvas), `useShaderMaterial` (r3f-compatible), input hooks (`useCursor`, `useScroll`).

  **`@lovo/matter-cli`** — shadcn-style copy-paste CLI: `init`, `list`, `add`, `update`. Default registry tracks the CLI's published version tag (`v0.1.0`) so component code is stable per release.

  **v1 components** (via `matter-cli add <name>`): `linear-gradient`, `mesh-gradient`, `aurora`, `dot-field`, `noise-field`, `waves`. Each component is yours to edit after copy-in.

  **Requirements:** Node 22+ for the CLI. WebGPU-capable browser (Chromium-based, Safari TP, Firefox Nightly with the flag). Three.js ^0.170. React ^19.

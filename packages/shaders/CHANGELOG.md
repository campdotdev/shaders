# @mattermix/shaders

> Versions 0.18.0 and below shipped as `@lovo/matter` before the project moved to the mattermix org. Releases 1.0.0 through 3.9.0 from that history are renumbered here as 0.7.0 through 0.18.0.

## 0.18.0

### Minor Changes

- 2cb44b1: `colorRamp` takes node-driven stops. `position` accepts `number | TSLNode`, and a node-valued `color` is now part of the contract, so uniforms drive ramp colors and positions live with no material rebuild. Stop count stays structural. Ramps with literal positions compile exactly as before. Node-driven stops that coincide or cross at runtime collapse to a hard step at the stop position. This release also exports the `colorSpaces` conversion registry, which holds a `fromLinear` and a `toLinear` for every supported space.

## 0.17.0

### Minor Changes

- c6b672a: Add the `metaballs` primitive, a summed metaball field over up to 20 blob centers that roam the origin on hash-phased sine paths. It returns the field strength, which you threshold for gooey merged silhouettes, and a field-weighted per-blob blend value for color ramps. Count, size, size variation, spread, time, and seed all accept TSL nodes, so every dial can ride a uniform. A fractional count grows the last blob in smoothly.

## 0.16.0

### Minor Changes

- 152c14b: `fractalNoise` gains turbulence folding and live gain. The new `fold` option takes 'none', 'smooth', or 'sharp'. 'smooth' and 'sharp' fold each octave with `abs()` before summing, squared for soft billows or square-rooted for crisp veins, and 'none' keeps the raw signed noise. `gain` now also accepts a TSL node and computes per-octave amplitude as `pow(gain, i)` on the GPU, so a uniform-driven detail dial glides without rebuilding the material. Folded output is normalized to roughly 0..1, and 'none' stays roughly -1..1.

## 0.15.0

### Minor Changes

- 0a26708: Add `voronoiCells`, the two-pass cell Voronoi from Inigo Quilez's ldl3W8, as a Tier 2 primitive. It returns three fields per pixel: `edgeDistance`, the exact distance to the nearest cell border measured through perpendicular bisectors, which is what makes constant-width borders possible; `seedOffset`, the vector to the cell's seed; and `hash`, a stable per-cell random for coloring. Three options animate the field. `time` is a pre-integrated phase, `jitter` scatters seed anchors off the grid, and `drift` orbits each seed within the room its cell offers, so the 3x3 neighbor search stays valid at any amplitude. The distance-only `voronoi` (Worley) primitive is unchanged.

## 0.14.0

### Minor Changes

- 4e3feab: Add `ditherThreshold`, one entry point for ordered-dither threshold maps: Bayer 2x2, 4x4, and 8x8, halftone dots, halftone lines, white noise, interleaved gradient noise, and a precomputed 64x64 blue-noise tile. The anti-banding `dither()` now builds on it. `quantize()` accepts a node for its step count, so a level count can ride a uniform, plus an optional threshold argument that replaces the 0.5 rounding point. Pass a threshold map there to turn a plain posterize into ordered dithering, which is how the Dither registry component uses the pair.

## 0.13.0

### Minor Changes

- 263403e: Add a phase-reset channel to `FrameScheduler`. Accumulators register a listener with `onPhaseReset()`, and `resetPhases()` rewinds them all to zero. Accumulated phase is wall-clock history, so a harness that needs a reproducible frame, such as the docs visual tests, has to rewind it together with the renderer clock. `useAnimatableSpeed` registers its phase uniform on the channel, which keeps a quantized shader like grain rendering the same seed on every machine.

## 0.12.0

## 0.11.1

## 0.11.0

### Minor Changes

- dd8f99b: Add `@mattermix/shaders/color`, a second entry point for the CPU-side color math: `parseColorString`, the OKLab and OKLCH conversions, the gamut helpers, and the sRGB transfer functions. The root entry still exports all of them, so nothing has to move. The difference is that the subpath has no path to three, so a server render can import it. The root entry cannot, because it reaches the renderer and `three/webgpu` reads `self` at module load.

  `parseColorString` now throws on input it used to mangle. Components that aren't numbers ran through `parseFloat` to NaN and came back as `[NaN, NaN, NaN]`, which reached the GPU as a blank shader with a clean console. Hex is checked for format now too. It takes `#rrggbb` and `#rrggbbaa`, parsing and dropping alpha the same way `oklch()` and `oklab()` already do, and throws on anything else. `#abcdefgh` used to slice its first six digits and return a confidently wrong color.

## 0.10.0

## 0.9.0

## 0.8.0

### Major Changes

- 945657f: Rework the `<Vignette>` component. `radius` is now `falloff` and `softness` is now `feather`. The overlay blend gains `colorSpace`, defaulting to `oklab`, and `hueInterpolation`, defaulting to `shorter`, so the vignette darkens and tints in a chosen perceptual space instead of only in linear space. Defaults shift to `intensity` 0.3, `feather` 0.6, and a dark wide-gamut `oklch()` color.

  This breaks any code that passes `radius` or `softness`, or that relies on the previous linear default blend.

## 0.7.0

### Major Changes

- 8d9d4ad: Rename the `filmGrain` primitive to `grain`.

  The `filmGrain(intensity, timeOffset?)` primitive is now exported as `grain` with
  an identical signature and behavior. The Tier 1 `<FilmGrain>` component, delivered
  through the CLI, is renamed to `<Grain>`, and its `film-grain` registry slug
  is now `grain`.

  **Migration:** one-pass find-and-replace.

  ```ts
  // Before
  import { filmGrain } from '@mattermix/shaders';
  const g = filmGrain(0.08);

  // After
  import { grain } from '@mattermix/shaders';
  const g = grain(0.08);
  ```

## 0.6.0

### Minor Changes

- 24ec05d: Add color-space-aware interpolation. `colorRamp` and the new `mixColor` primitive
  accept `colorSpace` ('linear', 'oklab', 'oklch', 'lch', 'hsl', or 'hsv',
  default 'oklab') and `hueInterpolation` ('shorter', 'longer', 'increasing', or
  'decreasing', default 'shorter'). LinearGradient, SimplexNoise, and MeshGradient
  gain matching props. Two fixes underneath: hex colors now decode to linear-sRGB,
  which is the true color, and the LCH conversion uses the correct green coefficient.
  Both shift the default appearance of those components, a breaking color change
  before 1.0.

## 0.5.0

### Minor Changes

- c67eb98: Rename engine exports to spelled-out, domain-accurate names. This is a breaking change.

  - `fbm` → `fractalNoise` (and `FBMOptions` → `FractalNoiseOptions`)
  - `noise` → `simplexNoise`
  - `sdfCircle` → `signedDistanceFieldCircle`
  - `time` → `elapsedTime`
  - `Vec2` → `Vector2`

  `TSLNode`, `voronoi`, `colorRamp`, `quantize`, `displace`, `cursorRipple`, and `grain` are unchanged.

  **Migration:** one-pass find-and-replace in your imports and call sites. Behavior is unchanged.

## 0.4.1

### Patch Changes

- b4ecdda: Reorganize the engine source into kebab-case module folders under `inputs/`, `primitives/`, and `runtime/`, matching the `shaders-react` and `registry` layout. No public API changes.

## 0.4.0

### Minor Changes

- 1c69220: Rename public API symbols to domain-accurate names.

  New primary names: `FrameScheduler`, `GpuRenderer`, `GpuBackend` (`@mattermix/shaders`); `ShaderScene`, `ShaderSceneProps`, `ShaderContext`, `ShaderContextValue`, `useShaderContext`, `ShaderMonitor`, `ShaderMonitorProps`, `AnimatableSignal` (`@mattermix/shaders-react`).

  The old names `MatterScheduler`, `MatterRenderer`, `MatterBackend`, `MatterScene`, `MatterSceneProps`, `MatterContext`, `MatterContextValue`, `useMatterContext`, `MatterMonitor`, `MatterMonitorProps`, and `MatterSignal` carry `@deprecated` JSDoc and continue to work. They will be removed no earlier than 0.5.0.

  **Migration:** replace the old names with the new ones in your imports and JSX. A one-pass find-and-replace is enough. Behavior is unchanged.

## 0.3.0

### Minor Changes

- 3856367: Add the `grain` primitive, a hash-based, centered film grain for shader compositions.

  ```ts
  import { grain, time } from "@mattermix/shaders";
  import { uv } from "three/tsl";

  // Static grain:
  const grainValue = grain(uv(), 0.08);

  // Twinkling grain. The caller controls the shutter rate. floor() quantizes
  // time to a discrete cadence, because the hash is so sensitive that a
  // continuous time input gives no perceptible speed control.
  const grainValue = grain(uv(), 0.08, time.mul(speed).mul(60).floor());

  material.colorNode = vec4(color.add(grainValue), 1);
  ```

  Output is centered around zero, so the grain acts as a brightness-preserving texture
  overlay. The mean of `length(vec2(u, v))` for uniform `u, v ∈ [0, 1)` is about 0.765,
  and the recipe subtracts it. Subtract instead of add at the call site for
  film-stock-style darkening.

## 0.2.0

### Minor Changes

- Drop pure TSL re-exports from the `@mattermix/shaders` public API.

  The following 15 nodes are no longer exported by `@mattermix/shaders`. Import them directly from `three/tsl`:

  `uv`, `vec2`, `vec3`, `vec4`, `uniform`, `mix`, `smoothstep`, `mod`, `sin`, `cos`, `length`, `dot`, `normalize`, `max`, `min`

  ```ts
  // Before (0.1.x)
  import { vec3, uv, time } from "@mattermix/shaders";

  // After (0.2.0)
  import { vec3, uv } from "three/tsl";
  import { time } from "@mattermix/shaders"; // still here, reduced-motion-gated
  ```

  `time` stays exported from `@mattermix/shaders` unchanged, because this package owns its reduced-motion gating. For raw uncapped time, import from `three/tsl` directly.

  The primitives this package owns (`fbm`, `noise`, `voronoi`, `colorRamp`, `sdfCircle`, `displace`, `cursorRipple`, `quantize`) also stay exported unchanged. Registry component sources at 0.2.0 use the new convention. If you copied a component at 0.1.x, update its imports from `@mattermix/shaders` to `three/tsl` for the dropped symbols, or re-add the component through the CLI to pull the 0.2.0 source.

  **Why:** re-exporting pure TSL primitives bought nothing beyond shared import paths. Dropping them clarifies the layer boundary. This library ships value-add primitives, and TSL provides the math.

## 0.1.0

### Minor Changes

- Initial public release. React shader components on WebGPU and Three.js TSL.

  - `@mattermix/shaders` is the framework-agnostic engine: TSL primitives such as `fbm`, `voronoi`, `colorRamp`, and `quantize`, a WebGPU renderer wrapper, and a scheduler that watches visibility and intersection.
  - `@mattermix/shaders-react` is the React binding: `<MatterScene>` for the shared canvas, `useShaderMaterial` for r3f, and the `useCursor` and `useScroll` input hooks.
  - `@mattermix/shaders-cli` is the shadcn-style copy-paste CLI, with `init`, `list`, `add`, and `update`. The default registry tracks the CLI's published version tag (`v0.1.0`), so component code is stable per release.

  Six components ship through `shaders-cli add <name>`: `linear-gradient`, `mesh-gradient`, `aurora`, `dot-field`, `noise-field`, and `waves`. Each component is yours to edit after copy-in.

  Requirements: Node 22 or newer for the CLI, a WebGPU-capable browser (Chromium-based, Safari Technology Preview, or Firefox Nightly with the flag), Three.js ^0.170, and React ^19.

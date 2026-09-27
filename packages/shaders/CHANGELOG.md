# @camp-dev/shaders

## 0.21.0

### Minor Changes

- b9c359b: A scene whose only live input is the cursor now idles while the pointer is still. `useCursor` asks the scene's scheduler for a frame on each pointer move and on each tick that moves the smoothed position, so the scene draws in a short burst around pointer motion and then parks. LedWall's static vote no longer counts a cursor signal on `focus` as animated. `CursorInput` gains an `onMove` option, its `tick` now returns whether it notified listeners, the smoothing snaps onto the target once the gap is under a device pixel, and a tick longer than one 30fps frame is treated as one frame so the glide survives a wake.
- 035fa56: Every position prop now accepts `"cursor"`, which follows the pointer through the scene's shared cursor with no hook call and no wrapper component, so `<LedWall swellCenter="cursor" />` swells under the pointer on its own. A fixed point or an animation signal still works, and a fixed point attaches no pointer listener. The props share a new exported `PositionProp` type, and `useAnimatablePoint` takes a `cursorInitial` option for where a `"cursor"` point sits before the first move. LedWall's point is renamed after its reaction, with defaults unchanged. To migrate, rename `focus` to `swellCenter` and `focusRadius` to `swellRadius`. Blobs' `center` now measures y from the top, like every other mesh component's position prop, so a `"cursor"` center moves the right way. The default `[0.5, 0.5]` renders the same. A custom center with y other than 0.5 mirrors vertically, so replace y with `1 - y` to keep the old placement.
- ffef616: Add `CursorRipple`, a water surface over any scene. Drag the pointer across the canvas and it leaves a wake that spreads, catches light, and settles. Mount it inside a `ShaderScene` after the components it should act on. It takes four props, each a static value or an animation signal: `refraction` bends the image beneath, `shine` lights the flanks facing a fixed upper-left light, `radius` sets the wake's width, and `decay` sets how fast the water calms. The ripple is invisible until the first pointer move, and the scene can idle once the water settles. It works in Mode 1 only, and its refraction bends the image the Sources drew, not an Effect mounted before it. Where the renderer cannot draw to a half-float target, it renders as identity and warns once in development.

  `CursorRippleShader`, the ripple's GPU half, is exported so a caller can render it over a wave field it drives itself. The wave field gains `tune()`, which changes its brush radius and its height and velocity damping while it runs, and `dampingForLifetime()`, which converts a ring's lifetime in seconds into a per-substep damping. A switch to the paused reduced-motion policy now flattens a moving field and reports it at rest, instead of freezing the water on screen.

- 5bb6de1: Add `CursorSpotlight`, which brightens the scene around the pointer. Mount it inside a `ShaderScene` after the components it should light. It takes two props, each a static value or an animation signal: `radius` sets the light's reach in canvas heights, and `intensity` sets how much brighter the image gets under the pointer, where 1 doubles it. The light scales existing color, so black stays black. It is invisible until the first pointer move, fades out when the pointer leaves the canvas, and lets the scene idle while the pointer is still. It works in Mode 1 only.
- e22c0ec: Remove two APIs that only the node editor used. The package root no longer exports `colorSpaces`, the registry of color-space converters. To blend in a given space, pass `colorSpace` to `mixColor` or `colorRamp`. `ColorRampStop.position` now takes a number and rejects a TSL node, so moving a stop rebuilds the material. Ramps with literal positions, which covers every component, compile the same shader as before.
- 75f8f01: Every `useCursor()` call inside a `ShaderScene` now reads one shared pointer input owned by the scene, created on the first call and disposed with the scene, and smooths toward it at its own `smoothing`. The signal gains `presence`, a 0..1 signal that eases to 1 after the pointer enters the canvas and to 0 after it leaves, for effects to multiply their strength by. `useCursor({ enabled: false })` attaches nothing and returns a fixed signal, and `useCursor({ element })` keeps a private input in the caller's frame. `CursorInput` listens for `pointermove` rather than `mousemove`, so touch and pen drive it, and exposes the raw target through `getTarget()`, the inside state through `isInside()`, and move subscriptions through `onMove()`. The `onMove` constructor option, added in the previous unreleased change, moves to the hook.
- e6d1ce6: Add the `createWaveField` runtime and its `WaveField` and `WaveFieldStroke` types. The runtime simulates pointer-driven waves in GPU ping-pong render targets and returns the latest field as a texture for shader composition.

### Patch Changes

- ffef616: `MeshGradient` now tells the scene it is animating. It cast no vote before, so any component in the same scene that voted static, such as `CursorRipple`, `Dissolve`, or a `LinearGradient` at speed 0, let the scene stop drawing and froze the gradient until the next pointer move or prop change.

## 0.20.0

### Minor Changes

- d53d261: Add a `shape` prop to DotField. `'circle'` is the disk it has always drawn and `'cross'` is an x with flat-ended arms, sized by `dotSize` from tip to tip. The x is a new engine primitive, `signedDistanceFieldCross`, the union of two rectangles turned 45 degrees.

  `shape` also takes a custom mark as inline SVG markup: `{ svg: '<svg viewBox="0 0 24 24">…</svg>' }`. The browser decodes the markup once into a 128px tile, and the shader reads the tile's alpha at each grid point, so any fill in the markup is ignored and the mark takes `color`. The `viewBox` scales to fit `dotSize` on its longer side. Custom cells draw nothing on the first frame and appear once the decode lands, while built-in marks draw at once. A non-square `viewBox` keeps its aspect and sits centered, and `width` and `height` stand in when there is no `viewBox`. Markup with no usable box, or that the browser cannot decode, warns once in the console and leaves its cells empty; nothing throws. The markup type is exported as `SvgMarkup`.

  `shape` also takes a readonly array of marks, mixing built-in names and `{ svg }` objects freely. Each cell draws one entry, picked by a stable hash of its cell index, so the pick holds still from frame to frame and matches on WebGPU and on the WebGL2 fallback. A mark listed more than once is drawn that many times as often: `['cross', { svg: star }, { svg: star }]` draws about two stars per cross. Every custom entry in the array shares one padded texture, decoded once.

- ef14a4a: Add three Effects. LedWall screens the scene beneath it into a grid of square LED dots, with a per-dot breath, a bleed dial for the gaps, and a focus point the dots swell toward. RadialWipe reveals the scene from a center with a feathered front driven by a progress value. Dissolve grains whatever alpha it sits over into blocks, so it pairs with any wipe or soft-edged source.

### Patch Changes

- ef14a4a: Fix aspect-corrected components drawing at a 16:9 ratio on a static scene until the first resize. Every component that keeps circles round or grids square on a wide canvas now reads the ratio through one hook that requests a frame when the canvas size arrives. DotField's resolution and the pixel-ratio uniforms on Dither, Dissolve, and LedWall request a frame the same way.
- d53d261: Fix DotField marks on tight grids drawing a different pixel pattern at every grid point. The anti-aliasing band across a mark's edge is now measured in device pixels rather than as a fraction of the cell, so a 2px mark on a 6px grid gets the same soft rim a 3px mark on a 30px grid always had.
- ef14a4a: Fix two ShaderScenes on one page drawing each other's output. three 0.170's PostProcessing shares a single full-screen quad and material across every instance, so whichever scene updated last was what every canvas drew. Each scene now owns its output quad and material.

## 0.19.0

### Minor Changes

- 0b58731: The packages move to the `@camp-dev` scope. `@lovo/matter` is now `@camp-dev/shaders`, `@lovo/matter-cli` is now `@camp-dev/shaders-cli`, and `@lovo/matter-react` is folded into `@camp-dev/shaders`, which now exports everything it did. The repository moved to github.com/campdotdev/shaders. Update your dependency names and every import specifier. Apart from the removals below, the exports themselves are unchanged.

  The CLI binary is renamed from `matter-cli` to `shaders-cli`. Update any script that calls the old binary.

  `MatterError` and `MatterErrorCode` in `@camp-dev/shaders` are now `ShadersError` and `ShadersErrorCode`. A `catch` block that tests `instanceof MatterError` has to switch to the new name.

  The READMEs drop their migration notes for the `Matter*` aliases that 0.4.0 deprecated, such as `MatterScene` and `MatterScheduler`. The aliases themselves left the source several releases ago.

- e740a5a: `@camp-dev/shaders` now ships the components and the React binding too. It absorbs `@camp-dev/shaders-react` and the components that `shaders-cli add` used to copy into your project, so `Aurora`, `ShaderScene`, `useShaderMaterial`, and `fractalNoise` all import from the root:

  ```tsx
  import { Aurora, ShaderScene } from '@camp-dev/shaders';
  ```

  `@camp-dev/shaders/color` is unchanged. `@camp-dev/shaders-react/gamut` is now `@camp-dev/shaders/gamut`, and `@camp-dev/shaders-react/poster` is now `@camp-dev/shaders/poster`. Peer dependencies are `react ^19` and `three ^0.170`.

  Components are no longer copied into your project. If you added one with `shaders-cli add`, delete the copied file and import the component from the package instead. The `shaders-cli` commands `init`, `add`, `list`, and `update` are retired in this release too; `poster` stays.

- fc0d728: Seeded randomness now renders the same pattern on the WebGPU and WebGL2 backends. three's TSL `hash()` writes its PCG constants as float literals, which GLSL rounds to a different hash than WGSL computes, so the same `seed` produced a different Voronoi layout in Safari than in Chrome. The new `stableHash` and `stableHashUint` exports run the same PCG with integer-typed constants and chain hash streams u32 to u32, and `voronoiCells`, `grain`, `metaballs`, and `ditherPattern` now draw from them.

  This costs one visual break. Deriving seeds from the raw hash word re-rolls every seeded layout once, on both backends, so any `seed` value renders a new pattern after this release. The new pattern is stable from here.

> Versions 0.18.0 and below shipped as `@lovo/matter` before the project moved to the camp-dev org. Releases 1.0.0 through 3.9.0 from that history are renumbered here as 0.7.0 through 0.18.0.

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

- dd8f99b: Add `@camp-dev/shaders/color`, a second entry point for the CPU-side color math: `parseColorString`, the OKLab and OKLCH conversions, the gamut helpers, and the sRGB transfer functions. The root entry still exports all of them, so nothing has to move. The difference is that the subpath has no path to three, so a server render can import it. The root entry cannot, because it reaches the renderer and `three/webgpu` reads `self` at module load.

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
  import { filmGrain } from '@camp-dev/shaders';
  const g = filmGrain(0.08);

  // After
  import { grain } from '@camp-dev/shaders';
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

  New primary names: `FrameScheduler`, `GpuRenderer`, `GpuBackend` (`@camp-dev/shaders`); `ShaderScene`, `ShaderSceneProps`, `ShaderContext`, `ShaderContextValue`, `useShaderContext`, `ShaderMonitor`, `ShaderMonitorProps`, `AnimatableSignal` (`@camp-dev/shaders-react`).

  The old names `MatterScheduler`, `MatterRenderer`, `MatterBackend`, `MatterScene`, `MatterSceneProps`, `MatterContext`, `MatterContextValue`, `useMatterContext`, `MatterMonitor`, `MatterMonitorProps`, and `MatterSignal` carry `@deprecated` JSDoc and continue to work. They will be removed no earlier than 0.5.0.

  **Migration:** replace the old names with the new ones in your imports and JSX. A one-pass find-and-replace is enough. Behavior is unchanged.

## 0.3.0

### Minor Changes

- 3856367: Add the `grain` primitive, a hash-based, centered film grain for shader compositions.

  ```ts
  import { grain, time } from "@camp-dev/shaders";
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

- Drop pure TSL re-exports from the `@camp-dev/shaders` public API.

  The following 15 nodes are no longer exported by `@camp-dev/shaders`. Import them directly from `three/tsl`:

  `uv`, `vec2`, `vec3`, `vec4`, `uniform`, `mix`, `smoothstep`, `mod`, `sin`, `cos`, `length`, `dot`, `normalize`, `max`, `min`

  ```ts
  // Before (0.1.x)
  import { vec3, uv, time } from "@camp-dev/shaders";

  // After (0.2.0)
  import { vec3, uv } from "three/tsl";
  import { time } from "@camp-dev/shaders"; // still here, reduced-motion-gated
  ```

  `time` stays exported from `@camp-dev/shaders` unchanged, because this package owns its reduced-motion gating. For raw uncapped time, import from `three/tsl` directly.

  The primitives this package owns (`fbm`, `noise`, `voronoi`, `colorRamp`, `sdfCircle`, `displace`, `cursorRipple`, `quantize`) also stay exported unchanged. Registry component sources at 0.2.0 use the new convention. If you copied a component at 0.1.x, update its imports from `@camp-dev/shaders` to `three/tsl` for the dropped symbols, or re-add the component through the CLI to pull the 0.2.0 source.

  **Why:** re-exporting pure TSL primitives bought nothing beyond shared import paths. Dropping them clarifies the layer boundary. This library ships value-add primitives, and TSL provides the math.

## 0.1.0

### Minor Changes

- Initial public release. React shader components on WebGPU and Three.js TSL.

  - `@camp-dev/shaders` is the framework-agnostic engine: TSL primitives such as `fbm`, `voronoi`, `colorRamp`, and `quantize`, a WebGPU renderer wrapper, and a scheduler that watches visibility and intersection.
  - `@camp-dev/shaders-react` is the React binding: `<MatterScene>` for the shared canvas, `useShaderMaterial` for r3f, and the `useCursor` and `useScroll` input hooks.
  - `@camp-dev/shaders-cli` is the shadcn-style copy-paste CLI, with `init`, `list`, `add`, and `update`. The default registry tracks the CLI's published version tag (`v0.1.0`), so component code is stable per release.

  Six components ship through `shaders-cli add <name>`: `linear-gradient`, `mesh-gradient`, `aurora`, `dot-field`, `noise-field`, and `waves`. Each component is yours to edit after copy-in.

  Requirements: Node 22 or newer for the CLI, a WebGPU-capable browser (Chromium-based, Safari Technology Preview, or Firefox Nightly with the flag), Three.js ^0.170, and React ^19.

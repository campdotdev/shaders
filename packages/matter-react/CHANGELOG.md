# @lovo/matter-react

## 3.6.0

### Patch Changes

- 0a26708: Reset the CPU-side phase accumulators at the scene's first painted frame, alongside the existing renderer-clock rewind. The accumulators integrate wall-clock deltas from mount, so the renderer's init latency used to carry into the first visible pose. A poster captured at t=0 never quite matched the frame that replaced it, and the slower the device, the bigger the jump. Sharp-geometry shaders made the drift obvious; now the first frame anyone sees is genuinely t=0.

## 3.5.0

### Minor Changes

- 4e3feab: Add useBasePassUv: post-process overlays can register a transform that changes where the scene texture is sampled. Color passes only see each pixel's finished color, so an effect that needs to resample the scene (like Dither's pixelation, which snaps the sample coordinate to a cell grid) had no way to work. UV transforms compose in mount order, same as usePostProcessPass, and scenes with none registered render exactly as before.

## 3.4.0

### Minor Changes

- b97d558: Add `useAnimatableSpeed`, which turns a `speed` prop into a phase uniform accumulated on the CPU (`phase += speed * min(delta, 0.1)` each frame; the cap keeps the first frame after a hidden tab from replaying the whole gap). The shaders previously computed motion as elapsed time multiplied by speed, so any speed change (a slider drag or an animation signal) re-evaluated the whole elapsed history at the new rate and snapped the pattern; after 15 seconds on screen, the smallest slider step moved the canvas 41x more than a frame of steady motion. All eight animated registry components now read the accumulated phase instead. The reduced-motion time scale is applied inside the accumulator, so a mid-session `prefers-reduced-motion` change also shifts tempo smoothly instead of jumping.

### Patch Changes

- 263403e: Add a phase-reset channel to `FrameScheduler`: accumulators register a listener with `onPhaseReset()`, and `resetPhases()` rewinds them all to zero. Accumulated phase is wall-clock history, so a harness that needs a reproducible frame (like the docs visual tests) has to rewind it together with the renderer clock. `useAnimatableSpeed` registers its phase uniform on the channel, which is what keeps a quantized shader like grain rendering the same seed on every machine.

## 3.3.0

### Minor Changes

- 6d24f42: Add `useAnimatablePoint`, a vec2 counterpart to `useAnimatableUniform`: pass it an `[x, y]` pair or an animation signal and it keeps a point uniform current. `center` now accepts a signal on LinearGradient, RadialGradient, DotField, and Vignette. LinearGradient's `angle` animates now too. Its direction vector used to be precomputed on the CPU inside an effect, so a signal had nothing to reach; the shader now derives the direction from a scalar angle uniform. Also fixed: DotField and Vignette skipped the render request when `center` changed, so dragging it on an idle scene (speed 0) changed nothing until something else forced a frame. And swapping one animation signal for another now seeds the uniform from the new signal's current value instead of waiting for its first tick, in both hooks.

## 3.2.1

### Patch Changes

- 213518d: Fix animatable props doing nothing on a scene that has stopped rendering. `useAnimatableUniform` wrote the new value into its uniform but never told the frame scheduler to draw, so any component that had voted itself static — a gradient at `speed={0}`, say — would accept a prop change or a MotionValue tick and show none of it. On the docs SimplexNoise page this meant Scale, Contrast, Balance and Softness all went dead the moment speed reached 0. Every write now pokes the scheduler, which is a no-op unless the scene is genuinely idle.

## 3.2.0

### Minor Changes

- 0d924ce: Adds `@lovo/matter-react/gamut`, a second entry point carrying `useDisplayGamut` with no path to three. The root entry re-exports `ShaderScene`, which imports `three/webgpu`, and that reads `self` at module load, so a server-rendered page that only wanted to know whether the display can show P3 had to load the renderer to ask. The hook itself never needed it.

  Same idea as `@lovo/matter/color`, and this package already shipped `./poster` on the same reasoning. Both subpaths now have a test that imports them under a bare Node environment, so three creeping back into either one fails there rather than in someone's server render.

## 3.1.0

## 3.0.0

### Major Changes

- 1b0bbcb: Remove `ShaderScene`'s `fallback` prop (breaking). Use the new `ShaderPoster` component from `@lovo/matter-react/poster` instead — it renders in the initial HTML (SSR-safe, no three import) and dismisses when the wrapped `ShaderScene` paints its first frame.

## 2.0.0

- `ShaderScene` gains an `onFirstPaint?: () => void` prop, fired once when the shader's first frame is on screen. Lets consumers dismiss a server-rendered poster without relying on the shader being opaque.

## 1.0.0

## 0.6.0

## 0.5.0

### Minor Changes

- 35274c3: Rename ambiguous `@lovo/matter-react` public exports to clearer names (BREAKING, pre-1.0):

  - `useOverlayPass` → `usePostProcessPass` (and the paired type `OverlayTransform` → `PostProcessTransform`)
  - `useStaticHint` → `useStaticSceneHint`
  - `MonitorAnchor` (type) → `ShaderMonitorAnchor`

  Migration: update imports and call sites to the new names. Behavior is unchanged.

## 0.4.1

## 0.4.0

### Minor Changes

- 1c69220: Rename public API symbols to domain-accurate names.

  New primary names: `FrameScheduler`, `GpuRenderer`, `GpuBackend` (`@lovo/matter`); `ShaderScene`, `ShaderSceneProps`, `ShaderContext`, `ShaderContextValue`, `useShaderContext`, `ShaderMonitor`, `ShaderMonitorProps`, `AnimatableSignal` (`@lovo/matter-react`).

  Old names (`MatterScheduler`, `MatterRenderer`, `MatterBackend`, `MatterScene`, `MatterSceneProps`, `MatterContext`, `MatterContextValue`, `useMatterContext`, `MatterMonitor`, `MatterMonitorProps`, `MatterSignal`, `MatterBackend`) are deprecated with `@deprecated` JSDoc and continue to work. They will be removed no earlier than 0.5.0.

  **Migration:** Replace old names with new in your imports and JSX. A one-pass find-and-replace is sufficient — no behavioral changes.

## 0.3.0

### Minor Changes

- c4cbb52: Add the overlay-component category. `MatterScene` now drives its render via `three/webgpu`'s `PostProcessing` pipeline so child components can register chained TSL transforms instead of each owning their own material draw.

  **New: `useOverlayPass(transform, deps)` hook**

  ```ts
  import { useAnimatableUniform, useOverlayPass } from '@lovo/matter-react';

  export function MyOverlay({ intensity }) {
    const intensityU = useAnimatableUniform(intensity);
    useOverlayPass(
      (input) => input.mul(intensityU), // takes upstream pixel, returns modified pixel
      [intensityU],
    );
    return null;
  }
  ```

  Mount the component inside any `<MatterScene>` and it composes onto the pipeline; multiple overlays chain in mount order. Uniforms captured inside `transform` update in place and don't need to be in `deps` — only put structural changes (mode toggles, etc.) in `deps` so the transform gets re-registered.

  **Registry-side ships (delivered via `@lovo/matter-cli` copy-paste):**

  - `<Grain>` — additive or subtractive grain overlay.
  - `<Vignette>` — radial edge darkening, aspect-corrected so the mask is a circle on widescreen.
  - **Breaking:** `<MeshGradient>` no longer accepts `grain` / `grainSpeed` props. Stack `<Grain />` as a sibling inside `<MatterScene>` instead. Existing copies pulled before this release keep working; new pulls / CLI refreshes pick up the new shape. The MeshGradient docs page has the new pattern.

### Patch Changes

- Updated dependencies [3856367]
  - @lovo/matter@0.3.0

## 0.2.0

### Minor Changes

- No API changes. Bumped alongside `@lovo/matter` 0.2.0 because the three packages ship as a fixed version group. See [`@lovo/matter`'s 0.2.0 changelog](../matter/CHANGELOG.md#020) for the engine-level breaking change.

## 0.1.0

### Minor Changes

- Initial public release of Matter — React shader components on WebGPU + Three.js TSL.

  **`@lovo/matter`** — Framework-agnostic engine: TSL primitives (`fbm`, `voronoi`, `colorRamp`, `quantize`, …), WebGPU renderer wrapper, visibility/intersection-aware scheduler.

  **`@lovo/matter-react`** — React binding: `<MatterScene>` (shared canvas), `useShaderMaterial` (r3f-compatible), input hooks (`useCursor`, `useScroll`).

  **`@lovo/matter-cli`** — shadcn-style copy-paste CLI: `init`, `list`, `add`, `update`. Default registry tracks the CLI's published version tag (`v0.1.0`) so component code is stable per release.

  **v1 components** (via `matter-cli add <name>`): `linear-gradient`, `mesh-gradient`, `aurora`, `dot-field`, `noise-field`, `waves`. Each component is yours to edit after copy-in.

  **Requirements:** Node 22+ for the CLI. WebGPU-capable browser (Chromium-based, Safari TP, Firefox Nightly with the flag). Three.js ^0.170. React ^19.

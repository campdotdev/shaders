# @camp-dev/shaders-react

> Versions 0.18.0 and below shipped as `@lovo/matter-react` before the project moved to the camp-dev org. Releases 1.0.0 through 3.9.0 from that history are renumbered here as 0.7.0 through 0.18.0.

## 0.18.0

## 0.17.0

## 0.16.0

## 0.15.0

### Patch Changes

- 0a26708: Reset the CPU-side phase accumulators at the scene's first painted frame, alongside the existing renderer-clock rewind. The accumulators integrate wall-clock deltas from mount, so the renderer's init latency used to carry into the first visible pose. A poster captured at t=0 never quite matched the frame that replaced it, and the slower the device, the bigger the jump. Shaders with sharp geometry made the drift obvious. The first frame anyone sees is now genuinely t=0.

## 0.14.0

### Minor Changes

- 4e3feab: Add `useBasePassUv`, which lets a post-process overlay register a transform that changes where the scene texture is sampled. A color pass only sees each pixel's finished color, so an effect that needs to resample the scene, such as Dither's pixelation snapping the sample coordinate to a cell grid, had no way to work. UV transforms compose in mount order, the same as `usePostProcessPass`, and a scene with none registered renders exactly as before.

## 0.13.0

### Minor Changes

- b97d558: Add `useAnimatableSpeed`, which turns a `speed` prop into a phase uniform accumulated on the CPU. Every frame it adds `speed * min(delta, 0.1)`, and the cap keeps the first frame after a hidden tab from replaying the whole gap. The shaders previously computed motion as elapsed time multiplied by speed, so any speed change, whether a slider drag or an animation signal, re-evaluated the whole elapsed history at the new rate and snapped the pattern. After 15 seconds on screen, the smallest slider step moved the canvas 41x more than a frame of steady motion. All eight animated registry components now read the accumulated phase instead. The accumulator applies the reduced-motion time scale, so a mid-session `prefers-reduced-motion` change also shifts tempo smoothly instead of jumping.

### Patch Changes

- 263403e: Add a phase-reset channel to `FrameScheduler`. Accumulators register a listener with `onPhaseReset()`, and `resetPhases()` rewinds them all to zero. Accumulated phase is wall-clock history, so a harness that needs a reproducible frame, such as the docs visual tests, has to rewind it together with the renderer clock. `useAnimatableSpeed` registers its phase uniform on the channel, which keeps a quantized shader like grain rendering the same seed on every machine.

## 0.12.0

### Minor Changes

- 6d24f42: Add `useAnimatablePoint`, a vec2 counterpart to `useAnimatableUniform`. Pass it an `[x, y]` pair or an animation signal and it keeps a point uniform current. `center` now accepts a signal on LinearGradient, RadialGradient, DotField, and Vignette, and LinearGradient's `angle` animates too. LinearGradient's direction vector used to be precomputed on the CPU inside an effect, where a signal had nothing to reach, so the shader now derives the direction from a scalar angle uniform. Two fixes ship with it. DotField and Vignette skipped the render request when `center` changed, so dragging it on an idle scene at `speed={0}` changed nothing until something else forced a frame. And swapping one animation signal for another now seeds the uniform from the new signal's current value instead of waiting for its first tick, in both hooks.

## 0.11.1

### Patch Changes

- 213518d: Fix animatable props doing nothing on a scene that has stopped rendering. `useAnimatableUniform` wrote the new value into its uniform but never told the frame scheduler to draw, so a component that had voted itself static, a gradient at `speed={0}` for example, accepted a prop change or a MotionValue tick and showed none of it. On the docs SimplexNoise page, Scale, Contrast, Balance, and Softness all went dead the moment speed reached 0. Every write now pokes the scheduler, which is a no-op unless the scene is genuinely idle.

## 0.11.0

### Minor Changes

- 0d924ce: Add `@camp-dev/shaders-react/gamut`, a second entry point carrying `useDisplayGamut` with no path to three. The root entry re-exports `ShaderScene`, which imports `three/webgpu`, and that reads `self` at module load, so a server-rendered page that only wanted to know whether the display can show P3 had to load the renderer to ask. The hook itself never needed it.

  Same reasoning as `@camp-dev/shaders/color`, and as the `./poster` subpath this package already shipped. Both subpaths now have a test that imports them under a bare Node environment, so three creeping back into either one fails there rather than in someone's server render.

## 0.10.0

## 0.9.0

### Major Changes

- 1b0bbcb: Remove `ShaderScene`'s `fallback` prop. This is a breaking change. Use the new `ShaderPoster` component from `@camp-dev/shaders-react/poster` instead. It renders in the initial HTML, with no three import, and dismisses when the wrapped `ShaderScene` paints its first frame.

## 0.8.0

- `ShaderScene` gains an `onFirstPaint?: () => void` prop, fired once when the shader's first frame is on screen. Consumers can dismiss a server-rendered poster without relying on the shader being opaque.

## 0.7.0

## 0.6.0

## 0.5.0

### Minor Changes

- 35274c3: Rename ambiguous `@camp-dev/shaders-react` public exports to clearer names. This is a breaking change before 1.0.

  - `useOverlayPass` → `usePostProcessPass` (and the paired type `OverlayTransform` → `PostProcessTransform`)
  - `useStaticHint` → `useStaticSceneHint`
  - `MonitorAnchor` (type) → `ShaderMonitorAnchor`

  **Migration:** update imports and call sites to the new names. Behavior is unchanged.

## 0.4.1

## 0.4.0

### Minor Changes

- 1c69220: Rename public API symbols to domain-accurate names.

  New primary names: `FrameScheduler`, `GpuRenderer`, `GpuBackend` (`@camp-dev/shaders`); `ShaderScene`, `ShaderSceneProps`, `ShaderContext`, `ShaderContextValue`, `useShaderContext`, `ShaderMonitor`, `ShaderMonitorProps`, `AnimatableSignal` (`@camp-dev/shaders-react`).

  The old names `MatterScheduler`, `MatterRenderer`, `MatterBackend`, `MatterScene`, `MatterSceneProps`, `MatterContext`, `MatterContextValue`, `useMatterContext`, `MatterMonitor`, `MatterMonitorProps`, and `MatterSignal` carry `@deprecated` JSDoc and continue to work. They will be removed no earlier than 0.5.0.

  **Migration:** replace the old names with the new ones in your imports and JSX. A one-pass find-and-replace is enough. Behavior is unchanged.

## 0.3.0

### Minor Changes

- c4cbb52: Add the overlay-component category. `MatterScene` now drives its render through `three/webgpu`'s `PostProcessing` pipeline, so child components register chained TSL transforms instead of each owning a material draw.

  The new hook is `useOverlayPass(transform, deps)`:

  ```ts
  import { useAnimatableUniform, useOverlayPass } from '@camp-dev/shaders-react';

  export function MyOverlay({ intensity }) {
    const intensityU = useAnimatableUniform(intensity);
    useOverlayPass(
      (input) => input.mul(intensityU), // takes upstream pixel, returns modified pixel
      [intensityU],
    );
    return null;
  }
  ```

  Mount the component inside any `<MatterScene>` and it composes onto the pipeline. Multiple overlays chain in mount order. Uniforms captured inside `transform` update in place and don't need to be in `deps`. Put only structural changes there, such as a mode toggle, so the transform gets re-registered.

  Two registry components ship with it, delivered through `@camp-dev/shaders-cli` copy-paste:

  - `<Grain>`, an additive or subtractive grain overlay.
  - `<Vignette>`, radial edge darkening, aspect-corrected so the mask is a circle on widescreen.

  **Breaking:** `<MeshGradient>` no longer accepts the `grain` and `grainSpeed` props. Stack `<Grain />` as a sibling inside `<MatterScene>` instead. Copies pulled before this release keep working, and a new pull or CLI refresh picks up the new shape. The MeshGradient docs page shows the new pattern.

### Patch Changes

- Updated dependencies [3856367]
  - @camp-dev/shaders@0.3.0

## 0.2.0

### Minor Changes

- No API changes. This package bumped alongside `@camp-dev/shaders` 0.2.0 because the three packages ship as a fixed version group. See [`@camp-dev/shaders`'s 0.2.0 changelog](../shaders/CHANGELOG.md#020) for the engine-level breaking change.

## 0.1.0

### Minor Changes

- Initial public release. React shader components on WebGPU and Three.js TSL.

  - `@camp-dev/shaders` is the framework-agnostic engine: TSL primitives such as `fbm`, `voronoi`, `colorRamp`, and `quantize`, a WebGPU renderer wrapper, and a scheduler that watches visibility and intersection.
  - `@camp-dev/shaders-react` is the React binding: `<MatterScene>` for the shared canvas, `useShaderMaterial` for r3f, and the `useCursor` and `useScroll` input hooks.
  - `@camp-dev/shaders-cli` is the shadcn-style copy-paste CLI, with `init`, `list`, `add`, and `update`. The default registry tracks the CLI's published version tag (`v0.1.0`), so component code is stable per release.

  Six components ship through `shaders-cli add <name>`: `linear-gradient`, `mesh-gradient`, `aurora`, `dot-field`, `noise-field`, and `waves`. Each component is yours to edit after copy-in.

  Requirements: Node 22 or newer for the CLI, a WebGPU-capable browser (Chromium-based, Safari Technology Preview, or Firefox Nightly with the flag), Three.js ^0.170, and React ^19.

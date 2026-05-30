# @lovo/matter-react

## 1.0.0

### Minor Changes

- c4cbb52: Add the overlay-component category. `MatterScene` now drives its render via `three/webgpu`'s `PostProcessing` pipeline so child components can register chained TSL transforms instead of each owning their own material draw.

  **New: `useOverlayPass(transform, deps)` hook**

  ```ts
  import { useOverlayPass, useAnimatableUniform } from "@lovo/matter-react";

  export function MyOverlay({ intensity }) {
    const intensityU = useAnimatableUniform(intensity);
    useOverlayPass(
      (input) => input.mul(intensityU), // takes upstream pixel, returns modified pixel
      [intensityU]
    );
    return null;
  }
  ```

  Mount the component inside any `<MatterScene>` and it composes onto the pipeline; multiple overlays chain in mount order. Uniforms captured inside `transform` update in place and don't need to be in `deps` — only put structural changes (mode toggles, etc.) in `deps` so the transform gets re-registered.

  **Registry-side ships (delivered via `@lovo/matter-cli` copy-paste):**

  - `<FilmGrain>` — additive or subtractive grain overlay.
  - `<Vignette>` — radial edge darkening, aspect-corrected so the mask is a circle on widescreen.
  - **Breaking:** `<MeshGradient>` no longer accepts `grain` / `grainSpeed` props. Stack `<FilmGrain />` as a sibling inside `<MatterScene>` instead. Existing copies pulled before this release keep working; new pulls / CLI refreshes pick up the new shape. The MeshGradient docs page has the new pattern.

### Patch Changes

- Updated dependencies [3856367]
  - @lovo/matter@1.0.0

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

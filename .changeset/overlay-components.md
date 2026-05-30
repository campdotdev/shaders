---
'@lovo/matter-react': minor
---

Add the overlay-component category. `MatterScene` now drives its render via `three/webgpu`'s `PostProcessing` pipeline so child components can register chained TSL transforms instead of each owning their own material draw.

**New: `useOverlayPass(transform, deps)` hook**

```ts
import { useOverlayPass, useAnimatableUniform } from '@lovo/matter-react'

export function MyOverlay({ intensity }) {
  const intensityU = useAnimatableUniform(intensity)
  useOverlayPass(
    (input) => input.mul(intensityU), // takes upstream pixel, returns modified pixel
    [intensityU],
  )
  return null
}
```

Mount the component inside any `<MatterScene>` and it composes onto the pipeline; multiple overlays chain in mount order. Uniforms captured inside `transform` update in place and don't need to be in `deps` — only put structural changes (mode toggles, etc.) in `deps` so the transform gets re-registered.

**Registry-side ships (delivered via `@lovo/matter-cli` copy-paste):**

- `<FilmGrain>` — additive or subtractive grain overlay.
- `<Vignette>` — radial edge darkening, aspect-corrected so the mask is a circle on widescreen.
- **Breaking:** `<MeshGradient>` no longer accepts `grain` / `grainSpeed` props. Stack `<FilmGrain />` as a sibling inside `<MatterScene>` instead. Existing copies pulled before this release keep working; new pulls / CLI refreshes pick up the new shape. The MeshGradient docs page has the new pattern.

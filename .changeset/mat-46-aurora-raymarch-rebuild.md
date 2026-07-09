---
"@lovo/matter-cli": minor
---

Aurora is rebuilt as a raymarched volumetric sky-band (breaking, pre-1.0): curtains accumulate translucent emission over ~40 slices, giving soft edges, filament structure, and parallax depth. The `layers: AuroraLayer[]` prop is removed — color now comes from an altitude ramp via `stops: ColorStop[]` (LinearGradient convention), plus new `colorSpace`/`hueInterpolation` props. `driftX`/`driftY` collapse into `drift` (altitude-sheared travel) and `densityX`/`densityY` into `density`. Re-fetch the aurora template to upgrade; existing copies keep working as-is.

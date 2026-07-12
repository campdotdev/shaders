---
"@lovo/matter-cli": minor
---

Aurora rebuilt from the ground up as a reference-shaped raymarch (breaking, pre-1.0): triangle-noise fbm field, 60 depth slices with per-pixel jitter (banding fixes), depth-indexed `stops` ramp so near and far ribbons glow different colors, and smoother drift-free motion. Breaking: `drift`, `direction`, and `density` props are removed; `falloff` is now a screen-space reveal (1 fills the canvas, 0 hides the curtain). Re-fetch the aurora template to upgrade; existing copies keep working as-is.

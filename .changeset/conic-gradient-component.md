---
'@lovo/matter-cli': minor
---

Add ConicGradient: a color sweep around a center point, following CSS `conic-gradient` conventions. The sweep runs clockwise from 12 o'clock and `angle` rotates it clockwise, the opposite direction from LinearGradient and RadialGradient's counterclockwise `angle`. Stop positions auto-space when omitted, and the default palette repeats its first color as its last stop so the wheel closes without a seam; palettes that don't will show a hard edge where the sweep wraps. `repeat` above 1 turns the sweep into a pinwheel of sectors, and `speed` spins the whole thing, one full rotation per second at 1 with `repeat` at 1. Interpolation goes through the shared `colorSpace`/`hueInterpolation` props, defaulting to oklab.

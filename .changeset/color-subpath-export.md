---
'@lovo/matter': minor
---

Adds `@lovo/matter/color`, a second entry point for the CPU-side color math: `parseColorString`, the OKLab and OKLCH conversions, the gamut helpers, and the sRGB transfer functions. The root entry still exports all of them, so nothing has to move. The difference is that the subpath has no path to three, so it can be imported during a server render. The root entry cannot, because it reaches the renderer and `three/webgpu` reads `self` at module load.

`parseColorString` now throws on input it used to mangle. Components that aren't numbers ran through `parseFloat` to NaN and came back as `[NaN, NaN, NaN]`, which reached the GPU as a blank shader with a clean console. Hex is checked for format now too: it takes `#rrggbb` and `#rrggbbaa` (alpha parsed and dropped, the same way `oklch()` and `oklab()` already handle it) and throws on anything else. `#abcdefgh` used to slice its first six digits and return a confidently wrong color.

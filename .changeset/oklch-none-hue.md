---
'@camp-dev/shaders': patch
---

`parseColorString` and `parseOklchString` now read `none` as an `oklch()` hue, as CSS does, and treat it as 0. Before, `oklch(0.6 0 none)` threw.

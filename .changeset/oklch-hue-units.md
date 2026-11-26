---
'@camp-dev/shaders': patch
---

`parseColorString` and `parseOklchString` now read an `oklch()` hue written in `turn`, `grad`, or `rad`, as CSS does, and return it in degrees. Before, only a bare number or a `deg` suffix parsed, and any other unit threw.

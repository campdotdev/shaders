---
'@camp-dev/shaders': patch
---

`Vignette` now repaints a still scene when its `color` changes. Before, the new color reached the screen only on the next frame something else asked for.

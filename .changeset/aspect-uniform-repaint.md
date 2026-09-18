---
'@camp-dev/shaders': patch
---

Fix aspect-corrected components drawing at a 16:9 ratio on a static scene until the first resize. Every component that keeps circles round or grids square on a wide canvas now reads the ratio through one hook that requests a frame when the canvas size arrives. DotField's resolution and the pixel-ratio uniforms on Dither, Dissolve, and LedWall request a frame the same way.

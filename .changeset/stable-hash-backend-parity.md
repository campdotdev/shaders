---
'@lovo/matter': minor
---

Seeded randomness now renders the same pattern on the WebGPU and WebGL2 backends. three's TSL `hash()` writes its PCG constants as float literals, which GLSL rounds to a different hash than WGSL computes, so the same `seed` produced a different Voronoi layout in Safari than in Chrome. The new `stableHash` and `stableHashUint` exports run the same PCG with integer-typed constants and chain hash streams u32-to-u32, and `voronoiCells`, `grain`, `metaballs`, and `ditherPattern` now draw from them.

One-time visual break: deriving seeds from the raw hash word re-rolls every seeded layout once, on both backends. Any `seed` value renders a new (stable) pattern after this release.

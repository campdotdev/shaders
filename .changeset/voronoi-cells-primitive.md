---
'@lovo/matter': minor
---

Add `voronoiCells`: the two-pass cell Voronoi (Inigo Quilez's ldl3W8) as a Tier 2 primitive. It returns three fields per pixel: `edgeDistance` (exact distance to the nearest cell border, via perpendicular bisectors, which is what makes constant-width borders possible), `seedOffset` (vector to the cell's seed), and `hash` (a stable per-cell random for coloring). Options animate the field: `time` is a pre-integrated phase, `jitter` scatters seed anchors off the grid, and `drift` orbits each seed within the room its cell offers, so the 3x3 neighbor search stays valid at any amplitude. The sibling distance-only `voronoi` (Worley) primitive is unchanged.

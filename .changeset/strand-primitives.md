---
'@camp-dev/shaders': minor
---

Add the strand primitives, which draw fine curves of light as a mesh in a Mode 2 scene. Your camera draws the strands, so they move with your scene and pass behind your meshes.

- `createStrandGeometry({ strands, samples })` builds a mesh of strips, one per strand.
- `strandAttributes()` returns each vertex's place on its strand as TSL nodes: `across`, `seed`, `along`, and `side`.
- `extrudeStrand(path, { strandWidth })` widens a path into a strip `strandWidth` CSS pixels thick at any distance from the camera. The path maps `along`, `across`, and `seed` to a 3D point. It returns a clip-space `position` and the signed `distance` in CSS pixels from the strand's center line.
- `strandProfile(distance, strandWidth)` is the Gaussian falloff across a strand. A strand thinner than 3 CSS pixels keeps that width and dims. `MIN_STRAND_HALF_WIDTH` exports that floor as a half-width.

`useShaderMaterial` takes the two nodes a strand needs. Its build callback returns a color node, as before, or `{ color, vertex }`, and the `vertex` node becomes the material's `vertexNode`. A new second argument, `{ blending: 'additive' }`, makes overlapping meshes sum into light. An additive material is transparent and writes no depth. Existing calls work unchanged.

`createRenderer` takes a `depth` option. `depth: true` gives the canvas a depth buffer on WebGPU, for a scene of your own where a nearer mesh hides a farther one. It defaults to `false`.

# A primitive can be geometry and a vertex node, and its path is 3D

Status: Accepted. Nothing is built yet. The Ribbon spec, SHA-330, lands it, starting with the strand primitives in SHA-331.

Every Tier 2 primitive so far is a TSL function for the fragment stage: nodes in, nodes out. A ribbon is different. It is dozens of strands, each a few pixels wide, and the look depends on where strands cross. Drawn in a fragment shader, as WaveLines draws its lines, every pixel would search every strand for the nearest one. The distance to a twisting curve has no closed form, so each strand's part of that search is a loop of its own, run at every pixel on every frame.

We chose to draw strands as geometry and to export that geometry as primitives. `createStrandGeometry` builds a mesh of strips, and `strandAttributes` reads each vertex's place on its strand. `extrudeStrand` widens a path into a strip in pixels. It returns a clip-space position and the signed distance in pixels from the strand's center line. These sit beside the math primitives `ribbonPath`, `strandProfile`, and `travelingPulse`. A path returns a 3D point. `extrudeStrand` projects that point through whatever camera draws the mesh, then widens it. In Mode 1 the camera is orthographic, so a ribbon is flat. In Mode 2 it is the user's camera, so a ribbon sits in their scene and moves with it.

## Considered options

- **Export only the math, and keep the geometry inside the engine until a second consumer needs it.** Rejected because Mode 2 exists for users who already have a 3D scene, and strands that live in that scene are what those users would reach for. If the engine kept the geometry private, the r3f guide would tell them to extract one more thing by hand. ADR 0005 builds only what a composition needs, and the Ribbon needs this geometry either way. Exporting it adds public API, not new work.
- **Paths that return canvas positions.** Rejected because a Mode 2 ribbon would then be a flat overlay that ignores the user's camera and their meshes.
- **The strand mesh drawn straight into the scene pass.** Rejected because additive blending sums one strand at a time, so no shader ever sees the total light at a crossing. The Source needs that total to tone-map its light in glow mode and to turn light into coverage in ink mode.

## Consequences

- The Ribbon Source draws its strands in a pre-pass, into its own half-float target, and shows them through its one quad, as Aurora shows its field. The scene pass still holds one quad per Source, so it still needs no depth buffer, as the no-depth gotcha describes.
- WebGL2 draws into a half-float target only with `EXT_color_buffer_float`, which `canRenderTo` checks. Without it, the pre-pass draws into an 8-bit target, which every backend can draw into. Light at a crossing then clips at 1 and bands, so glow mode loses the range it tone-maps, but the Ribbon still draws. Aurora falls back by working out its field inline. The Ribbon cannot, because the per-pixel strand search is the cost this ADR avoids.
- `useShaderMaterial` widens. Its build callback returns a color node, as now, or `{ color, vertex }`. A second argument sets `blending` to `'normal'` or `'additive'`. Additive also turns off depth writes, so strands never hide each other where they cross. Existing callers change nothing.
- `extrudeStrand`'s position goes to `vertexNode`. In three 0.170, a set `vertexNode` replaces three's whole position setup. At a three upgrade, check that it still does.
- A path must be a pure function of its inputs, time included. When the cursor sweeps across a ribbon, the Ribbon finds the strands it crossed by running the path again at the pulse's launch time, in the vertex stage. No JS copy of the ribbon's math exists to drift from the TSL.
- In Mode 2, strands depth-test against the user's meshes. Strand geometry uses only vertex attributes and fixed loops, so every composition built on it still renders on the WebGL2 fallback that ADR 0005 requires.

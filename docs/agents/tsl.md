# Writing TSL in the shaders package

Read this before you write or change TSL, uniforms, materials, shader hooks, the renderer, or the output stage in `packages/shaders`. The first section is the process for building a shader with the author. The rest are gotchas, grouped by where they bite. Each gotcha heading starts with its name, such as "the vec-uniform gotcha", and code comments cite it by that name. Keep the name when you edit a heading.

## Build a shader in gated phases

Shaders doubles as a shader-learning project for its author, who is fluent in React, TypeScript, and build tooling. The gap is GPU concepts: uniforms, sampler space, noise types, domain warping, smoothstep, and render passes. Spend your explanation there.

1. At the start, ask who types the code. The historical default is co-writing. You describe a small chunk, with the concept, the exact code, and where it goes, and the author applies it by hand. Recent sessions have shifted to you writing the code and explaining every line. The phase gates stay either way.
2. Before a feel feature, such as variance, patchiness, or a vibrancy layer, hold a short design conversation. A prop bolted onto a shader at a gate without one has failed before.
3. Translate the design into TSL one step at a time, and explain each TSL and GPU concept where it first appears. Change existing TSL only when the step calls for it, and say so when you do.
4. End every phase at something the author can open in the docs site or a dev route. Then stop. Show the diff, teach the new concepts in about three minutes, and wait for the author to react in the dev server before you start the next phase. A clean compile is not approval.
5. If the shader collects feel constants, such as bend amounts, noise frequencies, or dapple strengths, build a temporary tuning rig. Route the constants through a temporary `tuning` prop that rides uniforms, so the sliders move without a material rebuild, and wire it to a demo-panel section titled "Tuning (dev)". At the defaults-tuning gate, delete the prop, its params, and the panel section, and bake the landed values into named constants.

Every component folder holds at least two files. `components/<name>/<name>.tsx` is the wrapper, which holds props, uniforms, and mesh lifecycle in about 80 lines. `components/<name>/shader.tsx` holds the TSL shader function. Some folders add helper modules and their tests beside the pair, such as `decay.ts` and `stroke.ts` in `cursor-ripple` and `marks.ts` in `dot-field`.

## Keep the material stable

### The uniform-stability gotcha: push prop changes through uniforms

Hold a live value in a stable `Vector2` or `Vector3` from `useMemo(..., [])`, wrap it once in `uniform(vec)`, and write the prop into it with `vec.set(...)` in a light effect. The material effect then depends only on stable references and runs once per mount.

The exceptions are props baked into the shader as literals. Every `colorRamp` consumer, such as `LinearGradient`, `WaveLines`, and `Voronoi`, rebuilds the material when `colors` or `stops` change, because `colorRamp` takes literal stop positions and the components pass literal colors. `GodRays` rebuilds on its baked layer colors, and `DotField` on its mark shapes. On `WaveLines`, the largest ramp at 16 colors, one rebuild is a brief but visible stutter. The demo panels commit colors on pointer release to keep that acceptable, as `docs/agents/docs-site.md` describes.

### The array-props gotcha: give arrays a stable proxy in effect deps

A wrapper default such as `center = [0.5, 0.5]` allocates a new array on every render, and so does an inline array in JSX. Never list a raw array in a heavy effect's deps. Stringify it, as in `colors.join('|')`, or route a fixed-size tuple through a `Vector2` or `Vector3` uniform. `useAnimatablePoint`, which vignette's `center` goes through, is the model for the second form.

### The build-callback gotcha: `useShaderMaterial(build)` rebuilds when `build` changes

The rebuild on a new `build` reference is deliberate, and a test asserts it. Memoize the build callback or hoist it out of the component, and keep the dependency.

### The bare-uniform-write gotcha: a bare uniform write repaints nothing

The scene renders on demand. Once every component votes static, the frame loop parks after one flush, and a value written straight into `uniform.value` waits on the GPU until something else asks for a frame. After any raw write, including `Vector2.set` on a vec uniform, call `scheduler.requestRender()`. `useAnimatableUniform` already calls it after each write.

For the aspect ratio, use `useAspectUniform`. It exists because twelve components wired `useResize` to an aspect uniform by hand without the call. `useResize` returns a stub on a component's first effect pass and fills in one render later, after the flush frame, so on a static scene such as the Components banner the 12:1 canvas rendered at the 16:9 fallback until a resize.

### The Strict Mode gotcha: hooks that own disposables must survive a remount

Create, attach, and dispose in one `useEffect`. `react/hooks/use-cursor/use-cursor.ts` is the canonical pattern.

## Write TSL math that compiles correctly

### The vec-uniform gotcha: pass vec uniforms as arguments, never as chained receivers

`uv().sub(cursorUniform)` works. Chaining a method off a raw vec2 or vec3 uniform node typechecks and then produces wrong values on the GPU with no error. Build expressions from `uv()` and `vec2(...)`, and pass vec uniforms as arguments. Scalar float uniforms are safe as chained receivers, and `wave-lines/shader.tsx` chains them throughout.

### The running-minimum gotcha: use a real loop, never a select() chain

A running minimum or argmin written as an unrolled JS `select()` chain hangs the tab before the shader compiles. Each step references the accumulator twice, once in the comparison and once in the else branch. Three's `getNodeType` recursion has no memoization across references, so type resolution goes exponential in the depth of the chain. `voronoiCells`' 34-step chain froze headless Chromium. Adding `.toVar()` per step does not help, because a VarNode delegates its type lookup inward.

Write the loop with TSL's imperative side instead: `Fn`, `Loop` or `If`, and `.assign()`. That emits a real GPU `for` loop, which works on WebGPU and on the WebGL2 fallback with fixed integer bounds. `primitives/voronoi/voronoi-cells.ts` is the model, and three's own MaterialX worley uses the same pattern. Additive chains such as fbm and wave-lines are safe, because each step references the accumulator once. The fbm note about having no clean loop primitive is about dynamic counts, such as uniform-driven octaves.

### The 128-second-compile gotcha: keep heavyweight noise out of loops

Never call `mx_noise`, `simplexNoise`, or another heavyweight noise primitive inside a loop that runs many times per pixel. `voronoiCells` once sampled `simplexNoise` twice per neighbor, 68 calls per pixel, and the WebGL2 backend's synchronous GLSL compile took 128 seconds under software GL. CI's headless Chromium and local Playwright both run software GL, so every visual test looked like a hung tab.

The trap hides during development. Noise multiplied by a constant 0 is dead code the GLSL compiler drops, and only a uniform-driven amplitude forces the full compile. When loop code needs randomness, build it from `stableHash` and `stableHashUint`, as `cellRandom` and `seedInCell` in `voronoi-cells.ts` do. Their random phases drive a sine orbit that gives the same feel and compiles in milliseconds.

### The seeded-randomness gotcha: use stableHash and stay integer until the end

Never use three's `hash()` for seeded randomness. It writes its PCG constants as bare numbers, so codegen emits float literals. WGSL evaluates them at 64-bit and recovers the exact integers. GLSL rounds them into the 24-bit mantissa of an f32, so 747796405 becomes 747796416 and the two backends run different hashes (MAT-92).

The second trap survives exact constants. `hash(x).mul(0xffffff).toUint()` crosses from u32 to f32 and back. The two compilers often disagree by one ULP on the float leg, and the truncation turns that ULP into a different integer, which reseeds everything downstream. On WebGL2 it showed up as whole rows re-rolled. Chain seeds with `stableHashUint`, which stays u32 to u32, and take `stableHash`'s float only as a final output, where one ULP is invisible. Both live in `primitives/stable-hash/`.

To verify a change here, diff `/components/voronoi?visualTest=1` captures across both backends. Expect differences only at single vertex specks, never in cell-shaped regions.

### Type notes

- `colorNode` rejects `ShaderNodeObject<unknown>`. Type it as `Node | ShaderNodeObject<Node>`.
- `uniform(vec2(...))` has no Vector2 mutators. Use `uniform(new Vector2(...))` when you need `.set()`.
- In three 0.170 and later, `setClearColor` takes only a `Color`. Convert with `new Color(...)`.

## The output stage owns dither, gamut, and the final quad

### The scene-dither gotcha: dither and gamut are scene-wide

`createOutputStage` in `runtime/output-stage/` sets `outputMaterial.fragmentNode = dither(renderOutput(composed))` with the output color transform off, and `ShaderScene` owns the stage. Dithering happens once, in display space. Never add `dither()` to a component's `colorNode`. The scene would dither twice, and the second pass would run in linear space. The exported `dither()` is for Mode 2 only. Gamut is scene-level for the same reason, so keep both controls off per-component demo panels.

### The shared-quad gotcha: PostProcessing shares one quad across scenes

The output stage exists because of this bug. In three 0.170, `PostProcessing` keeps `_quadMesh` and `_material` as module-level constants, and each instance's `update()` writes its output node into that one material. With two `<ShaderScene>`s on a page, both renderers draw whichever scene updated last. A fresh load hides the bug. It shows when a second scene mounts while the first is still animating: the Components banner drew every demo page's shader after a client-side navigation. `createOutputStage` owns a quad and a `NodeMaterial` per instance, and it mirrors what `PostProcessing.render` does with the tone-mapping and output-color-space toggles.

Neither headless mode shows this bug. Headless falls back to WebGL2, and the software WebGPU adapter captures black. Reproduce it in headed Chromium launched with `--enable-unsafe-webgpu --ignore-gpu-blocklist`, on a localhost page, because `navigator.gpu` needs a secure context. At any three upgrade, check whether `PostProcessing` has a quad per instance, and switch back if it does.

### The premultiplied-alpha gotcha: light-emitting layers dim quadratically

A component whose `colorNode` emits light-contribution rgb with coverage alpha, the way Aurora does, gets multiplied by alpha twice under the default `NormalBlending`, and soft wisps dim quadratically. Set `material.premultipliedAlpha = true`.

## Color

- `colorSpace` sets the interpolation space. A component takes it only if it computes a midpoint between two colors. Being additive is not the test: Aurora is additive, but it blends along a depth-indexed ramp, so it takes `colorSpace`.
- Components default `colorSpace` to `oklab`. The primitives in `primitives/color-space/` differ from each other: `colorRamp` defaults to `linear`, and `mixColor` defaults to `oklab`. Pass the space explicitly.
- `hueInterpolation` matters only in the cylindrical spaces `oklch`, `lch`, `hsl`, and `hsv`. Every component with `colorSpace` takes it except `WaveLines`, which uses `colorRamp`'s default arc.
- To list the components that take either prop, run `grep -rl colorSpace packages/shaders/src/components/*/`, and the same for `hueInterpolation`. Don't keep a hand-written list. One went stale three times.
- `gamut` is a `<ShaderScene>` prop, typed `'auto' | 'srgb' | 'p3'`. The default, `'auto'`, reads `(color-gamut: p3)` and re-resolves when the display changes.
- Wide-gamut input is only a decode. `parseColor` turns `oklch()` and `oklab()` strings into unclamped linear sRGB, with no mixing prop involved. `colorSpace` is the mixing math, and `gamut` is the output framebuffer.
- Wide-gamut P3 output reaches into renderer internals, because three 0.170 has no native WebGPU P3 path. `runtime/create-renderer/gamut.ts` registers the ColorSpaces addon through `ColorManagement.define` and calls `configure()` on the `GPUCanvasContext` again by hand. Delete that manual reconfigure when a three upgrade adds the path. Headless Playwright cannot pixel-assert P3, so the `parseColorString` unit tests prove the decode, and you check the widening by eye on a P3 display.
- The `hsl` and `hsv` spaces clamp to sRGB first, because a `pow()` on a negative channel breaks WGSL constant evaluation.
- When any of this changes, update the user guide at `apps/docs/content/docs/guides/color.mdx`.

## Debugging

### The renderer-size gotcha: a cropped or zoomed shader means a wrong renderer size

When the output looks cropped, compressed, or zoomed, compare `renderer.getSize()` with the canvas client size before you look at uv or camera math. The renderer once stuck at the canvas default of 300×150, and a logical-size guard plus a `ResizeObserver` fixed it. Headless Playwright falls back to WebGL2 here, because `navigator.gpu` exists but device init fails.

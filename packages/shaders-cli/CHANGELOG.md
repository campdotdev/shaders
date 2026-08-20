# @mattermix/shaders-cli

## 3.9.0

## 3.8.0

### Minor Changes

- 5086b6c: Add Blobs: soft gooey metaballs that drift around the center, merging and splitting as they meet. Up to 20 blobs with per-blob size variation, a fractional animatable count, softness from crisp gel to mist, depth shading along the color ramp, and a transparent background so the goo stacks over any other layer. Install with `matter add blobs`.

### Patch Changes

- 680baef: Capture posters on the WebGPU backend. Headless Chromium silently fell back to WebGL2, and hash-driven shaders lay out differently per backend, so posters for components like Voronoi and Blobs never matched what the live shader shows. The poster command now launches Chromium with WebGPU enabled (ANGLE Metal on macOS), falling back to WebGL2 only where WebGPU genuinely can't initialize.

## 3.7.0

### Minor Changes

- 830ceae: Add FractalNoise: a layered multi-octave noise background with a style dial running from soft clouds through folded smoke billows to crisp vein networks, octave and detail dials for how much fine grain shows, and the shared ramp shaping set (stops, contrast, balance, softness, colorSpace, hueInterpolation). Install with `matter add fractal-noise`.

## 3.6.0

### Minor Changes

- 0a26708: Add Voronoi: a cellular mosaic of colored panes around drifting seed points, cut by constant-width borders, like backlit stained glass. Each cell picks its color from `stops` by a stable per-cell random; `steps` posterizes per palette segment, so 1 snaps every cell to exactly your stop colors and higher values add blends between neighboring stops. `shading` deepens each pane toward its borders along the ramp, following the cell's polygon rather than circling its seed point, and `glow` adds the cell's own color back as light hugging the borders. The glow is additive, so bright panes read as lit rather than painted. Seeds glide on sine orbits at one shared frequency with per-cell random phases: `irregularity` scatters their anchors (0 is a perfect grid), `drift` sets the orbit radius, and anchors only scatter within the room the orbit leaves free, so seeds never leave their cells and the borders stay glitch-free at any drift. `colorSpace`/`hueInterpolation` govern the ramp and the border blend, and every numeric dial accepts an animation signal.

## 3.5.0

## 3.4.0

### Minor Changes

- 6c711d6: Add ConicGradient: a color sweep around a center point, following CSS `conic-gradient` conventions. The sweep runs clockwise from 12 o'clock and `angle` rotates it clockwise, the opposite direction from LinearGradient and RadialGradient's counterclockwise `angle`. Stop positions auto-space when omitted, and the default palette repeats its first color as its last stop so the wheel closes without a seam; palettes that don't will show a hard edge where the sweep wraps. `repeat` above 1 turns the sweep into a pinwheel of sectors, and `speed` spins the whole thing, one full rotation per second at 1 with `repeat` at 1. Interpolation goes through the shared `colorSpace`/`hueInterpolation` props, defaulting to oklab.
- 6c711d6: Add GodRays: soft rays of light streaming from an origin point, drawn as the product of two flowing noise fields so the beams flicker and drift instead of sweeping past like a rigid fan. Each color in `colors` (2 to 5) gets its own decorrelated ray layer, later colors finer-textured so they read as deeper planes, and the layers add their light over a transparent background, so stack the component above a dark layer in the scene. `center`, `angle`, `spread`, and `radius` aim and size the fan; the default parks the source just above the top edge with the cone wide open, so the frame does the cropping. `density` sets how many rays fit around a revolution, `diffusion` runs them from distinct beams to a soft wash, `patchiness` chops them into drifting dashes, and `glowRadius`/`glowIntensity` put a bright disc at the source. Every dial accepts an animation signal.
- 6c711d6: Add `repeat` to LinearGradient: how many times the stops run across the gradient's span. The default of 1 keeps the existing single pass; above 1 the pattern tiles past both ends, so stripes run edge to edge at any angle. Each pass snaps back to the first stop, so match your first and last stops unless you want a visible edge at every stripe boundary. `speed` changes character with it: a single pass keeps the existing back-and-forth drift, while repeated stripes march steadily in the angle's direction. Values at or below 1 render as a single pass. Accepts a static value or an animation signal.

## 3.3.0

### Patch Changes

- 37a7367: Fix `matter add` installing components that don't compile. Every component is split across a wrapper and a shader, and all but `grain` also import helpers from `utils/color.ts`, but a registry entry only ever named one file — so `matter add radial-gradient` wrote a wrapper importing `./shader` and `../utils/color` and left both behind. Every component has been broken this way since the first one shipped. Registry entries now carry a `files` list covering the whole set, and `add` writes all of it. A file already on disk holding exactly what would be written is skipped rather than treated as a conflict, so adding a second component that shares `utils/color.ts` no longer fails on a file the CLI wrote itself; one that has diverged still stops the install and asks for `--force`. `add` also stops trusting a remote index about where its files should land: it refuses any registry path that resolves outside the configured components directory, whether by `../` segments or through a symlink, and refuses to write to a target that is itself a symbolic link. Content comparison now ignores line-ending style, so a Windows checkout with `core.autocrlf` no longer reports its own files as modified.

## 3.2.1

## 3.2.0

## 3.1.0

### Minor Changes

- b7c6b53: Aurora rebuilt from the ground up as a reference-shaped raymarch (breaking, pre-1.0): triangle-noise fbm field, 60 depth slices with per-pixel jitter (banding fixes), depth-indexed `stops` ramp so near and far ribbons glow different colors, and smoother drift-free motion. Breaking: `drift`, `direction`, and `density` props are removed; `falloff` is now a screen-space reveal (1 fills the canvas, 0 hides the curtain). Re-fetch the aurora template to upgrade; existing copies keep working as-is.

## 3.0.0

### Minor Changes

- 76dd33d: Aurora is rebuilt as a raymarched volumetric sky-band (breaking, pre-1.0): curtains accumulate translucent emission over ~40 slices, giving soft edges, filament structure, and parallax depth. The `layers: AuroraLayer[]` prop is removed — color now comes from an altitude ramp via `stops: ColorStop[]` (LinearGradient convention), plus new `colorSpace`/`hueInterpolation` props. `driftX`/`driftY` collapse into `drift` (altitude-sheared travel) and `densityX`/`densityY` into `density`. Re-fetch the aurora template to upgrade; existing copies keep working as-is.

## 2.0.0

### Patch Changes

- `poster` gains a `--background <color>` option to composite the shader onto a given CSS color before capture (used for transparent shaders like Aurora). Defaults to the harness background when omitted.

## 1.0.0

## 0.6.0

## 0.5.0

### Minor Changes

- 0299ddb: Rename ambiguous CLI flags and the config key to spelled-out names (BREAKING, pre-1.0):

  - `list`/`add`/`update`: `--ref` → `--reference`
  - `poster`: `--from` → `--source`, `--out` → `--output`, `--type` → `--format`, `--export` → `--export-name`, `--time` → `--capture-delay`
  - `shaders.config.json`: removed the `tsx` boolean key (it was validated but never read by any command)

  Kept: `--registry`, `--quality`, `--width`, `--height`, `--force`, and the config keys `componentsDir`, `registryUrl`, `aliases`.

  Migration: update any scripts that pass the old flags. You can delete the `tsx` key from your `shaders.config.json` if present — it is no longer used (unknown keys are ignored). Re-running `shaders-cli init` regenerates a config without it.

## 0.4.1

## 0.4.0

## 0.3.0

## 0.2.0

### Minor Changes

- No API changes. Bumped alongside `@mattermix/shaders` 0.2.0 because the three packages ship as a fixed version group. See [`@mattermix/shaders`'s 0.2.0 changelog](../matter/CHANGELOG.md#020) for the engine-level breaking change.

## 0.1.0

### Minor Changes

- Initial public release of Matter — React shader components on WebGPU + Three.js TSL.

  **`@mattermix/shaders`** — Framework-agnostic engine: TSL primitives (`fbm`, `voronoi`, `colorRamp`, `quantize`, …), WebGPU renderer wrapper, visibility/intersection-aware scheduler.

  **`@mattermix/shaders-react`** — React binding: `<MatterScene>` (shared canvas), `useShaderMaterial` (r3f-compatible), input hooks (`useCursor`, `useScroll`).

  **`@mattermix/shaders-cli`** — shadcn-style copy-paste CLI: `init`, `list`, `add`, `update`. Default registry tracks the CLI's published version tag (`v0.1.0`) so component code is stable per release.

  **v1 components** (via `shaders-cli add <name>`): `linear-gradient`, `mesh-gradient`, `aurora`, `dot-field`, `noise-field`, `waves`. Each component is yours to edit after copy-in.

  **Requirements:** Node 22+ for the CLI. WebGPU-capable browser (Chromium-based, Safari TP, Firefox Nightly with the flag). Three.js ^0.170. React ^19.

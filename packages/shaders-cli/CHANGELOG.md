# @camp-dev/shaders-cli

> Versions 0.18.0 and below shipped as `@lovo/matter-cli` before the project moved to the camp-dev org. Releases 1.0.0 through 3.9.0 from that history are renumbered here as 0.7.0 through 0.18.0.

## 0.18.0

## 0.17.0

### Minor Changes

- 5086b6c: Add Blobs, soft gooey metaballs that drift around the center, merging and splitting as they meet. Up to 20 blobs, with per-blob size variation, a fractional animatable count, softness running from crisp gel to mist, depth shading along the color ramp, and a transparent background so the goo stacks over any other layer. Install it with `shaders-cli add blobs`.

### Patch Changes

- 680baef: Capture posters on the WebGPU backend. Headless Chromium silently fell back to WebGL2, and hash-driven shaders lay out differently per backend, so posters for components like Voronoi and Blobs never matched what the live shader shows. The `poster` command now launches Chromium with WebGPU enabled, through ANGLE Metal on macOS, and falls back to WebGL2 only where WebGPU genuinely cannot initialize.

## 0.16.0

### Minor Changes

- 830ceae: Add FractalNoise, a layered multi-octave noise background. Its style dial runs from soft clouds through folded smoke billows to crisp vein networks, octave and detail dials set how much fine grain shows, and it takes the shared ramp shaping props: `stops`, `contrast`, `balance`, `softness`, `colorSpace`, and `hueInterpolation`. Install it with `shaders-cli add fractal-noise`.

## 0.15.0

### Minor Changes

- 0a26708: Add Voronoi, a cellular mosaic of colored panes around drifting seed points, cut by constant-width borders, like backlit stained glass. Each cell picks its color from `stops` by a stable per-cell random. `steps` posterizes per palette segment, so 1 snaps every cell to exactly your stop colors and higher values add blends between neighboring stops. `shading` deepens each pane toward its borders along the ramp, following the cell's polygon rather than circling its seed point, and `glow` adds the cell's own color back as light hugging the borders. The glow is additive, so bright panes read as lit rather than painted. Seeds glide on sine orbits at one shared frequency with per-cell random phases: `irregularity` scatters their anchors, where 0 is a perfect grid, and `drift` sets the orbit radius. Anchors only scatter within the room the orbit leaves free, so seeds never leave their cells and the borders stay glitch-free at any drift. `colorSpace` and `hueInterpolation` govern the ramp and the border blend, and every numeric dial accepts an animation signal.

## 0.14.0

## 0.13.0

### Minor Changes

- 6c711d6: Add ConicGradient, a color sweep around a center point that follows CSS `conic-gradient` conventions. The sweep runs clockwise from 12 o'clock and `angle` rotates it clockwise, the opposite direction from LinearGradient and RadialGradient's counterclockwise `angle`. Stop positions auto-space when omitted, and the default palette repeats its first color as its last stop so the wheel closes without a seam. A palette that doesn't repeat it shows a hard edge where the sweep wraps. `repeat` above 1 turns the sweep into a pinwheel of sectors, and `speed` spins the whole thing, one full rotation per second at 1 with `repeat` at 1. Interpolation goes through the shared `colorSpace` and `hueInterpolation` props, defaulting to oklab.
- 6c711d6: Add GodRays, soft rays of light streaming from an origin point, drawn as the product of two flowing noise fields so the beams flicker and drift instead of sweeping past like a rigid fan. Each of the 2 to 5 colors in `colors` gets its own decorrelated ray layer, and later colors are finer-textured so they read as deeper planes. The layers add their light over a transparent background, so stack the component above a dark layer in the scene. `center`, `angle`, `spread`, and `radius` aim and size the fan, and the default parks the source just above the top edge with the cone wide open, so the frame does the cropping. `density` sets how many rays fit around a revolution, `diffusion` runs them from distinct beams to a soft wash, `patchiness` chops them into drifting dashes, and `glowRadius` and `glowIntensity` put a bright disc at the source. Every dial accepts an animation signal.
- 6c711d6: Add `repeat` to LinearGradient, which sets how many times the stops run across the gradient's span. The default of 1 keeps the existing single pass. Above 1 the pattern tiles past both ends, so stripes run edge to edge at any angle. Each pass snaps back to the first stop, so match your first and last stops unless you want a visible edge at every stripe boundary. `speed` changes character with it: a single pass keeps the existing back-and-forth drift, while repeated stripes march steadily in the angle's direction. Values at or below 1 render as a single pass. Accepts a static value or an animation signal.

## 0.12.0

### Patch Changes

- 37a7367: Fix `shaders-cli add` installing components that don't compile. Every component is split across a wrapper and a shader, and all but `grain` also import helpers from `utils/color.ts`, but a registry entry only ever named one file. `shaders-cli add radial-gradient` wrote a wrapper importing `./shader` and `../utils/color` and left both behind, and every component had been broken this way since the first one shipped. Registry entries now carry a `files` list covering the whole set, and `add` writes all of it. A file already on disk holding exactly what would be written is skipped rather than treated as a conflict, so adding a second component that shares `utils/color.ts` no longer fails on a file the CLI wrote itself. A file that has diverged still stops the install and asks for `--force`. `add` also stops trusting a remote index about where its files should land. It refuses any registry path that resolves outside the configured components directory, whether through `../` segments or a symlink, and it refuses to write to a target that is itself a symbolic link. Content comparison now ignores line-ending style, so a Windows checkout with `core.autocrlf` no longer reports its own files as modified.

## 0.11.1

## 0.11.0

## 0.10.0

### Minor Changes

- b7c6b53: Rebuild Aurora as a reference-shaped raymarch. This is a breaking change before 1.0. The field is triangle-noise fbm over 60 depth slices with per-pixel jitter, which fixes the banding, and a depth-indexed `stops` ramp gives near and far ribbons different colors. The motion is smoother and no longer drifts. The `drift`, `direction`, and `density` props are removed, and `falloff` is now a screen-space reveal, where 1 fills the canvas and 0 hides the curtain. Re-fetch the aurora template to upgrade. Existing copies keep working as-is.

## 0.9.0

### Minor Changes

- 76dd33d: Rebuild Aurora as a raymarched volumetric sky-band. This is a breaking change before 1.0. Curtains accumulate translucent emission over roughly 40 slices, which gives soft edges, filament structure, and parallax depth. The `layers: AuroraLayer[]` prop is removed, and color now comes from an altitude ramp through `stops: ColorStop[]`, following the LinearGradient convention, plus the new `colorSpace` and `hueInterpolation` props. `driftX` and `driftY` collapse into `drift`, an altitude-sheared travel, and `densityX` and `densityY` collapse into `density`. Re-fetch the aurora template to upgrade. Existing copies keep working as-is.

## 0.8.0

### Patch Changes

- `poster` gains a `--background <color>` option, which composites the shader onto a given CSS color before capture. Use it for transparent shaders like Aurora. It defaults to the harness background when omitted.

## 0.7.0

## 0.6.0

## 0.5.0

### Minor Changes

- 0299ddb: Rename ambiguous CLI flags and the config key to spelled-out names. This is a breaking change before 1.0.

  - `list`, `add`, and `update`: `--ref` → `--reference`
  - `poster`: `--from` → `--source`, `--out` → `--output`, `--type` → `--format`, `--export` → `--export-name`, `--time` → `--capture-delay`
  - `shaders.config.json`: the `tsx` boolean key is removed. It was validated but never read by any command.

  Kept: `--registry`, `--quality`, `--width`, `--height`, `--force`, and the config keys `componentsDir`, `registryUrl`, and `aliases`.

  **Migration:** update any script that passes the old flags. Delete the `tsx` key from your `shaders.config.json` if it is present, because nothing reads it and unknown keys are ignored. Re-running `shaders-cli init` regenerates a config without it.

## 0.4.1

## 0.4.0

## 0.3.0

## 0.2.0

### Minor Changes

- No API changes. This package bumped alongside `@camp-dev/shaders` 0.2.0 because the three packages ship as a fixed version group. See [`@camp-dev/shaders`'s 0.2.0 changelog](../shaders/CHANGELOG.md#020) for the engine-level breaking change.

## 0.1.0

### Minor Changes

- Initial public release. React shader components on WebGPU and Three.js TSL.

  - `@camp-dev/shaders` is the framework-agnostic engine: TSL primitives such as `fbm`, `voronoi`, `colorRamp`, and `quantize`, a WebGPU renderer wrapper, and a scheduler that watches visibility and intersection.
  - `@camp-dev/shaders-react` is the React binding: `<MatterScene>` for the shared canvas, `useShaderMaterial` for r3f, and the `useCursor` and `useScroll` input hooks.
  - `@camp-dev/shaders-cli` is the shadcn-style copy-paste CLI, with `init`, `list`, `add`, and `update`. The default registry tracks the CLI's published version tag (`v0.1.0`), so component code is stable per release.

  Six components ship through `shaders-cli add <name>`: `linear-gradient`, `mesh-gradient`, `aurora`, `dot-field`, `noise-field`, and `waves`. Each component is yours to edit after copy-in.

  Requirements: Node 22 or newer for the CLI, a WebGPU-capable browser (Chromium-based, Safari Technology Preview, or Firefox Nightly with the flag), Three.js ^0.170, and React ^19.

# @lovo/matter-cli

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
  - `matter.config.json`: removed the `tsx` boolean key (it was validated but never read by any command)

  Kept: `--registry`, `--quality`, `--width`, `--height`, `--force`, and the config keys `componentsDir`, `registryUrl`, `aliases`.

  Migration: update any scripts that pass the old flags. You can delete the `tsx` key from your `matter.config.json` if present — it is no longer used (unknown keys are ignored). Re-running `matter-cli init` regenerates a config without it.

## 0.4.1

## 0.4.0

## 0.3.0

## 0.2.0

### Minor Changes

- No API changes. Bumped alongside `@lovo/matter` 0.2.0 because the three packages ship as a fixed version group. See [`@lovo/matter`'s 0.2.0 changelog](../matter/CHANGELOG.md#020) for the engine-level breaking change.

## 0.1.0

### Minor Changes

- Initial public release of Matter — React shader components on WebGPU + Three.js TSL.

  **`@lovo/matter`** — Framework-agnostic engine: TSL primitives (`fbm`, `voronoi`, `colorRamp`, `quantize`, …), WebGPU renderer wrapper, visibility/intersection-aware scheduler.

  **`@lovo/matter-react`** — React binding: `<MatterScene>` (shared canvas), `useShaderMaterial` (r3f-compatible), input hooks (`useCursor`, `useScroll`).

  **`@lovo/matter-cli`** — shadcn-style copy-paste CLI: `init`, `list`, `add`, `update`. Default registry tracks the CLI's published version tag (`v0.1.0`) so component code is stable per release.

  **v1 components** (via `matter-cli add <name>`): `linear-gradient`, `mesh-gradient`, `aurora`, `dot-field`, `noise-field`, `waves`. Each component is yours to edit after copy-in.

  **Requirements:** Node 22+ for the CLI. WebGPU-capable browser (Chromium-based, Safari TP, Firefox Nightly with the flag). Three.js ^0.170. React ^19.

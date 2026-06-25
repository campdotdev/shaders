# @lovo/matter-cli

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

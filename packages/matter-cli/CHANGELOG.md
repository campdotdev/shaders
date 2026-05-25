# @lovo/matter-cli

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

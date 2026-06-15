# @lovo/matter

## 0.5.0

### Minor Changes

- c67eb98: Rename engine exports to spelled-out, domain-accurate names (breaking).

  - `fbm` → `fractalNoise` (and `FBMOptions` → `FractalNoiseOptions`)
  - `noise` → `simplexNoise`
  - `sdfCircle` → `signedDistanceFieldCircle`
  - `time` → `elapsedTime`
  - `Vec2` → `Vector2`

  `TSLNode`, `voronoi`, `colorRamp`, `quantize`, `displace`, `cursorRipple`, and `filmGrain` are unchanged.

  **Migration:** one-pass find-and-replace in your imports and call sites. No behavioral changes.

## 0.4.1

### Patch Changes

- b4ecdda: Reorganize engine source into kebab-case module folders under `inputs/`, `primitives/`, and `runtime/` (matching `matter-react` and `registry` layout). No public API changes.

## 0.4.0

### Minor Changes

- 1c69220: Rename public API symbols to domain-accurate names.

  New primary names: `FrameScheduler`, `GpuRenderer`, `GpuBackend` (`@lovo/matter`); `ShaderScene`, `ShaderSceneProps`, `ShaderContext`, `ShaderContextValue`, `useShaderContext`, `ShaderMonitor`, `ShaderMonitorProps`, `AnimatableSignal` (`@lovo/matter-react`).

  Old names (`MatterScheduler`, `MatterRenderer`, `MatterBackend`, `MatterScene`, `MatterSceneProps`, `MatterContext`, `MatterContextValue`, `useMatterContext`, `MatterMonitor`, `MatterMonitorProps`, `MatterSignal`, `MatterBackend`) are deprecated with `@deprecated` JSDoc and continue to work. They will be removed no earlier than 0.5.0.

  **Migration:** Replace old names with new in your imports and JSX. A one-pass find-and-replace is sufficient — no behavioral changes.

## 0.3.0

### Minor Changes

- 3856367: Add `filmGrain` primitive — hash-based, centered film grain for shader compositions.

  ```ts
  import { filmGrain, time } from "@lovo/matter";
  import { uv } from "three/tsl";

  // Static grain:
  const grain = filmGrain(uv(), 0.08);

  // Twinkling grain — caller controls the shutter rate. floor() quantizes
  // time to a discrete cadence; the hash is so sensitive that a continuous
  // time input gives no perceptible speed control.
  const grain = filmGrain(uv(), 0.08, time.mul(speed).mul(60).floor());

  material.colorNode = vec4(color.add(grain), 1);
  ```

  Output is centered around zero (mean of `length(vec2(u, v))` for uniform
  `u, v ∈ [0, 1)` is ~0.765, subtracted at the recipe level) so the grain
  acts as a brightness-preserving texture overlay. Subtract instead of add
  at the call site for film-stock-style darkening.

## 0.2.0

### Minor Changes

- Drop pure TSL re-exports from `@lovo/matter` public API.

  The following 15 nodes are no longer exported by `@lovo/matter`. Import them directly from `three/tsl`:

  `uv`, `vec2`, `vec3`, `vec4`, `uniform`, `mix`, `smoothstep`, `mod`, `sin`, `cos`, `length`, `dot`, `normalize`, `max`, `min`

  ```ts
  // Before (0.1.x)
  import { vec3, uv, time } from "@lovo/matter";

  // After (0.2.0)
  import { vec3, uv } from "three/tsl";
  import { time } from "@lovo/matter"; // still here — reduced-motion-gated
  ```

  The Matter-owned `time` (reduced-motion gated) continues to be exported from `@lovo/matter` unchanged. For raw uncapped time, import from `three/tsl` directly.

  All Matter-owned primitives (`fbm`, `noise`, `voronoi`, `colorRamp`, `sdfCircle`, `displace`, `cursorRipple`, `quantize`) remain exported from `@lovo/matter` unchanged. Registry component sources at 0.2.0 use the new convention. If you copied a component at 0.1.x, update its imports from `@lovo/matter` to `three/tsl` for the dropped symbols (or re-add the component via the CLI to pull the 0.2.0 source).

  **Why:** Re-exporting pure TSL primitives provided no value beyond shared import paths. Dropping them clarifies the layer boundary — Matter ships value-add primitives; TSL provides the math.

## 0.1.0

### Minor Changes

- Initial public release of Matter — React shader components on WebGPU + Three.js TSL.

  **`@lovo/matter`** — Framework-agnostic engine: TSL primitives (`fbm`, `voronoi`, `colorRamp`, `quantize`, …), WebGPU renderer wrapper, visibility/intersection-aware scheduler.

  **`@lovo/matter-react`** — React binding: `<MatterScene>` (shared canvas), `useShaderMaterial` (r3f-compatible), input hooks (`useCursor`, `useScroll`).

  **`@lovo/matter-cli`** — shadcn-style copy-paste CLI: `init`, `list`, `add`, `update`. Default registry tracks the CLI's published version tag (`v0.1.0`) so component code is stable per release.

  **v1 components** (via `matter-cli add <name>`): `linear-gradient`, `mesh-gradient`, `aurora`, `dot-field`, `noise-field`, `waves`. Each component is yours to edit after copy-in.

  **Requirements:** Node 22+ for the CLI. WebGPU-capable browser (Chromium-based, Safari TP, Firefox Nightly with the flag). Three.js ^0.170. React ^19.

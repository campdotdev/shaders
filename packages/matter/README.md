# @lovo/matter

Framework-agnostic engine for **Matter** — React shader components on WebGPU + Three.js TSL.

This package contains the TSL primitives, the renderer, and the scheduler. It has no React dependency. If you're using React, you almost certainly want [`@lovo/matter-react`](https://www.npmjs.com/package/@lovo/matter-react) instead — it re-exports everything here plus the React bindings.

## Install

```bash
npm install @lovo/matter three
# or: pnpm add @lovo/matter three
```

`three` is a peer dependency. Matter targets `three@^0.170.0` and uses the WebGPU TSL API exclusively.

## What's inside

- **TSL primitives**: `fbm`, `voronoi`, `colorRamp`, `quantize`, and a handful of others — composable shader fragments for procedural visuals.
- **Renderer**: thin wrapper around `WebGPURenderer` that handles canvas resize, DPR, and `setClearColor`.
- **Scheduler**: visibility/intersection-aware render loop that pauses when the canvas is off-screen or the tab is hidden.

## Minimal usage

```typescript
import { fbm, colorRamp } from '@lovo/matter'
import { uv, vec3, time } from 'three/tsl'

// Inside your TSL fragment graph:
const noise = fbm(uv().mul(4).add(time.mul(0.1)))
const color = colorRamp(noise, [
  { stop: 0.0, color: vec3(0.05, 0.05, 0.10) },
  { stop: 1.0, color: vec3(0.30, 0.50, 0.95) },
])
```

For polished drop-in components like `<LinearGradient>` and `<Aurora>`, install [`@lovo/matter-cli`](https://www.npmjs.com/package/@lovo/matter-cli) and copy them into your project.

## Docs

Full docs and live demos: <https://github.com/lovo-hq/matter>

## License

MIT — see [LICENSE](./LICENSE).

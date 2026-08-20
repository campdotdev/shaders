# @mattermix/shaders-react

React binding for **Matter** — shader components on WebGPU + Three.js TSL.

This package wraps the engine ([`@mattermix/shaders`](https://www.npmjs.com/package/@mattermix/shaders)) with React-friendly primitives: a shared `<ShaderScene>` canvas, a `useShaderMaterial` hook for `@react-three/fiber` integration, and input hooks (`useCursor`, `useScroll`).

## Install

```bash
npm install @mattermix/shaders @mattermix/shaders-react react three
```

`react` (^19), `@mattermix/shaders`, and `three` (^0.170) are peer dependencies.

## Three rendering modes

Matter components work in three configurations:

1. **Drop-in** — each component manages its own canvas. Simplest path; one canvas per effect.
2. **Shared scene** — wrap multiple Matter components in a single `<ShaderScene>` to share one canvas (faster, layered effects).
3. **Inside `@react-three/fiber`** — use `useShaderMaterial` directly inside a r3f `<Canvas>` you already own.

## Minimal usage (Mode 2: shared scene)

```tsx
import { ShaderScene } from '@mattermix/shaders-react'
// LinearGradient is copy-pasted into your project via @mattermix/shaders-cli
import { LinearGradient } from '@/components/matter/linear-gradient'

export default function Hero() {
  return (
    <ShaderScene>
      <LinearGradient colors={['#0b0c2a', '#1d1f57', '#7d2dff']} angle={120} />
    </ShaderScene>
  )
}
```

## Getting components

Polished drop-in components (`<LinearGradient>`, `<Aurora>`, `<DotField>`, `<SimplexNoise>`, `<MeshGradient>`, `<WaveLines>`) ship via the shadcn-style copy-paste CLI. Install it once:

```bash
npm install -D @mattermix/shaders-cli
npx matter-cli init
npx matter-cli add linear-gradient
```

The component lands in `src/components/matter/linear-gradient.tsx` and is yours to edit.

## Docs

<https://github.com/mattermix/shaders>

## Migration from 0.3.x

`MatterScene`, `MatterMonitor`, `useMatterContext`, and related types have been renamed to `ShaderScene`, `ShaderMonitor`, `useShaderContext`, `ShaderContextValue`, etc. The old names are deprecated and still work — remove them at your leisure before 0.5.0.

## License

MIT — see [LICENSE](./LICENSE).

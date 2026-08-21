# @camp-dev/shaders-react

React binding for **Shaders** — shader components on WebGPU + Three.js TSL.

This package wraps the engine ([`@camp-dev/shaders`](https://www.npmjs.com/package/@camp-dev/shaders)) with React-friendly primitives: a shared `<ShaderScene>` canvas, a `useShaderMaterial` hook for `@react-three/fiber` integration, and input hooks (`useCursor`, `useScroll`).

## Install

```bash
npm install @camp-dev/shaders @camp-dev/shaders-react react three
```

`react` (^19), `@camp-dev/shaders`, and `three` (^0.170) are peer dependencies.

## Three rendering modes

Shaders components work in three configurations:

1. **Drop-in** — each component manages its own canvas. Simplest path; one canvas per effect.
2. **Shared scene** — wrap multiple Shaders components in a single `<ShaderScene>` to share one canvas (faster, layered effects).
3. **Inside `@react-three/fiber`** — use `useShaderMaterial` directly inside a r3f `<Canvas>` you already own.

## Minimal usage (Mode 2: shared scene)

```tsx
import { ShaderScene } from '@camp-dev/shaders-react'
// LinearGradient is copy-pasted into your project via @camp-dev/shaders-cli
import { LinearGradient } from '@/components/shaders/linear-gradient'

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
npm install -D @camp-dev/shaders-cli
npx shaders-cli init
npx shaders-cli add linear-gradient
```

The component lands in `src/components/shaders/linear-gradient.tsx` and is yours to edit.

## Docs

<https://github.com/campdotdev/shaders>

## License

MIT — see [LICENSE](./LICENSE).

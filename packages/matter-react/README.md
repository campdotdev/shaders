# @lovo/matter-react

React binding for **Matter** — shader components on WebGPU + Three.js TSL.

This package wraps the engine ([`@lovo/matter`](https://www.npmjs.com/package/@lovo/matter)) with React-friendly primitives: a shared `<MatterScene>` canvas, a `useShaderMaterial` hook for `@react-three/fiber` integration, and input hooks (`useCursor`, `useScroll`).

## Install

```bash
npm install @lovo/matter @lovo/matter-react react three
```

`react` (^19), `@lovo/matter`, and `three` (^0.170) are peer dependencies.

## Three rendering modes

Matter components work in three configurations:

1. **Drop-in** — each component manages its own canvas. Simplest path; one canvas per effect.
2. **Shared scene** — wrap multiple Matter components in a single `<MatterScene>` to share one canvas (faster, layered effects).
3. **Inside `@react-three/fiber`** — use `useShaderMaterial` directly inside a r3f `<Canvas>` you already own.

## Minimal usage (Mode 2: shared scene)

```tsx
import { MatterScene } from '@lovo/matter-react'
// LinearGradient is copy-pasted into your project via @lovo/matter-cli
import { LinearGradient } from '@/components/matter/linear-gradient'

export default function Hero() {
  return (
    <MatterScene>
      <LinearGradient
        colors={['#0b0c2a', '#1d1f57', '#7d2dff']}
        angle={120}
      />
    </MatterScene>
  )
}
```

## Getting components

Polished drop-in components (`<LinearGradient>`, `<Aurora>`, `<DotField>`, `<NoiseField>`, `<MeshGradient>`, `<Waves>`) ship via the shadcn-style copy-paste CLI. Install it once:

```bash
npm install -D @lovo/matter-cli
npx matter-cli init
npx matter-cli add linear-gradient
```

The component lands in `src/components/matter/linear-gradient.tsx` and is yours to edit.

## Docs

<https://github.com/lovo-hq/matter>

## License

MIT — see [LICENSE](./LICENSE).

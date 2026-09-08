# @camp-dev/shaders

React shader components on WebGPU and Three.js TSL, plus the primitives they are built from.

One package holds three layers. The components, such as `<LinearGradient>`, `<Aurora>`, and `<DotField>`, render inside a shared `<ShaderScene>` and are tuned through props. The React binding is `<ShaderScene>` itself, `useShaderMaterial` for a `@react-three/fiber` canvas you already own, and the input and animation hooks. Underneath are the TSL primitives, such as `fractalNoise`, `voronoi`, and `colorRamp`, and the renderer and scheduler that run them.

## Install

```bash
pnpm add @camp-dev/shaders three
```

`react` (`^19`) and `three` (`^0.170`) are peer dependencies. Shaders uses the WebGPU TSL API exclusively, so it needs a WebGPU-capable browser at runtime.

## Render a component

```tsx
import { LinearGradient, ShaderScene } from '@camp-dev/shaders'

export function Hero() {
  return (
    <ShaderScene style={{ height: '60vh' }}>
      <LinearGradient />
    </ShaderScene>
  )
}
```

Every component is bare: it needs a `<ShaderScene>` parent, which owns the canvas and the WebGPU renderer. Stack several components as children of one scene to compose them.

## Write your own shader

The primitives are plain TSL nodes, so they compose with anything from `three/tsl`:

```typescript
import { colorRamp, fractalNoise } from '@camp-dev/shaders'
import { uv, vec3, time } from 'three/tsl'

const noise = fractalNoise(uv().mul(4).add(time.mul(0.1)))
const color = colorRamp(noise, [
  { position: 0, color: vec3(0.05, 0.05, 0.1) },
  { position: 1, color: vec3(0.3, 0.5, 0.95) },
])
```

## Server-safe subpaths

The root entry reaches `three/webgpu`, which reads `self` at module load and so cannot run on a server. Three subpaths carry code that never touches three:

| Import                     | For                                                             |
| -------------------------- | --------------------------------------------------------------- |
| `@camp-dev/shaders/color`  | `parseColorString` and the OKLab, OKLCH, and gamut math         |
| `@camp-dev/shaders/gamut`  | `useDisplayGamut`                                               |
| `@camp-dev/shaders/poster` | `<ShaderPoster>`, a static stand-in shown until the first frame |

## Docs

Full docs and live demos: <https://github.com/campdotdev/shaders>

## License

MIT — see [LICENSE](./LICENSE).

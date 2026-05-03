# Matter — Design Document

**Status:** Approved through brainstorming, awaiting user review of this written spec
**Date:** 2026-05-02
**Author:** Hunter Garrett (with brainstorming support)
**Project repo:** `/Users/hunter.garrett/Documents/_personal/mattermix/` (rename to `matter/` planned at git init)
**npm scope:** `@lovo/*`

---

## 1. Overview

**Matter** is a React shader component library targeting modern WebGPU via Three.js's TSL (Three Shading Language). It ships polished, drop-in components for shader-driven backgrounds and interactive surfaces, alongside a primitives library and recipe gallery for developers who want to author their own shaders.

The project serves two audiences from a single codebase:

- **React app developers who don't know shaders** — drop in `<LinearGradient />`, `<Aurora />`, `<DotField interactive />` and ship beautiful, GPU-accelerated landing pages without thinking about TSL, WebGPU, or the render loop.
- **Creative coders / shader-curious developers** — use Matter's primitives (`fbm`, `voronoi`, `cursorRipple`, `colorRamp`, etc.) as composable LEGO bricks for their own custom effects, and learn from the curated component catalog as worked examples.

A secondary goal: the project doubles as a learning vehicle for shader programming for its author.

---

## 2. Goals and non-goals

### v1 goals

- Six polished Tier 1 components covering shader-driven backgrounds with optional cursor interaction:
  `<LinearGradient>`, `<MeshGradient>`, `<Aurora>`, `<DotField>`, `<NoiseField>`, `<Waves>`
- A primitives library (~12 TSL building blocks) framework-agnostic in the engine package
- A copy-paste delivery model (CLI), so users own and can edit the source of every Tier 1 component
- A Next.js docs site that doubles as a live demo, props playground, primitive reference, and recipe gallery
- WebGPU + WebGL2 fallback (free via TSL), client-only with sensible default fallbacks for SSR
- A signal protocol for animatable props (MotionValue-compatible) — no in-house animation library
- Full developer iteration via Storybook 10 + Vite; visual regression via Storybook Test Runner + Playwright
- Production-quality performance defaults out of the box (pause-when-offscreen, DPR clamping, reduced-motion, etc.)

### v1 non-goals (deferred)

- Image/video filter components (post-processing applied to existing media)
- Particle systems
- 3D objects/materials (custom mesh shaders for arbitrary geometry)
- Post-processing effects (full-scene bloom, chromatic aberration, etc.)
- Text effects (shader-displaced text)
- Vue and Svelte bindings (architecture is ready; bindings ship when there's demand)
- Hosted registry endpoint (CLI fetches from GitHub raw URLs in v1)
- Audio-reactive primitives
- Built-in animation/spring/timeline library (defer to Motion or any signal-emitting library the user prefers)
- CSS custom property theming API (deliberately deferred from styling decision)

---

## 3. Architecture

### 3.1 Three-tier model

Matter is organized into three tiers, each addressing a different developer need:

| Tier  | Name           | What it is                                                                                                                                              | Where it lives                                  | Audience                                   |
| ----- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------ |
| **1** | **Components** | Polished, prop-configurable shader components (`<LinearGradient>`, `<Aurora>`, etc.)                                                                    | `registry/*.tsx` (delivered via CLI copy-paste) | All users                                  |
| **2** | **Primitives** | TSL building blocks (`fbm`, `voronoi`, `cursorRipple`, `colorRamp`, etc.)                                                                               | `packages/matter/` (npm — `@lovo/matter`)       | Component authors and shader-curious users |
| **3** | **Recipes**    | Short TSL snippets (10–30 lines) demonstrating how to combine primitives into specific looks (embossed relief, pixelate, posterize, displacement, etc.) | `apps/docs/` (gallery pages)                    | Anyone copying ad-hoc shader effects       |

Tier 1 components are written using Tier 2 primitives. Tier 3 recipes use Tier 2 primitives directly. Popular recipes can graduate into Tier 1 components over time. The catalog scales primarily through Tier 3, not Tier 1.

### 3.2 Repo layout (monorepo)

```
matter/                              # rename from mattermix/ at git init
├── pnpm-workspace.yaml
├── package.json                     # root — orchestration only, never published
├── tsconfig.base.json
├── turbo.json                       # Turborepo task graph
├── packages/
│   ├── matter/                      # → @lovo/matter (engine, three.js + TSL only, no React)
│   ├── matter-react/                # → @lovo/matter-react (React binding)
│   └── matter-cli/                  # → @lovo/matter-cli (copy-paste CLI)
├── registry/                        # source-of-truth for Tier 1 components
│   ├── linear-gradient.tsx
│   ├── linear-gradient.stories.tsx
│   ├── mesh-gradient.tsx
│   ├── mesh-gradient.stories.tsx
│   ├── aurora.tsx
│   ├── aurora.stories.tsx
│   ├── dot-field.tsx
│   ├── dot-field.stories.tsx
│   ├── noise-field.tsx
│   ├── noise-field.stories.tsx
│   ├── waves.tsx
│   ├── waves.stories.tsx
│   └── registry.json                # CLI manifest
├── apps/
│   └── docs/                        # Next.js docs site
├── .storybook/                      # Storybook config (covers registry/ + packages/)
└── tooling/
    ├── eslint-config/
    └── tsconfig/
```

### 3.3 Package responsibilities and dependency graph

- **`@lovo/matter`** (engine) — pure TypeScript, framework-agnostic. Depends on `three` (peer). Exports TSL primitive re-exports, Matter-specific primitives, runtime utilities (`createRenderer`, `MatterScheduler`, `createMaterial`), and input source classes.
- **`@lovo/matter-react`** (React binding) — depends on `@lovo/matter` (peer) and `react` (peer). Exports `<MatterScene>`, `useShaderMaterial`, `useMatterContext`, `<FallbackBoundary>`, `useAnimatableUniform`, and the four input hooks (`useCursor`, `useTime`, `useScroll`, `useResize`). **Does not depend on `@react-three/fiber` — optional peer or otherwise.**
- **`@lovo/matter-cli`** — standalone npm package, no workspace dependencies at runtime. Reads `registry/registry.json` from GitHub raw URLs (or a future hosted endpoint).
- **`registry/*.tsx`** — Tier 1 components. Import from `@lovo/matter` and `@lovo/matter-react`. Do **not** import from each other (each component is a self-contained file the user copies). Component files do not appear in any published npm package — they are delivered exclusively via the CLI.
- **`apps/docs`** — depends on all three packages plus the registry components (imported via workspace alias for live demos).

Why components live outside `packages/`: if they were inside a published package, they'd be part of an npm bundle, defeating the copy-paste model. By keeping them in a top-level `registry/` directory, they are never published — only delivered via the CLI. The docs site imports them via workspace path. This mirrors shadcn/ui's registry structure.

### 3.4 Three rendering modes

Components support three usage modes, achieved through context detection without auto-detecting r3f:

**Mode 1 — Drop-in (the 90% case):**

```tsx
<LinearGradient interactive />
```

The component creates its own canvas internally via `<MatterScene>` (auto-wrapping when no parent scene is detected). Zero ceremony.

**Mode 2 — Shared scene (Matter-managed):**

```tsx
import { MatterScene } from '@lovo/matter-react'

;<MatterScene>
  <LinearGradient />
  <MeshGradient />
</MatterScene>
```

`<MatterScene>` creates one canvas, one renderer, one render loop, and one shared scheduler. Children detect they're inside a `MatterScene` (via React context) and skip the auto-wrap. Multiple components on the same page share resources.

**Mode 3 — Custom Three.js or r3f integration (escape hatch):**

```tsx
import { Canvas } from '@react-three/fiber'
import { useShaderMaterial } from '@lovo/matter-react'
import { /* TSL primitives */ } from '@lovo/matter'

function MyR3FScene() {
  const material = useShaderMaterial(/* TSL fragment */, /* uniforms */)
  return <mesh material={material}><planeGeometry /></mesh>
}

<Canvas>
  <MyR3FScene />
</Canvas>
```

Matter exposes its hooks (especially `useShaderMaterial`) as the integration surface for users who already own a Three.js / r3f / Threlte / TresJS scene. **Matter never imports r3f, even optionally.** Multi-framework integration scales by writing thin equivalent bindings (`@lovo/matter-vue`, `@lovo/matter-svelte`) that follow the same three-mode pattern.

---

## 4. Public API surfaces

### 4.1 `@lovo/matter` (engine — framework-agnostic)

Three export groups:

#### TSL re-exports (stable surface)

```ts
export {
  uniform,
  vec2,
  vec3,
  vec4,
  mix,
  smoothstep,
  mod,
  sin,
  cos,
  length,
  dot,
  normalize,
  time,
} from 'three/tsl'
```

These are the most-used TSL primitives, re-exported through Matter so users have one stable import path. New TSL versions are absorbed by updating Matter's re-exports without changing user code.

#### Matter primitives (Tier 2)

```ts
// Procedural patterns
export function noise(uv: Vec2Node, opts?: { scale?: number; seed?: number }): FloatNode
export function fbm(uv: Vec2Node, opts?: { octaves?: number; persistence?: number }): FloatNode
export function voronoi(
  uv: Vec2Node,
  opts?: { scale?: number },
): { distance: FloatNode; cellId: FloatNode }

// Spatial / shape
export function gradient(field: FloatNode, epsilon?: number): Vec2Node // rate of change in x,y
export function sdfCircle(uv: Vec2Node, center: Vec2Node, radius: FloatNode): FloatNode
export function radialGradient(uv: Vec2Node, center: Vec2Node, colors: Vec3Node[]): Vec3Node

// Color & quantization
export function quantize<T>(value: T, step: T): T // posterize / pixelate
export function colorRamp(t: FloatNode, stops: { color: Vec3Node; position: number }[]): Vec3Node

// Distortion
export function displace(uv: Vec2Node, by: Vec2Node): Vec2Node
export function cursorRipple(
  uv: Vec2Node,
  cursor: Vec2Node,
  opts?: { decay?: number; frequency?: number },
): FloatNode
```

Where Three.js's TSL already provides functionality (e.g., its built-in `mx_noise_float`, `mx_perlin_noise_*`), Matter wraps it with simpler ergonomic APIs. Where TSL doesn't have a primitive at the right abstraction level (e.g., `cursorRipple`, `sdfCircle` as named primitives), Matter implements it from scratch using TSL math. Either way, every Matter primitive is itself a TSL function — composable with native TSL the same way `mix` and `smoothstep` are.

#### Runtime utilities

```ts
export function createRenderer(canvas: HTMLCanvasElement, opts?: RendererOpts): MatterRenderer
// Wraps THREE.WebGPURenderer with: WebGPU→WebGL2 fallback, DPR clamping, resize handling, disposal

export class MatterScheduler {
  tick(): void
  add(client: SchedulerClient): void
  remove(client: SchedulerClient): void
  pause(): void
  resume(): void
}
// One scheduler per <MatterScene>. Components inside the same MatterScene share its scheduler
// (single requestAnimationFrame loop ticking all clients). Multiple drop-in components on the
// same page (each auto-wrapping its own MatterScene) each get their own scheduler — by design,
// since drop-in mode trades resource sharing for zero-ceremony usage. Users who want shared
// rendering wrap children in an explicit <MatterScene>.

export function createMaterial(
  tslShader: ShaderNode,
  uniforms?: Record<string, any>,
): MatterMaterial
// Wraps THREE.NodeMaterial; provides the prop→uniform binding layer
```

#### Input source classes (framework-agnostic)

```ts
export class CursorInput {
  constructor(opts?: { smoothing?: number; target?: EventTarget })
  uniform: Vec2Uniform
  get(): Vec2 // MotionValue-compatible
  on(event: 'change', cb: (v: Vec2) => void): () => void // unsubscribe
  dispose(): void
}

export class TimeInput {
  /* monotonic clock uniform; same shape */
}
export class ScrollInput {
  /* scroll position uniform, normalized; same shape */
}
export class ResizeInput {
  /* viewport size uniform; same shape */
}
```

Each input class implements both a uniform writer (for the GPU) and the MotionValue-compatible signal protocol (`get`, `on('change', cb)`) so they can be composed with other signals via Motion's `useTransform` or similar.

### 4.2 `@lovo/matter-react` (React binding)

```ts
// Shared scene wrapper (Mode 2)
export function MatterScene(props: MatterSceneProps): JSX.Element

interface MatterSceneProps {
  children: ReactNode
  fallback?: ReactNode
  className?: string
  style?: CSSProperties
  maxDPR?: number // default 2; opt-out via Infinity
  pauseWhenOffscreen?: boolean // default true
}

// Material hook — the integration point for r3f (Mode 3) and Tier 1 components
export function useShaderMaterial(
  tsl: ShaderNode,
  uniforms: Record<string, any>,
): THREE.NodeMaterial

// Context access for advanced cases (e.g., adding custom meshes inside MatterScene)
export function useMatterContext(): {
  renderer: MatterRenderer
  scene: THREE.Scene
  camera: THREE.Camera
  scheduler: MatterScheduler
} | null

// Animatable prop binder — used internally by Tier 1 components
export function useAnimatableUniform<T>(prop: AnimatableProp<T>): UniformNode

// Input hooks (React wrappers around the engine's input classes)
export function useCursor(opts?: {
  smoothing?: number
  target?: 'window' | RefObject<HTMLElement>
}): CursorSignal
export function useTime(): TimeSignal
export function useScroll(opts?: {
  axis?: 'x' | 'y' | 'both'
  target?: RefObject<HTMLElement>
}): ScrollSignal
export function useResize(): ResizeSignal

// SSR helper — handles client-only mounting + fallback display
export function FallbackBoundary(props: { fallback?: ReactNode; children: ReactNode }): JSX.Element
```

The "signal" return types from the input hooks (`CursorSignal`, `TimeSignal`, etc.) all satisfy:

```ts
interface MatterSignal<T> {
  get(): T
  on(event: 'change', cb: (v: T) => void): () => void // returns unsubscribe
}
```

This is the same shape as Motion's `MotionValue<T>`, so any Motion utility (`useTransform`, `useSpring`, `animate`) accepts a Matter signal as input transparently.

### 4.3 `@lovo/matter-cli` (copy-paste delivery)

```bash
npx @lovo/matter-cli init                 # one-time project setup
npx @lovo/matter-cli list                 # show available components
npx @lovo/matter-cli add linear-gradient  # copy a component
npx @lovo/matter-cli add aurora dot-field # multiple at once
npx @lovo/matter-cli update [name]        # re-fetch latest
```

`init` writes `matter.config.json` to project root:

```json
{
  "componentsDir": "src/components/matter",
  "registryUrl": "https://raw.githubusercontent.com/lovo/matter/main/registry",
  "aliases": { "@/": "src/" },
  "tsx": true
}
```

`add` flow:

1. Fetches `${registryUrl}/registry.json`
2. Looks up the requested component entry
3. Fetches the corresponding `.tsx` source
4. Rewrites internal imports per the user's path aliases
5. Writes to `componentsDir`
6. Prints required `npm install` deps from the registry entry

**Versioning:** `--ref <tag|branch|commit>` lets users pin to a specific version (e.g., `--ref v0.3.0`). The CLI's default ref is the version string of the installed CLI itself — installing `@lovo/matter-cli@0.3.0` and running `add` fetches the v0.3.0 registry, not whatever is on `main`. This is the pattern shadcn settled on after early users were burned by tracking `main`.

Registry entry shape (in `registry/registry.json`):

```json
{
  "components": {
    "linear-gradient": {
      "file": "linear-gradient.tsx",
      "dependencies": ["@lovo/matter", "@lovo/matter-react", "react", "three"],
      "uses_primitives": ["colorRamp", "mix", "uniform"],
      "tier": 1
    }
  }
}
```

---

## 5. Component contract & v1 catalog

### 5.1 The contract every Tier 1 component follows

```tsx
'use client'

interface MatterComponentProps {
  // Visual configuration (component-specific props — all numeric/color props are AnimatableProp<T>)

  // Interactivity
  interactive?: boolean // simple on/off — uses default useCursor() internally
  inputs?: {
    // advanced — pass user-controlled signals
    cursor?: CursorSignal
    scroll?: ScrollSignal
    time?: TimeSignal
    [key: string]: MatterSignal<any> | undefined
  }

  // Layout & SSR
  className?: string
  style?: CSSProperties
  fallback?: ReactNode // overrides the component's default fallback
}
```

Every Tier 1 component:

1. Wraps itself in `<FallbackBoundary>` with a sensible default fallback (component-specific, usually CSS-based)
2. Auto-wraps in `<MatterScene>` if no parent scene is detected via context
3. Defaults to `position: absolute; inset: 0` (sized by nearest positioned ancestor)
4. Composes its TSL fragment from `@lovo/matter` primitives
5. Marked with `'use client'` (client-only)
6. Exposes every numeric and color prop as `AnimatableProp<T>` (see Section 6)

### 5.2 v1 catalog

#### `<LinearGradient>` — the simplest, the foundation

```tsx
<LinearGradient
  colors={['#ff7b72', '#7b9cff']} // 2+ colors
  angle={45} // degrees
  variant="linear" // 'linear' | 'radial'
  speed={0} // animates the gradient drift
  focalPoint={[0.5, 0.5]} // for radial variant
  interactive={false} // cursor shifts focal/angle slightly
/>
```

- **Primitives**: `colorRamp`, `mix`, `time` (when animated), optional cursor uniform
- **TSL approach**: project `uv` along the rotated direction → sample `colorRamp(t, colors)`. Radial variant uses `length(uv - focalPoint)` instead of projection.
- **Cursor behavior**: subtle parallax — focal point eases toward cursor
- **Default fallback**: CSS `linear-gradient(${angle}deg, ...)` / `radial-gradient(...)` (pixel-identical at rest)
- **Teaches**: position → t → color interpolation, the simplest shader pattern

#### `<MeshGradient>` — Stripe-style multi-point blending

```tsx
<MeshGradient
  colors={['#ff61a6', '#61a6ff', '#61ffa6', '#ffd861']}
  points={'auto'} // 'auto' or explicit Vec2[]
  speed={0.3}
  blur={0.5}
  interactive={false} // cursor pulls nearest color point
/>
```

- **Primitives**: `colorRamp`, `mix`, `noise` (animates point positions), optional cursor
- **TSL approach**: for N color points at positions `p[i]`, weight each by `1 / pow(distance(uv, p[i]), 1/blur)`; normalize weights; sum `weight[i] * color[i]`. Animate `p[i]` with `p[i] + noise(time + i) * 0.1`.
- **Cursor behavior**: nearest color point eases toward cursor
- **Default fallback**: 4 stacked CSS `radial-gradient`s at the four corners
- **Teaches**: multi-source blending, weight functions

#### `<Aurora>` — the signature shader-y look

```tsx
<Aurora
  colors={['#7b61ff', '#5fc7ff', '#ff61a6']}
  speed={0.4}
  intensity={1}
  interactive={false} // cursor warps the flow
/>
```

- **Primitives**: `fbm`, `mix`, `smoothstep`, `displace`, `time`, optional cursor
- **TSL approach**: vertical band gradient via `colorRamp`; displace sample `uv` by `vec2(fbm(uv*0.5 + time*speed), 0)`; result is bands warped by flowing noise. Layered FBM at multiple scales for depth.
- **Cursor behavior**: locally amplifies displacement field near cursor
- **Default fallback**: 3 stacked CSS radial gradients with `filter: blur()`
- **Teaches**: FBM, displacement-based effects, layered noise

#### `<DotField>` — the cursor showcase

```tsx
<DotField
  spacing={30} // pixels between dots
  dotSize={2} // pixel radius
  color="#888"
  reach={100} // cursor influence radius
  strength={1}
  interactive={true} // default ON for this component
/>
```

- **Primitives**: `sdfCircle`, `displace`, `mix`, cursor uniform (interactive defaults to true)
- **TSL approach**: tile `uv` with `mod(uv * resolution / spacing, 1.0)` for per-cell coords; `sdfCircle(cellUv - 0.5, radius)` renders a dot at each cell center; before tiling, displace each cell center based on distance to cursor (`displaceAmount = strength * smoothstep(reach, 0, distance(cell, cursor))`).
- **Cursor behavior**: dots within `reach` get pulled or pushed
- **Default fallback**: static CSS background — `background-image: radial-gradient(...)` with `background-size: ${spacing}px ${spacing}px` (identical at rest)
- **Teaches**: tiling, signed distance fields, cursor-driven displacement (this is the architecturally-validating component)

#### `<NoiseField>` — the primitive made visible

```tsx
<NoiseField
  scale={1}
  speed={0.5}
  colors={['#000', '#fff']}
  octaves={4}
  variant="organic" // 'organic' | 'cellular' | 'grid'
/>
```

- **Primitives**: `fbm` (organic), `voronoi` (cellular), or quantized `fbm` (grid); `colorRamp`, `time`
- **TSL approach**: `t = fbm(uv * scale + time * speed, { octaves })`; output `colorRamp(t, colors)`. `cellular` uses `voronoi`; `grid` uses `quantize(t, 0.1)`.
- **Cursor behavior**: optional UV displacement near cursor
- **Default fallback**: SVG inline noise filter (`<feTurbulence>`)
- **Teaches**: FBM and Voronoi are the two most important pattern primitives in shader work

#### `<Waves>` — trig as the engine

```tsx
<Waves
  amplitude={0.1}
  frequency={5}
  speed={1}
  color="#7ec"
  layers={3} // sum N waves at different frequencies
  interactive={false} // cursor spawns ripples
/>
```

- **Primitives**: `sin`/`cos`, `cursorRipple`, `mix`, `time`
- **TSL approach**: sum `layers` sine waves at different frequencies and phases — `Σ sin(uv.x * freq[i] + time * speed[i] + phase[i]) * amp[i]`. Threshold via `smoothstep` for soft wave bands. Add `cursorRipple(uv, cursor)` for interaction.
- **Cursor behavior**: cursor adds a radial ripple field that decays with distance (drop-of-water look)
- **Default fallback**: SVG static `<path>` with sine-wave-shaped curves
- **Teaches**: trig as the core engine of motion, layered superposition, cursor-as-event-source

### 5.3 What this set proves architecturally

| Architectural decision                         | Validated by                                                                                                       |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Hybrid renderer (drop-in + `MatterScene`)      | All six work standalone; docs page combines them inside one `MatterScene`                                          |
| Cursor architecture (`interactive` + `inputs`) | LinearGradient, MeshGradient, Aurora, DotField, Waves opt in differently                                           |
| Fallback prop + sensible defaults              | LinearGradient + DotField + NoiseField have CSS-equivalent fallbacks; Aurora/MeshGradient/Waves use approximations |
| WebGPU + WebGL2 fallback (TSL auto)            | All six render on either backend without code changes                                                              |
| Primitives library (Tier 2)                    | The six components together use ~10 of ~12 primitives — heavy reuse validates the API                              |
| Three-tier model                               | Components → primitives → recipes shown on docs site                                                               |
| Animatable prop protocol                       | Every numeric/color prop on every component is `AnimatableProp<T>`                                                 |

If these six ship well, every architectural decision in this design is _demonstrably_ sound.

---

## 6. Animation & signal protocol

### 6.1 The tension

React props are snapshot-y; shader uniforms are continuous (pushed to the GPU every frame). If users animate props by calling `setState` 60 times per second, they pay a React render cycle just to update a number on the GPU. That's wasteful and sometimes janky.

### 6.2 The contract

Every animatable prop accepts either a static value or a signal-shaped object:

```ts
type AnimatableProp<T> = T | { get(): T; on(event: 'change', cb: (v: T) => void): () => void }
```

The second shape matches Motion's `MotionValue<T>`. Matter does not depend on Motion — it accepts anything matching the protocol.

### 6.3 Three usage patterns

**1. Static (the 80% case):**

```tsx
<LinearGradient angle={45} colors={['#f00', '#00f']} />
```

**2. Animation library (Motion / Framer Motion / GSAP):**

```tsx
import { useMotionValue, animate } from 'motion/react'

function HeroBackground() {
  const angle = useMotionValue(0)
  useEffect(() => {
    animate(angle, 360, { duration: 8, repeat: Infinity })
  }, [])
  return <LinearGradient angle={angle} />
}
```

**3. Pipe Matter inputs through transforms:**

```tsx
import { useScroll, useTime } from '@lovo/matter-react'
import { useTransform } from 'motion/react'

function ScrollyAurora() {
  const scrollY = useScroll().y
  const intensity = useTransform(scrollY, [0, 1], [0.2, 1.4])
  return <Aurora intensity={intensity} />
}
```

### 6.4 Engine support

The integration is concentrated in one helper:

```ts
export function useAnimatableUniform<T>(prop: AnimatableProp<T>): UniformNode
```

If `prop` is a plain value, returns a static uniform that updates only when the prop changes (React render path). If `prop` matches the signal shape, subscribes via `.on('change')` and writes the new value into the uniform without re-rendering. Tier 1 components use this internally for every animatable prop.

### 6.5 What Matter does NOT ship

- Springs, tweens, easing, timelines, animate/transition functions
- Hover/in-view/gesture detection
- A `MatterValue` / `useMatterSpring` / `useMatterAnimate`

Matter accepts MotionValues, doesn't replace them. Documentation strongly recommends Motion as the animation library, with one hand-rolled `requestAnimationFrame` example proving users can avoid any animation library if they choose.

CSS transforms (`transform: scale(...)` on the canvas element) are CSS concerns; users handle them via `className`/`style` directly. Matter does not expose a CSS-transform API.

---

## 7. Docs site

### 7.1 Information architecture

```
/                            Hero — landing page is itself a Matter showcase
/getting-started             Install, init, first component
/components/[slug]           One page per Tier 1 component (six in v1)
/primitives/[slug]           One page per Tier 2 primitive (~12 in v1)
/recipes/[slug]              Tier 3 — short TSL snippets
/guides/animation            Motion library patterns + signal protocol
/guides/ssr-and-fallbacks    Next.js / SSR / fallback prop patterns
/guides/shared-scenes        Mode 2 (`MatterScene`) — multiple effects, one renderer
/guides/three-r3f            Mode 3 — using Matter inside `<Canvas>` from r3f
/guides/perf                 Pause-when-offscreen, DPR clamping, render-on-demand
/reference                   Full API reference per package
```

### 7.2 Page treatments

**Component pages** include:

- Full-bleed live demo above the fold with fullscreen toggle
- **Props playground** — schema-driven panel with sliders/color-pickers/toggles that mutate the live demo's props in real time
- Install snippet (`npx @lovo/matter-cli add <name>`)
- **Code block** — actual source from `registry/<name>.tsx`, pulled at build time. Framework switcher infrastructure exists from day one but the UI is hidden in v1 (only React tab is populated). It activates when Vue/Svelte bindings ship.
- "Copy with current playground values" button
- Props table (name, type, default, description)
- Tier 2 primitives used (cross-links to primitive pages)

**Primitive pages** include:

- One paragraph "what this is for" explainer (with shader concept context for learners)
- Live demo with a tiny shader using just this primitive, with sliders for its parameters
- TS function signature
- Recipes that use it (cross-links)

**Recipe pages** include:

- Live preview rendered as a small Matter component
- TSL source (10–30 lines)
- Primitives used (cross-links)
- Variations (same recipe with different parameter sets)

### 7.3 Major shared components (in `apps/docs`)

- `<LiveDemo>` — wraps a component with fullscreen toggle, isolation, play/pause control
- `<PropsPlayground>` — schema-driven controls panel
- `<CodeBlock framework="react">` — pulls source at build time from `registry/`
- `<RecipeViewer>` — renders a TSL snippet as both code and a small live shader
- `<PrimitiveDemo tsl={...}>` — reusable primitive sandbox component (also reused in Storybook stories for primitives)

### 7.4 Build-time integration with `registry/`

The docs site reaches into the top-level `registry/` directory via a TypeScript path alias (configured in `apps/docs/tsconfig.json` and resolved by Next.js). It is **not** a published workspace package — the alias is purely build-time for the docs app to consume registry sources directly.

```ts
// In MDX or a component page:
import LinearGradientSource from '@matter/registry/linear-gradient.tsx?raw'
import { LinearGradient } from '@matter/registry/linear-gradient'
```

The `?raw` import suffix yields the file as a string for the code block. (Next.js supports `?raw` imports natively in 15+ via Turbopack and via webpack's `asset/source` config.) The same source is imported normally for the live demo. **The code shown in docs is byte-identical to the code the CLI delivers** — there is no separate "documentation copy" of the source.

### 7.5 Hero page

The home page is itself a Matter showcase:

- `<Aurora>` as the hero background
- `<DotField interactive>` in a feature section, with `useTransform` driving its `reach` from scroll position
- `<MeshGradient>` behind the "Components" section header
- `<NoiseField variant="grid">` as a subtle texture in the docs nav background

This serves as both marketing and the most credible scale-test (six components on one page, performant).

### 7.6 Search and theming

- **Search**: Pagefind (open-source, static-friendly, no SaaS dep) for v1
- **Theming**: light/dark/system, with a toggle on every component page (shader output looks dramatically different across backgrounds)
- **MDX**: standard Next.js MDX integration; custom MDX components (`<LiveDemo>`, `<PropsPlayground>`, `<RecipeViewer>`, `<PrimitiveDemo>`) available globally inside MDX files

---

## 8. Performance defaults

Five engine-level behaviors every Matter component gets without per-component code:

| Default                               | Mechanism                                                                                             | Rationale                                                                   |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| **Pause when offscreen**              | `IntersectionObserver` on the canvas; scheduler unsubscribes the component when not visible           | Below-fold shaders shouldn't burn GPU                                       |
| **Render-on-demand for static cases** | If no signal-shaped uniforms changed and `time` isn't used, render once and stop the loop             | `<LinearGradient speed={0}>` should be one frame, not 60/sec                |
| **DPR clamping**                      | `Math.min(devicePixelRatio, 2)` by default; opt-out via `<MatterScene maxDPR={Infinity}>`             | 4K and Retina at full DPR is 4× the pixel work for marginal perceptual gain |
| **Pause when tab hidden**             | `document.visibilityState` listener                                                                   | Background tabs shouldn't render                                            |
| **`prefers-reduced-motion`**          | Detects the media query; multiplies `time` uniform by 0 (paused) or 0.3 (slow) per the user's setting | Accessibility — never ambush users with motion                              |

All five live in `MatterScheduler` and `createRenderer`. Users can override per-`MatterScene` via props or globally via the engine's runtime configuration.

---

## 9. Build / test / CI tooling

| Concern                   | Choice                                             | Notes                                                                                       |
| ------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Monorepo                  | **pnpm workspaces** + **Turborepo**                | Standard; Turborepo for build/test caching                                                  |
| Library bundling          | **tsup** (esbuild) for `@lovo/matter*`             | Library-focused, dual ESM+CJS, faster than Vite library mode                                |
| Docs site bundling        | **Next.js native**                                 | App Router + MDX                                                                            |
| Component dev environment | **Storybook 10 + `@storybook/react-vite`**         | Vite builder; one Storybook instance covers `registry/` and `packages/`                     |
| TypeScript                | strict mode, project references                    | Each package has its own `tsconfig.json` extending `tooling/tsconfig/`                      |
| Lint/format               | **ESLint** + **Prettier**                          | Configs in `tooling/eslint-config/`                                                         |
| Unit tests                | **Vitest**                                         | Engine primitives, hooks, CLI logic                                                         |
| Visual regression         | **Storybook Test Runner** + Playwright             | Snapshots all stories at a fixed frame number to handle rAF non-determinism                 |
| Versioning                | **Changesets**                                     | Independent per-package versioning across the three published packages                      |
| CI                        | GitHub Actions                                     | typecheck · lint · unit tests · storybook build · visual regression · changesets release-PR |
| Browser matrix            | Chrome, Firefox, Safari (current + previous major) | All have WebGPU as of mid-2026; visual regression runs on Chrome and Safari                 |

**Story file layout** (per Tier 1 component):

```tsx
// registry/linear-gradient.stories.tsx
export default { component: LinearGradient } satisfies Meta

export const Default: Story = { args: { colors: ['#ff7b72', '#7b9cff'] } }
export const Animated: Story = { args: { speed: 0.5 } }
export const Interactive: Story = { args: { interactive: true } }
export const WithMotion: Story = {
  /* signal-driven angle */
}
export const Radial: Story = { args: { variant: 'radial' } }
export const Fallback: Story = {
  /* decorator forces WebGPU off */
}
```

These stories double as the dev iteration UI and the visual regression test fixtures.

**Visual regression non-determinism**: Three.js/TSL is inherently nondeterministic at the per-pixel level due to rAF timing variance. The pragmatic answer is "snapshot at a fixed frame number with a tolerance," not pixel-exact. Stories are tested by:

1. Rendering the story in headless Chromium via Playwright
2. Pausing the scheduler at frame N (e.g., frame 60)
3. Taking a screenshot
4. Comparing against the baseline with a small pixel-difference tolerance

---

## 10. v1 milestones

### 10.1 Pacing philosophy

Implementation prefers **many small phases (1–3 days each) with explicit "stop and play" validation gates** over coarse "ship a whole vertical slice" milestones. Every phase ends at a runnable, observable point — something openable in a browser, clickable, feel-able. Feel-decisions (cursor smoothing, animation defaults, prop API ergonomics) surface early on rough prototypes before they propagate across the catalog.

The strategic milestones below are checkpoints in the design doc. The **implementation plan** (produced next via the writing-plans skill) breaks each milestone into ~5–10 sub-phases at the granularity of the example expansion in Section 10.3.

### 10.2 Strategic milestones

| #     | Milestone                                                                                                                                                                                                                                                                                                                                                                    | Validates                                                                                                     |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| **0** | **Repo bootstrap.** Rename `mattermix/` → `matter/`, git init, pnpm workspaces, Turborepo, shared configs, empty package skeletons, CI stubs, LICENSE/README.                                                                                                                                                                                                                | Tooling works                                                                                                 |
| **1** | **Vertical slice — LinearGradient end-to-end.** Engine: `createRenderer`, `MatterScheduler`, `createMaterial`, `colorRamp`, `time`, `CursorInput`. React binding: `<MatterScene>`, `useShaderMaterial`, `useCursor`, `<FallbackBoundary>`, `useAnimatableUniform`. Registry: `linear-gradient.tsx` + stories. Docs: minimal Next.js + one component page. Storybook running. | The whole architecture works on a real running shader; the cursor "feel" decision is made on a real prototype |
| **2** | **CLI.** `init`, `add`, `list`, `update`. Reads `registry.json` from GitHub raw URL. Smoke-test in a fresh Next.js project.                                                                                                                                                                                                                                                  | Distribution model works end-to-end                                                                           |
| **3** | **The other five components.** `mesh-gradient`, `aurora`, `dot-field`, `noise-field`, `waves`. Adds primitives: `noise`, `fbm`, `voronoi`, `gradient`, `sdfCircle`, `quantize`, `displace`, `cursorRipple`, `radialGradient`. Adds input hooks: `useScroll`, `useResize`.                                                                                                    | Tier 1 catalog complete; Tier 2 primitives shaped by real usage                                               |
| **4** | **Docs site polish.** Component pages with `<PropsPlayground>` for all six; primitive pages; 4–6 starter recipes; dogfooded hero page; Pagefind search; theme toggle.                                                                                                                                                                                                        | Distribution + learning surface                                                                               |
| **5** | **Performance + testing + a11y.** All five engine performance defaults. Unit tests (Vitest), visual regression (Storybook Test Runner). `prefers-reduced-motion` honored end-to-end.                                                                                                                                                                                         | Production-ready quality                                                                                      |
| **6** | **Publish.** Changesets release of `@lovo/matter@0.1.0`, `@lovo/matter-react@0.1.0`, `@lovo/matter-cli@0.1.0`. Docs deployment per the user's deployment policies.                                                                                                                                                                                                           | v1 ships                                                                                                      |

Milestones 1 and 2 carry the architectural risk (can the design _be built_?). Once those are green, 3–6 are largely execution.

### 10.3 Sample sub-phase expansion (Milestone 1)

This is the granularity the implementation plan will produce for every milestone:

- **1.1 — Engine package skeleton.** `@lovo/matter` set up with `three` peer dependency, exports nothing yet, builds. _Validation: package builds; types resolve._ ~½ day.
- **1.2 — `createRenderer` in isolation.** Wrap `WebGPURenderer` with WebGPU/WebGL2 fallback. Render a hardcoded TSL fragment to a manually-created `<canvas>` in a tiny HTML test harness. _Stop and play: open the test harness, see TSL run on the GPU._ ~1 day.
- **1.3 — First TSL shader you wrote yourself.** In the same test harness, write a 5-line gradient TSL shader from scratch. _Stop and play: change colors, change math, see the result. Read TSL docs._ ~½–1 day, mostly learning.
- **1.4 — `MatterScheduler`.** Plain rAF batcher class. Tested with two manual canvases sharing one tick. _Validation: a console log fires once per frame._ ~½ day.
- **1.5 — React binding skeleton + `<MatterScene>`.** Mount a renderer, run the scheduler, expose context. Test with a hardcoded child drawing a magenta square. _Stop and play: same magenta square as 1.2, now in React._ ~1 day.
- **1.6 — `useShaderMaterial` + first interactive shader.** Inline `<HardcodedGradient>` test component using `useShaderMaterial` + `useCursor`. _Stop and play: this is the architectural moment of truth — does the cursor feel right? Try smoothing values. Decide if `useCursor`'s API needs revision before propagating._ ~1–2 days.
- **1.7 — `LinearGradient` lifts to `registry/`.** Full v1 prop API. `<FallbackBoundary>` with CSS-gradient default. Storybook stories (Default, Animated, Interactive, Radial, Fallback). Bare-bones docs page. _Stop and play: scrub Storybook args, feel the prop API, capture initial visual regression baselines._ ~1–2 days.

Total: ~6–9 days for Milestone 1 with three explicit learning gates (1.2, 1.3, 1.6).

---

## 11. Open questions and risks

**Architectural / feel decisions deferred to implementation:**

- **Cursor smoothing default value** — gets validated in Phase 1.6 on a running shader. The `useCursor` hook's `smoothing` parameter default is provisional; revise based on feel.
- **Shared scene perf ceiling** — how many simultaneous Matter components does `<MatterScene>` handle gracefully on a typical laptop GPU? Not knowable until Milestone 4 (six components on the docs hero page).
- **CLI registry mechanism** — v1 fetches from GitHub raw URLs. If repo growth or rate limits become an issue, migrate to a hosted JSON endpoint. Defer until evidence demands it.

**Operational / deployment:**

- **Docs site deployment platform** — chosen at deployment time per the user's deployment policies. Design works on any Next.js-compatible host.
- **WebGPU support in target browsers** — current as of mid-2026 in Chrome, Edge, Safari, and Firefox (recently). Some users will still hit WebGL2 fallback; that's expected and tested.

**Visual regression non-determinism:**

- Snapshots at fixed frame numbers with a small pixel-difference tolerance. Acceptable tolerance value chosen empirically in Milestone 5.

**Risks:**

- **Storybook 10 + Vite + WebGPU + TSL interaction** — Storybook 10 is recent; if a specific addon or builder integration fails, falling back to a chrome-less route in `apps/docs` (Option C from the brainstorming) is a known escape hatch.
- **Three.js TSL stability** — TSL is still evolving in Three.js. API shifts in Three.js minor releases may require version pinning and migration work. Acceptable risk for the engine layer's value; mitigated by re-exporting TSL primitives through `@lovo/matter` so user code is shielded from Three.js renames.

---

## 12. Glossary

For the user's reference while learning shaders. Terms used throughout this doc.

- **Shader** — a small program that runs on the GPU, executed in parallel for every vertex (vertex shader) or every pixel (fragment shader).
- **TSL (Three Shading Language)** — Three.js's node-based shader authoring API. Compiles to either WebGPU's WGSL or WebGL2's GLSL automatically.
- **WebGPU** — modern browser GPU API; successor to WebGL.
- **WebGL2** — older browser GPU API; near-universal browser support. TSL targets both.
- **Uniform** — a value that the shader reads but doesn't change per-pixel (e.g., color, time, cursor position). The bridge between React props and the GPU.
- **Attribute** — per-vertex data (positions, UVs, normals). Less directly relevant for fullscreen-effect components, which use a single quad.
- **UV** — 2D coordinate (0,0) to (1,1) across a surface. The most common spatial input to a fragment shader.
- **FBM (Fractal Brownian Motion)** — sums of noise at multiple scales; produces "cloudy" or "marbled" patterns.
- **Voronoi** — cell pattern based on distance to scattered points; used for organic, scattered looks.
- **SDF (Signed Distance Field)** — function returning distance from a point to a shape; positive outside, negative inside. Foundation for shape rendering in shaders.
- **Render loop** — function called ~60 times per second (`requestAnimationFrame`) to redraw the scene.
- **Renderer** — the object that owns the GPU connection and translates a scene description into draw calls. Three.js's `WebGPURenderer` or `WebGLRenderer`.
- **DPR (devicePixelRatio)** — ratio of physical pixels to CSS pixels. 2 on most Retina displays.
- **rAF (requestAnimationFrame)** — browser API for syncing redraws to display refresh.
- **react-three-fiber (r3f)** — popular React reconciler for Three.js. **Matter does not depend on r3f**, but is compatible with users who use r3f via the Mode 3 hook integration pattern.

---

## Appendix A — Decisions log (from brainstorming)

For traceability. Each decision was made through Q&A during the 2026-05-01..02 brainstorming session.

| #   | Question                                         | Choice                                                                                                     |
| --- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| 1   | Audience layering                                | Both layered: curated effects on top + primitives underneath                                               |
| 2   | Effect categories scope                          | All categories eventually; v1 scoped to backgrounds + cursor interaction                                   |
| 3   | Renderer ownership                               | Hybrid (drop-in default + `MatterScene` for shared rendering) — refined to drop r3f dependency             |
| 4   | Distribution model                               | Hybrid (engine npm package + CLI copy-paste for components)                                                |
| 5   | Browser support                                  | WebGPU + WebGL2 fallback (free via TSL)                                                                    |
| 6   | SSR/Next.js                                      | Client-only with sensible default fallback + `fallback` prop                                               |
| 7   | Cursor architecture                              | Hybrid (`interactive` prop default + `inputs` for advanced)                                                |
| 8   | Styling integration                              | Sensible default (`absolute inset-0`) + className override                                                 |
| 9   | v1 component catalog                             | All six: LinearGradient, MeshGradient, Aurora, DotField, NoiseField, Waves                                 |
| 10  | Docs site framework                              | Next.js custom (with framework switcher infra, hidden in v1)                                               |
| —   | Multi-framework approach                         | Framework-agnostic engine; React binding only in v1; deliver code via tabs (not run multi-framework demos) |
| —   | Three-tier model (Components/Primitives/Recipes) | Adopted to scale catalog without infinite component count                                                  |
| —   | Animation library                                | Don't ship; accept MotionValue-shaped signals via `AnimatableProp<T>`                                      |
| —   | Component dev environment                        | Storybook 10 + `@storybook/react-vite`                                                                     |
| —   | Build approach                                   | Approach 1: monorepo from day one + vertical slice; many small phases over few large ones                  |
| —   | Package naming                                   | `@lovo/matter`, `@lovo/matter-react`, `@lovo/matter-cli`                                                   |

---

_Next step after user review of this spec: writing-plans skill produces the granular implementation plan._

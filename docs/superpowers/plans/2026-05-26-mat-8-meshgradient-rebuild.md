# MeshGradient Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `<MeshGradient>`'s inverse-distance N-point algorithm with a warped 4-color fluid gradient (noise rotation + sine domain warp + two-layer smoothstep blend + time-cycling palette + film grain), ported step-by-step from a ShaderToy reference so each technique is learned in isolation.

**Architecture:** Mirror the Aurora structural split. The single `registry/mesh-gradient.tsx` becomes a folder `registry/mesh-gradient/` with `mesh-gradient.tsx` (props + thin wrapper) and `shader.tsx` (TSL shader + uniform plumbing). The shader is built in seven phases, each ending at a runnable, observable state in `/components/mesh-gradient` with new Tweakpane controls added per phase. Per CLAUDE.md: no GPU-mocked unit tests for the shader (only the Tier 2 `filmGrain` primitive in Phase 6 gets a Vitest test). Visual verification is the docs page playground; Playwright baselines are regenerated once at the end of Phase 7.

**Tech Stack:** TypeScript 5 strict, three/webgpu, three/tsl (`uv`, `vec2`, `vec3`, `vec4`, `mix`, `smoothstep`, `sin`, `cos`, `dot`, `fract`, `pow`, `sign`, `abs`, `floor`, `length`, `uniform`), `@lovo/matter` (`noise`, `time`, new `filmGrain` in Phase 6), `@lovo/matter-react` (`useMatterContext`, `useAnimatableUniform`, `useResize`), Tweakpane (playground), Playwright (visual baselines regenerated in Phase 7).

**Reference shader:** ShaderToy GLSL provided by user. Inspired by https://www.shadertoy.com/view/wdyczG (CC BY-NC-SA 3.0).

**Translation gotchas (called out where they apply):**
- ShaderToy's `noise()` returns `[0, 1]`. `@lovo/matter`'s `noise()` wraps `mx_noise_float` and returns approximately `[-1, 1]`. Remap with `.mul(0.5).add(0.5)` when the original expression assumes `[0, 1]`.
- ShaderToy chains TSL-incompatible patterns freely. Per CLAUDE.md gotcha #12: build TSL expressions starting from `uv()` / `vec2(...)` literals; uniforms only ever appear as **arguments** to chained methods, never as the receiver.
- Strict-Mode-safe disposal: wrap `material.dispose()` and `geometry.dispose()` in `try`/`catch` (CLAUDE.md gotcha #14 + the existing aurora pattern).

**Out of scope:**
- Reintroducing the inverse-distance N-point algorithm or its `points`, `blur`, `interactive`, `strength`, `inputs.cursor` props. Anyone who wants the old version pulls from the `m6-complete` tag.
- Cursor reactivity on the new shader. Deferred to a v2 follow-up.
- Refactoring Aurora/Waves/etc. to consume the new `filmGrain` primitive from Phase 6 — extraction is additive only.

---

## File Structure

**Created:**
- `registry/mesh-gradient/mesh-gradient.tsx` — thin wrapper with defaulted props, forwards to `MeshGradientShader`.
- `registry/mesh-gradient/shader.tsx` — `MeshGradientShader` component: uniform plumbing + `useEffect` that builds the TSL shader and mounts the mesh.
- `packages/matter/src/primitives/filmGrain.ts` (Phase 6 only, if extraction proceeds) — `filmGrain(uv, intensity)` TSL helper.
- `packages/matter/src/primitives/filmGrain.test.ts` (Phase 6 only) — Vitest smoke test for the helper.
- `.changeset/<random>.md` (Phase 6 only, if extraction proceeds) — minor bump for `@lovo/matter`.

**Modified:**
- `registry/package.json` — change `"./mesh-gradient": "./mesh-gradient.tsx"` to `"./mesh-gradient": "./mesh-gradient/mesh-gradient.tsx"`.
- `registry/registry.json` — update `mesh-gradient` entry (file path, description, `uses_primitives`).
- `apps/docs/src/app/components/mesh-gradient/page.tsx` — rebuilt Tweakpane controls + Copy JSX / Copy params / Reset all buttons, mirroring `apps/docs/src/app/components/aurora/page.tsx`.
- `packages/matter/src/index.ts` (Phase 6 only) — export the new `filmGrain` primitive.
- `docs/superpowers/specs/2026-05-02-matter-design.md` — rewrite the `<MeshGradient>` subsection at line 414 to describe the new algorithm and prop shape.

**Deleted:**
- `registry/mesh-gradient.tsx` — replaced by the folder layout.
- `apps/docs/src/app/dev/mesh-gradient-playground/page.tsx` and `apps/docs/src/app/dev/mesh-gradient-playground/MeshGradientPlaygroundScene.tsx` — M3.4.b prototype scaffolding, obsolete now that the public docs page is the playground (matches Aurora's pattern of having no `/dev/aurora-playground`).
- `apps/docs-tests/visual/mesh-gradient.spec.ts-snapshots/mesh-gradient-default-chromium-darwin.png` and `…-linux.png` — regenerated in Phase 7.

---

## Task 1: Scaffold the Aurora-style split, render solid color

Goal: file structure flipped to the folder layout, dev server renders a solid color where MeshGradient used to be. No visual logic yet — just plumbing.

**Files:**
- Create: `registry/mesh-gradient/shader.tsx`
- Create: `registry/mesh-gradient/mesh-gradient.tsx`
- Modify: `registry/package.json`
- Modify: `registry/registry.json`
- Modify: `apps/docs/src/app/components/mesh-gradient/page.tsx`
- Delete: `registry/mesh-gradient.tsx`
- Delete: `apps/docs/src/app/dev/mesh-gradient-playground/page.tsx`
- Delete: `apps/docs/src/app/dev/mesh-gradient-playground/MeshGradientPlaygroundScene.tsx`

- [ ] **Step 1: Create the shader file with a solid color**

Create `registry/mesh-gradient/shader.tsx`:

```tsx
'use client'

import { useEffect } from 'react'
import { Mesh, MeshBasicNodeMaterial, PlaneGeometry } from 'three/webgpu'
import { vec4 } from 'three/tsl'

import { useMatterContext } from '@lovo/matter-react'

export interface MeshGradientShaderProps {
  // Phases 2+ will add props here; Phase 1 renders a hardcoded solid color.
}

export function MeshGradientShader(_props: MeshGradientShaderProps) {
  const ctx = useMatterContext()

  useEffect(() => {
    if (!ctx) return
    const material = new MeshBasicNodeMaterial()
    material.colorNode = vec4(0.1, 0.1, 0.2, 1)
    const mesh = new Mesh(new PlaneGeometry(2, 2), material)
    ctx.scene.add(mesh)
    return () => {
      ctx.scene.remove(mesh)
      try {
        material.dispose()
      } catch {
        // three/webgpu can throw during dispose under Strict Mode double-invoke
      }
      try {
        mesh.geometry.dispose()
      } catch {
        // same
      }
    }
  }, [ctx])

  return null
}
```

- [ ] **Step 2: Create the wrapper file**

Create `registry/mesh-gradient/mesh-gradient.tsx`:

```tsx
'use client'

import { MeshGradientShader } from './shader'

export interface MeshGradientProps {
  // Phases 2+ will add props here; defaults forward to MeshGradientShader.
}

export function MeshGradient(_props: MeshGradientProps = {}) {
  return <MeshGradientShader />
}
```

- [ ] **Step 3: Update the registry workspace exports**

Edit `registry/package.json`. Change:

```json
"./mesh-gradient": "./mesh-gradient.tsx",
```

to:

```json
"./mesh-gradient": "./mesh-gradient/mesh-gradient.tsx",
```

- [ ] **Step 4: Update registry.json metadata**

Edit `registry/registry.json`. Replace the `"mesh-gradient"` block with:

```json
"mesh-gradient": {
  "file": "mesh-gradient/mesh-gradient.tsx",
  "description": "Warped 4-color fluid gradient with time-cycling palette and film grain. Linear/Stripe marketing-page style.",
  "dependencies": ["@lovo/matter", "@lovo/matter-react", "react", "three"],
  "uses_primitives": [
    "noise",
    "time",
    "uv",
    "vec2",
    "vec3",
    "vec4",
    "mix",
    "smoothstep",
    "sin",
    "cos",
    "dot",
    "pow",
    "uniform"
  ],
  "tier": 1
},
```

(Phase 6 may add `filmGrain` to `uses_primitives`; Phase 7 finalizes the list.)

- [ ] **Step 5: Delete the old single-file component**

Run:

```bash
rm registry/mesh-gradient.tsx
```

- [ ] **Step 6: Strip the old props from the docs page**

Edit `apps/docs/src/app/components/mesh-gradient/page.tsx`. Replace the entire file with a minimal bare-component version (we'll grow Tweakpane controls back in Phases 3–7):

```tsx
// apps/docs/app/components/mesh-gradient/page.tsx
'use client'

import dynamic from 'next/dynamic'
import { VisualTestPause } from '@/lib/visualTestHooks'

const MatterScene = dynamic(() => import('@lovo/matter-react').then((m) => m.MatterScene), {
  ssr: false,
})
const MeshGradient = dynamic(
  () => import('@matter/registry/mesh-gradient').then((m) => m.MeshGradient),
  { ssr: false },
)

export default function MeshGradientPage() {
  return (
    <main style={{ minHeight: '100vh', position: 'relative' }}>
      <div style={{ position: 'relative', height: '70vh' }}>
        <MatterScene>
          <MeshGradient />
          <VisualTestPause />
        </MatterScene>
      </div>
      <section style={{ padding: '2rem', maxWidth: '60ch', margin: '0 auto' }}>
        <h1 style={{ marginTop: 0 }}>&lt;MeshGradient /&gt;</h1>
        <p>Rebuild in progress. Tweakpane controls return in later phases.</p>
      </section>
    </main>
  )
}
```

- [ ] **Step 7: Delete the obsolete dev playground**

Run:

```bash
rm -rf apps/docs/src/app/dev/mesh-gradient-playground
```

- [ ] **Step 8: Verify dev server renders**

Run:

```bash
pnpm --filter @matter/docs dev
```

In a browser, open `http://localhost:3000/components/mesh-gradient`. Expected: a 70vh dark navy (`vec3(0.1, 0.1, 0.2)`) rectangle with the page heading below. Confirm no console errors. Stop the dev server (`Ctrl-C`).

- [ ] **Step 9: Typecheck and lint**

Run:

```bash
pnpm typecheck && pnpm lint
```

Expected: both pass cleanly. The registry, the React binding, the docs app, and the docs-tests app are all in scope.

- [ ] **Step 10: Commit**

```bash
git add registry/mesh-gradient/ registry/package.json registry/registry.json \
        apps/docs/src/app/components/mesh-gradient/page.tsx
git rm registry/mesh-gradient.tsx
git rm -r apps/docs/src/app/dev/mesh-gradient-playground
git commit -m "refactor(registry): scaffold MeshGradient as folder with empty shader (MAT-8 phase 1)"
```

---

## Task 2: UV setup + aspect-corrected noise rotation, static 4-color quadrant gradient

Goal: render a slowly-rotating 4-color quadrant gradient. No domain warp, no palette cycling, no grain. The shader rotates a centered UV by a noise-driven angle, then maps each quadrant of the rotated UV to one of four hardcoded colors. After this phase you can *see* what aspect-corrected rotation and `mx_noise_float` look like in motion.

**Concepts taught:**
- `tuv = uv() - 0.5` centers the rotation pivot at the middle of the canvas.
- Aspect correction around rotation (`tuv.y /= aspect`, rotate, `tuv.y *= aspect`) prevents the rotation from squashing in non-square canvases.
- The 2D rotation matrix `Rot(a) = mat2(c, -s, s, c)` becomes, in component form, `(c*x - s*y, s*x + c*y)`. TSL doesn't have `mat2`, so we apply the rotation componentwise.
- ShaderToy's `noise()` returns `[0, 1]`; `@lovo/matter`'s `noise()` returns `~[-1, 1]`. Remap with `.mul(0.5).add(0.5)`.

**Files:**
- Modify: `registry/mesh-gradient/shader.tsx`

- [ ] **Step 1: Replace shader.tsx with the rotation + quadrant code**

Overwrite `registry/mesh-gradient/shader.tsx`:

```tsx
'use client'

import { useEffect, useMemo } from 'react'
import { Mesh, MeshBasicNodeMaterial, PlaneGeometry, Vector2 } from 'three/webgpu'
import type { Node } from 'three/webgpu'
import { uv, vec2, vec3, vec4, sin, cos, uniform, type ShaderNodeObject } from 'three/tsl'

import { time, noise } from '@lovo/matter'
import { useMatterContext, useResize } from '@lovo/matter-react'

export interface MeshGradientShaderProps {
  // Props grow in later phases.
}

// Four hardcoded debug colors — one per rotated-UV quadrant. Replaced by the
// two-layer smoothstep blend in Phase 4.
const DEBUG_COLORS = {
  tl: vec3(0.96, 0.73, 0.54), // amberYellow
  tr: vec3(0.19, 0.38, 0.93), // deepBlue
  br: vec3(0.96, 0.57, 0.57), // pink
  bl: vec3(0.35, 0.71, 0.95), // blue
} as const

export function MeshGradientShader(_props: MeshGradientShaderProps) {
  const ctx = useMatterContext()
  const resize = useResize()

  // Resolution uniform — drives aspect correction. Seed with a sane large
  // default so the first frame doesn't see (1, 1). Pattern from Aurora.
  const resVec = useMemo(() => new Vector2(1920, 1080), [])
  const resNode = useMemo(() => uniform(resVec) as unknown as ShaderNodeObject<Node>, [resVec])
  useEffect(() => {
    const [w, h] = resize.get()
    if (w > 0 && h > 0) resVec.set(w, h)
    return resize.on('change', ([w2, h2]) => resVec.set(w2, h2))
  }, [resize, resVec])

  useEffect(() => {
    if (!ctx) return

    // ---- Centered UVs --------------------------------------------------
    // tuv = uv - 0.5  puts (0,0) at the center, range [-0.5, 0.5].
    const tuvRaw = uv().sub(vec2(0.5, 0.5)) as ShaderNodeObject<Node>

    // ---- Noise-driven rotation angle ----------------------------------
    // ShaderToy uses noise(vec2(time*0.05, tuv.x*tuv.y)) which is per-pixel
    // (rotation varies across the screen). Engine noise returns ~[-1, 1];
    // remap to [0, 1] to match the source.
    const tSlow = (time as ShaderNodeObject<Node>).mul(0.05)
    const noiseInput = vec2(tSlow, (tuvRaw as ShaderNodeObject<Node>).x.mul(tuvRaw.y))
    const degree01 = noise(noiseInput).mul(0.5).add(0.5) // [0, 1]
    // angle = (degree01 - 0.5) * (720° in radians) + 180° in radians
    //       = (degree01 - 0.5) * 4π + π
    const TWO_TURNS_RAD = Math.PI * 4
    const ROT_BIAS_RAD = Math.PI
    const angle = degree01.sub(0.5).mul(TWO_TURNS_RAD).add(ROT_BIAS_RAD) as ShaderNodeObject<Node>

    // ---- Aspect-corrected rotation -----------------------------------
    // Pre-divide y by aspect so the rotation operates in unit space, then
    // restore y after. (CLAUDE.md gotcha #12: build chains from tuvRaw
    // literals; resNode appears only as the argument of .div().)
    const aspect = resNode.x.div(resNode.y)
    const ty = tuvRaw.y.div(aspect)
    const c = cos(angle)
    const s = sin(angle)
    // Componentwise rotation: (x', y') = (c*x - s*y, s*x + c*y).
    const rx = tuvRaw.x.mul(c).sub(ty.mul(s))
    const ryUnit = tuvRaw.x.mul(s).add(ty.mul(c))
    const ry = ryUnit.mul(aspect)
    const tuv = vec2(rx, ry) as ShaderNodeObject<Node>

    // ---- Quadrant color picking --------------------------------------
    // tuv is now rotated-and-centered. Pick a color by sign of x and y so
    // we can see the rotation visually. Each `step` returns 0 or 1; we use
    // them as mix factors. (smoothstep on a zero-width edge ≡ step.)
    // Lerp horizontally between left & right colors per row, then vertically.
    const isRight = tuv.x.greaterThan(0).select(1, 0) as ShaderNodeObject<Node>
    const isTop = tuv.y.greaterThan(0).select(1, 0) as ShaderNodeObject<Node>
    const topRow = DEBUG_COLORS.tl.mul(isRight.oneMinus()).add(DEBUG_COLORS.tr.mul(isRight))
    const bottomRow = DEBUG_COLORS.bl.mul(isRight.oneMinus()).add(DEBUG_COLORS.br.mul(isRight))
    const color = bottomRow.mul(isTop.oneMinus()).add(topRow.mul(isTop)) as ShaderNodeObject<Node>

    const material = new MeshBasicNodeMaterial()
    material.colorNode = vec4(color, 1)

    const mesh = new Mesh(new PlaneGeometry(2, 2), material)
    ctx.scene.add(mesh)
    return () => {
      ctx.scene.remove(mesh)
      try {
        material.dispose()
      } catch {
        // three/webgpu can throw during dispose under Strict Mode double-invoke
      }
      try {
        mesh.geometry.dispose()
      } catch {
        // same
      }
    }
  }, [ctx, resNode])

  return null
}
```

- [ ] **Step 2: Run dev server and verify rotation**

Run:

```bash
pnpm --filter @matter/docs dev
```

Open `http://localhost:3000/components/mesh-gradient`. Expected: 4 hard-edged color quadrants (amber top-left, blue top-right, pink bottom-right, light-blue bottom-left in their starting orientation), with the whole rotation slowly drifting because each pixel rotates by a different angle (it'll look more like a flowing color smear than a rigid rotation — that's the noise per-pixel behavior). Verify the boundary between colors moves continuously with no flicker. Stop the dev server.

- [ ] **Step 3: Typecheck**

```bash
pnpm typecheck
```

Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add registry/mesh-gradient/shader.tsx
git commit -m "feat(mesh-gradient): aspect-corrected noise rotation with quadrant debug colors (MAT-8 phase 2)"
```

---

## Task 3: Sine domain warp + frequency/amplitude/speed props

Goal: add the ShaderToy sine domain warp. The 4-color quadrant boundary now wobbles instead of being a straight line through the rotation center. Three new props become live uniforms with Tweakpane sliders.

**Concepts taught:**
- **Domain warping**: instead of changing what color we draw at a point, we move the point itself before sampling. `tuv.x += sin(tuv.y*freq + speed)/amp` shifts each row horizontally by a sine of its own height, smearing the gradient.
- `useAnimatableUniform` from `@lovo/matter-react` accepts `AnimatableProp<number>` (plain numbers OR MotionValue-shaped signals) and returns a TSL uniform whose `.value` is auto-synced.

**Files:**
- Modify: `registry/mesh-gradient/shader.tsx`
- Modify: `registry/mesh-gradient/mesh-gradient.tsx`
- Modify: `apps/docs/src/app/components/mesh-gradient/page.tsx`

- [ ] **Step 1: Add the three new props + uniforms in shader.tsx**

Edit `registry/mesh-gradient/shader.tsx`. Update the imports to include `useAnimatableUniform` and the props type:

```tsx
import {
  useMatterContext,
  useResize,
  useAnimatableUniform,
  type AnimatableProp,
} from '@lovo/matter-react'
```

Replace the `MeshGradientShaderProps` interface with:

```tsx
export interface MeshGradientShaderProps {
  /** Global animation rate. Multiplies the time the warp uses. Default 2 (ShaderToy default). */
  speed: AnimatableProp<number>
  /** Sine warp frequency. Higher = more wobbles per gradient. Default 5. */
  frequency: AnimatableProp<number>
  /** Sine warp amplitude divisor. Higher = subtler wobble. Default 30. */
  amplitude: AnimatableProp<number>
}
```

In the component body, just below the `resize` line, add:

```tsx
const speedU = useAnimatableUniform<number>(_props.speed)
const frequencyU = useAnimatableUniform<number>(_props.frequency)
const amplitudeU = useAnimatableUniform<number>(_props.amplitude)
```

Rename `_props` → `props` in the signature now that we're using them:

```tsx
export function MeshGradientShader(props: MeshGradientShaderProps) {
```

…and update the three uniform-creating lines to `props.speed` / `props.frequency` / `props.amplitude`.

- [ ] **Step 2: Insert the domain warp between rotation and color picking**

In the same `useEffect`, between the rotation block (which produces `tuv`) and the quadrant color-picking block, insert the sine warp. Rename the existing `const tuv = vec2(rx, ry)` line to `const tuvRotated = vec2(rx, ry)`, then insert the warp block and a new `const tuv = …` immediately after:

```tsx
    const tuvRotated = vec2(rx, ry) as ShaderNodeObject<Node>

    // ---- Sine domain warp -------------------------------------------
    // tuv.x += sin(tuv.y * frequency + tspeed) / amplitude
    // tuv.y += sin(tuv.x * frequency * 1.5 + tspeed) / (amplitude * 0.5)
    // The 1.5× on the y-axis frequency and 0.5× on its amplitude come from
    // the source — they de-correlate the two warps so the visual doesn't
    // look like a single skew.
    //
    // Note on the y-axis amplitude: the source writes `/ (amplitude * 0.5)`,
    // which is equivalent to `/ amplitude * 2`. We use the latter form
    // because uniforms can't be pre-multiplied by JS numbers ahead of time —
    // chains must keep the uniform as an *argument*, not as a receiver of a
    // JS-side `*`. (CLAUDE.md gotcha #12: build TSL chains starting from
    // literals / `uv()` / `vec2(...)`; uniforms only ever appear as args.)
    const tspeed = (time as ShaderNodeObject<Node>).mul(speedU as unknown as number)
    const warpX = sin(tuvRotated.y.mul(frequencyU as unknown as number).add(tspeed)).div(
      amplitudeU as unknown as number,
    )
    const warpY = sin(
      tuvRotated.x
        .mul(frequencyU as unknown as number)
        .mul(1.5)
        .add(tspeed),
    )
      .div(amplitudeU as unknown as number)
      .mul(2)
    const tuv = vec2(tuvRotated.x.add(warpX), tuvRotated.y.add(warpY)) as ShaderNodeObject<Node>

    // ---- Quadrant color picking (unchanged from Phase 2) ------------
    const isRight = tuv.x.greaterThan(0).select(1, 0) as ShaderNodeObject<Node>
    const isTop = tuv.y.greaterThan(0).select(1, 0) as ShaderNodeObject<Node>
    const topRow = DEBUG_COLORS.tl.mul(isRight.oneMinus()).add(DEBUG_COLORS.tr.mul(isRight))
    const bottomRow = DEBUG_COLORS.bl.mul(isRight.oneMinus()).add(DEBUG_COLORS.br.mul(isRight))
    const color = bottomRow.mul(isTop.oneMinus()).add(topRow.mul(isTop)) as ShaderNodeObject<Node>
```

Update the `useEffect` deps array to include the new uniforms:

```tsx
}, [ctx, resNode, speedU, frequencyU, amplitudeU])
```

- [ ] **Step 3: Update the wrapper with defaults**

Overwrite `registry/mesh-gradient/mesh-gradient.tsx`:

```tsx
'use client'

import { MeshGradientShader } from './shader'
import type { AnimatableProp } from '@lovo/matter-react'

export interface MeshGradientProps {
  /** Global animation rate. Default 2. */
  speed?: AnimatableProp<number>
  /** Sine warp frequency. Default 5. */
  frequency?: AnimatableProp<number>
  /** Sine warp amplitude divisor (higher = subtler). Default 30. */
  amplitude?: AnimatableProp<number>
}

export function MeshGradient({
  speed = 2,
  frequency = 5,
  amplitude = 30,
}: MeshGradientProps = {}) {
  return <MeshGradientShader speed={speed} frequency={frequency} amplitude={amplitude} />
}
```

- [ ] **Step 4: Wire Tweakpane controls in the docs page**

Replace `apps/docs/src/app/components/mesh-gradient/page.tsx` with:

```tsx
// apps/docs/app/components/mesh-gradient/page.tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { Pane } from 'tweakpane'
import dynamic from 'next/dynamic'
import { VisualTestPause } from '@/lib/visualTestHooks'

const MatterScene = dynamic(() => import('@lovo/matter-react').then((m) => m.MatterScene), {
  ssr: false,
})
const MeshGradient = dynamic(
  () => import('@matter/registry/mesh-gradient').then((m) => m.MeshGradient),
  { ssr: false },
)

interface Params {
  speed: number
  frequency: number
  amplitude: number
}

const INITIAL: Params = { speed: 2, frequency: 5, amplitude: 30 }

export default function MeshGradientPage() {
  const paneContainerRef = useRef<HTMLDivElement>(null)
  const [params, setParams] = useState<Params>(INITIAL)

  useEffect(() => {
    const container = paneContainerRef.current
    if (!container) return
    const local: Params = { ...INITIAL }
    const pane = new Pane({ container, title: '<MeshGradient>' })
    pane.addBinding(local, 'speed', { min: 0, max: 5, step: 0.01 })
    pane.addBinding(local, 'frequency', { min: 0.5, max: 20, step: 0.1 })
    pane.addBinding(local, 'amplitude', { min: 5, max: 100, step: 0.5 })
    pane.on('change', () => setParams({ ...local }))
    return () => pane.dispose()
  }, [])

  return (
    <main style={{ minHeight: '100vh', position: 'relative' }}>
      <div style={{ position: 'relative', height: '70vh' }}>
        <MatterScene>
          <MeshGradient
            speed={params.speed}
            frequency={params.frequency}
            amplitude={params.amplitude}
          />
          <VisualTestPause />
        </MatterScene>
        <div
          ref={paneContainerRef}
          data-tweakpane-host
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            zIndex: 10,
            width: '320px',
          }}
        />
      </div>
      <section style={{ padding: '2rem', maxWidth: '60ch', margin: '0 auto' }}>
        <h1 style={{ marginTop: 0 }}>&lt;MeshGradient /&gt;</h1>
        <p>Phase 3 — sine domain warp. Palette + grain return in later phases.</p>
      </section>
    </main>
  )
}
```

- [ ] **Step 5: Run dev server and verify domain warp**

Run:

```bash
pnpm --filter @matter/docs dev
```

Open `/components/mesh-gradient`. Expected: the rotating quadrant boundary now has wavy edges that drift over time. Drag the `frequency` slider from 1 to 15: low end = a single curve, high end = many wiggles per row. Drag `amplitude` from 100 down to 10: warp gets dramatic. Drag `speed` to 0: warp freezes. Stop dev server.

- [ ] **Step 6: Typecheck**

```bash
pnpm typecheck
```

Expected: pass.

- [ ] **Step 7: Commit**

```bash
git add registry/mesh-gradient/ apps/docs/src/app/components/mesh-gradient/page.tsx
git commit -m "feat(mesh-gradient): add sine domain warp with frequency/amplitude/speed props (MAT-8 phase 3)"
```

---

## Task 4: Two-layer smoothstep blend with single hardcoded palette

Goal: replace the hard quadrant boundary with the ShaderToy two-layer smoothstep blend. Result is a smooth Linear-style fluid 4-color gradient. The palette is still hardcoded — Phase 5 adds time cycling.

**Concepts taught:**
- `smoothstep(edge0, edge1, x)` returns 0 below `edge0`, 1 above `edge1`, and a smooth cubic in between. Using it as a mix factor turns a hard boundary into a gradient.
- Layer composition: build two horizontal gradients (each spanning two of the four colors) and blend them vertically. The two `smoothstep` edges in the source are asymmetric (`-0.3, 0.2` horizontally; `0.5, -0.3` inverted vertically) — those are part of the "feel" of this look.
- The `mat2(c, -s, s, c)` applied to `tuv` for the layer-1/2 sample uses an additional `-5°` rotation, which is the small visual quirk that gives the bands a slight tilt independent of the noise rotation. We bake it as a constant (no prop) for now.

**Files:**
- Modify: `registry/mesh-gradient/shader.tsx`

- [ ] **Step 1: Replace the quadrant block with the two-layer smoothstep blend**

In `registry/mesh-gradient/shader.tsx`, add `smoothstep` to the `three/tsl` imports:

```tsx
import {
  uv,
  vec2,
  vec3,
  vec4,
  sin,
  cos,
  smoothstep,
  uniform,
  type ShaderNodeObject,
} from 'three/tsl'
```

Delete the `DEBUG_COLORS` constant. Add a single hardcoded palette constant in its place:

```tsx
// Light-palette colors from the ShaderToy source. Phase 5 adds a second
// palette + time-based crossfade.
const PALETTE = {
  amberYellow: vec3(299 / 255, 186 / 255, 137 / 255),
  deepBlue: vec3(49 / 255, 98 / 255, 238 / 255),
  pink: vec3(246 / 255, 146 / 255, 146 / 255),
  blue: vec3(89 / 255, 181 / 255, 243 / 255),
} as const

// −5° in radians; baked into the layer rotation. Kept as a constant for now;
// can be promoted to a prop in v2 if it proves useful.
const LAYER_ROT_RAD = (-5 * Math.PI) / 180
```

In the `useEffect`, replace the entire "Quadrant color picking" block (everything from `const isRight = …` down to the `const color = …` line) with:

```tsx
    // ---- Two-layer smoothstep blend ---------------------------------
    // Sample tuv through a small additional rotation (-5°), and use the
    // resulting x to pick a smooth horizontal gradient per "layer."
    const lc = Math.cos(LAYER_ROT_RAD)
    const ls = Math.sin(LAYER_ROT_RAD)
    const layerX = tuv.x.mul(lc).sub(tuv.y.mul(ls)) as ShaderNodeObject<Node>

    // smoothstep(-0.3, 0.2, layerX): 0 on the far left, 1 on the right of
    // the canvas, smooth cubic transition through center.
    const hMix = smoothstep(-0.3, 0.2, layerX) as ShaderNodeObject<Node>
    // mix(a, b, t): t=0 -> a, t=1 -> b. So far-left = first color, far-right
    // = second color.
    const layer1 = PALETTE.pink.mul(hMix.oneMinus()).add(PALETTE.deepBlue.mul(hMix))
    const layer2 = PALETTE.blue.mul(hMix.oneMinus()).add(PALETTE.amberYellow.mul(hMix))

    // Vertical blend between the two layers. Note the inverted edges
    // (0.5 -> -0.3) which flip the smoothstep direction — top of canvas
    // gets layer2, bottom gets layer1. (This is from the source; the
    // bottom-then-top order is unusual but matches the reference look.)
    const vMix = smoothstep(0.5, -0.3, tuv.y) as ShaderNodeObject<Node>
    const color = layer1.mul(vMix.oneMinus()).add(layer2.mul(vMix)) as ShaderNodeObject<Node>
```

- [ ] **Step 2: Run dev server and verify smooth blend**

Run:

```bash
pnpm --filter @matter/docs dev
```

Open `/components/mesh-gradient`. Expected: a smooth, slowly-warping 4-color gradient — pink/blue on one side, amber/deep-blue on the other, blending continuously with no visible boundaries. Drag `amplitude` low (10) — the warp dominates and creates dramatic curls. Drag `amplitude` high (100) — almost smooth. Stop dev server.

- [ ] **Step 3: Typecheck**

```bash
pnpm typecheck
```

Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add registry/mesh-gradient/shader.tsx
git commit -m "feat(mesh-gradient): two-layer smoothstep blend with hardcoded palette (MAT-8 phase 4)"
```

---

## Task 5: Time-cycling palette (paletteA ↔ paletteB)

Goal: introduce a second palette (the "dark" set from the source) and crossfade between the two over time using an eased S-curve. Both palettes become props.

**Concepts taught:**
- An eased S-curve: `t = (sign(c)*pow(|c|, 0.6) + 1) / 2` where `c = sin(time*cycleSpeed)`. `sin` alone gives a smooth back-and-forth, but `pow(|c|, 0.6)` pushes time to "linger" at the extremes (palette A and palette B) and pass through the midpoint faster. The user feels two stable looks separated by a quick transition.
- Reactive color uniforms: hex strings need to update without rebuilding the material. Pattern: `useColorUniform(hex)` from Aurora's shader.tsx — keep a `Vector3` instance, wrap it in `uniform(...)`, and mutate `.set(r, g, b)` when the prop changes.

**Files:**
- Modify: `registry/mesh-gradient/shader.tsx`
- Modify: `registry/mesh-gradient/mesh-gradient.tsx`
- Modify: `apps/docs/src/app/components/mesh-gradient/page.tsx`

- [ ] **Step 1: Add palette props + color uniforms in shader.tsx**

Edit `registry/mesh-gradient/shader.tsx`. Add to the `three/tsl` imports: `mix`, `sign`, `abs`, `pow`. Add to the `three/webgpu` imports: `Vector3`. Update the props type:

```tsx
export interface MeshGradientShaderProps {
  speed: AnimatableProp<number>
  frequency: AnimatableProp<number>
  amplitude: AnimatableProp<number>
  /** Cycle rate between paletteA and paletteB. Default 0.5. */
  cycleSpeed: AnimatableProp<number>
  paletteA: [string, string, string, string]
  paletteB: [string, string, string, string]
}
```

Above the component, add the `useColorUniform` helper (copied from Aurora, but pulled directly here to keep `registry/` files self-contained per the copy-paste delivery model):

```tsx
import { parseHex } from '../utils/color'

function useColorUniform(hex: string) {
  const vec = useMemo(() => {
    const [r, g, b] = parseHex(hex)
    return new Vector3(r, g, b)
  }, [hex])
  const node = useMemo(() => uniform(vec) as unknown as ShaderNodeObject<Node>, [vec])
  useEffect(() => {
    const [r, g, b] = parseHex(hex)
    vec.set(r, g, b)
  }, [hex, vec])
  return node
}
```

(Note: registry components import from `'../utils/color'` per the existing aurora pattern — relative path inside the registry workspace is fine because users copy the whole folder.)

In the component body, just after the existing `useAnimatableUniform` calls, add the cycle uniform and the eight color uniforms:

```tsx
const cycleSpeedU = useAnimatableUniform<number>(props.cycleSpeed)

const a0 = useColorUniform(props.paletteA[0])
const a1 = useColorUniform(props.paletteA[1])
const a2 = useColorUniform(props.paletteA[2])
const a3 = useColorUniform(props.paletteA[3])
const b0 = useColorUniform(props.paletteB[0])
const b1 = useColorUniform(props.paletteB[1])
const b2 = useColorUniform(props.paletteB[2])
const b3 = useColorUniform(props.paletteB[3])
```

Inside the `useEffect`, just above the "Two-layer smoothstep blend" block, replace the deleted `PALETTE` constant references with computed mixed colors:

```tsx
    // ---- Time-cycling palette ----------------------------------------
    // c = sin(time * cycleSpeed)               -> [-1, 1] smooth oscillator
    // t = (sign(c) * |c|^0.6 + 1) / 2          -> [0, 1] eased S-curve that
    //                                             lingers at the extremes
    const cycleTime = (time as ShaderNodeObject<Node>).mul(cycleSpeedU as unknown as number)
    const c = sin(cycleTime) as ShaderNodeObject<Node>
    const eased = sign(c).mul(pow(abs(c), 0.6)).add(1).mul(0.5) as ShaderNodeObject<Node>

    const color0 = mix(a0, b0, eased) as ShaderNodeObject<Node>
    const color1 = mix(a1, b1, eased) as ShaderNodeObject<Node>
    const color2 = mix(a2, b2, eased) as ShaderNodeObject<Node>
    const color3 = mix(a3, b3, eased) as ShaderNodeObject<Node>
```

In the "Two-layer smoothstep blend" block, replace the four `PALETTE.xxx` references with the new mixed colors. The source assigns them as:
- `layer1 = mix(color3, color2, smoothstep(...))` -> `layer1 = mix(color2, color1, hMix)`  *(the source uses 1-indexed; map color3→color2, color2→color1, etc. to keep the same visual mapping)*

To avoid confusion, write the layer block in terms of `color0..color3` matching the original visually:

```tsx
    // layer1 mixes "color3" and "color2" in the source; layer2 mixes
    // "color4" and "color1". In 0-indexed terms: layer1 = mix(color2, color1),
    // layer2 = mix(color3, color0).
    const layer1 = color2.mul(hMix.oneMinus()).add(color1.mul(hMix)) as ShaderNodeObject<Node>
    const layer2 = color3.mul(hMix.oneMinus()).add(color0.mul(hMix)) as ShaderNodeObject<Node>
    // (Replaces the prior PALETTE.pink/deepBlue/blue/amberYellow lines.)
```

Update the `useEffect` deps to include the new uniforms:

```tsx
}, [ctx, resNode, speedU, frequencyU, amplitudeU, cycleSpeedU, a0, a1, a2, a3, b0, b1, b2, b3])
```

- [ ] **Step 2: Update the wrapper with palette defaults**

Overwrite `registry/mesh-gradient/mesh-gradient.tsx`:

```tsx
'use client'

import { MeshGradientShader } from './shader'
import type { AnimatableProp } from '@lovo/matter-react'

export interface MeshGradientProps {
  speed?: AnimatableProp<number>
  frequency?: AnimatableProp<number>
  amplitude?: AnimatableProp<number>
  cycleSpeed?: AnimatableProp<number>
  paletteA?: [string, string, string, string]
  paletteB?: [string, string, string, string]
}

// "Light" palette from the ShaderToy reference.
const DEFAULT_PALETTE_A: [string, string, string, string] = [
  '#ffba89', // amberYellow (clamped — original had R=299, JS truncates correctly via parseInt)
  '#3162ee', // deepBlue
  '#f69292', // pink
  '#59b5f3', // blue
]

// "Dark" palette from the ShaderToy reference.
const DEFAULT_PALETTE_B: [string, string, string, string] = [
  '#6931f5', // purpleHaze
  '#202a32', // swampyBlack
  '#e93334', // persimmonOrange
  '#e9a04b', // darkAmber
]

export function MeshGradient({
  speed = 2,
  frequency = 5,
  amplitude = 30,
  cycleSpeed = 0.5,
  paletteA = DEFAULT_PALETTE_A,
  paletteB = DEFAULT_PALETTE_B,
}: MeshGradientProps = {}) {
  return (
    <MeshGradientShader
      speed={speed}
      frequency={frequency}
      amplitude={amplitude}
      cycleSpeed={cycleSpeed}
      paletteA={paletteA}
      paletteB={paletteB}
    />
  )
}
```

Note: the source had `vec3(299, 186, 137) / vec3(255)` for amberYellow — `299/255 = 1.172` clamps to white on the R channel. `#ffba89` is the visually-correct sRGB approximation (255/186/137).

- [ ] **Step 3: Add palette Tweakpane controls in the docs page**

Edit `apps/docs/src/app/components/mesh-gradient/page.tsx`. Replace the `Params` interface and `INITIAL` const with:

```tsx
interface Params {
  speed: number
  frequency: number
  amplitude: number
  cycleSpeed: number
  a0: string
  a1: string
  a2: string
  a3: string
  b0: string
  b1: string
  b2: string
  b3: string
}

const INITIAL: Params = {
  speed: 2,
  frequency: 5,
  amplitude: 30,
  cycleSpeed: 0.5,
  a0: '#ffba89',
  a1: '#3162ee',
  a2: '#f69292',
  a3: '#59b5f3',
  b0: '#6931f5',
  b1: '#202a32',
  b2: '#e93334',
  b3: '#e9a04b',
}
```

Inside the Tweakpane `useEffect`, after the existing three sliders, add a separator and the new controls (folders mirror Aurora's "Global" / "Layer" structure):

```tsx
pane.addBinding(local, 'cycleSpeed', { label: 'palette cycle', min: 0, max: 2, step: 0.01 })
pane.addBlade({ view: 'separator' })

const aFolder = pane.addFolder({ title: 'Palette A (light)', expanded: false })
aFolder.addBinding(local, 'a0', { label: 'color 0' })
aFolder.addBinding(local, 'a1', { label: 'color 1' })
aFolder.addBinding(local, 'a2', { label: 'color 2' })
aFolder.addBinding(local, 'a3', { label: 'color 3' })

const bFolder = pane.addFolder({ title: 'Palette B (dark)', expanded: false })
bFolder.addBinding(local, 'b0', { label: 'color 0' })
bFolder.addBinding(local, 'b1', { label: 'color 1' })
bFolder.addBinding(local, 'b2', { label: 'color 2' })
bFolder.addBinding(local, 'b3', { label: 'color 3' })
```

Update the `<MeshGradient />` invocation in the JSX to pass the new props:

```tsx
<MeshGradient
  speed={params.speed}
  frequency={params.frequency}
  amplitude={params.amplitude}
  cycleSpeed={params.cycleSpeed}
  paletteA={[params.a0, params.a1, params.a2, params.a3]}
  paletteB={[params.b0, params.b1, params.b2, params.b3]}
/>
```

- [ ] **Step 4: Run dev server and verify palette cycling**

Run:

```bash
pnpm --filter @matter/docs dev
```

Open `/components/mesh-gradient`. Expected: the gradient now breathes between a bright palette (warm orange + cool blues + pink) and a dark palette (purple + near-black + red + amber) over roughly 6 seconds at default `cycleSpeed`. With `cycleSpeed=0` it freezes mid-cycle. Drag a Palette A color picker — only the bright phase changes. Stop dev server.

- [ ] **Step 5: Typecheck**

```bash
pnpm typecheck
```

Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add registry/mesh-gradient/ apps/docs/src/app/components/mesh-gradient/page.tsx
git commit -m "feat(mesh-gradient): time-cycling paletteA/paletteB with eased S-curve (MAT-8 phase 5)"
```

---

## Task 6: Film grain — inline first, then extract to `@lovo/matter` primitive

Goal: subtractive hash-based film grain on top of the final color, controlled by a `grain` prop. Implementation is two-step: build it inline first to confirm it works in context, then extract to `packages/matter/src/primitives/filmGrain.ts` so other shaders can adopt it later.

**Concepts taught:**
- **Hash noise vs simplex noise**: simplex noise (what `mx_noise_float` gives us) is smooth and band-limited — it makes blobs, not dots. Film grain wants the opposite: independent random values per pixel. The classic `fract(sin(dot(uv, …) * …))` hash is high-frequency and uniform, which reads visually as grain.
- **Why hash works**: `dot(uv, [a, b])` projects to a scalar; `sin(...)` wraps that scalar to `[-1, 1]`; multiply by a large constant and `fract(...)` keeps only the chaotic decimal part. Result is uncorrelated noise that looks like static.
- **YAGNI principle in action**: we don't extract until the inline version proves stable. If Phase 6's inline result needs tweaking, we tweak inline; only the *final* form becomes the primitive.

**Files:**
- Modify: `registry/mesh-gradient/shader.tsx`
- Modify: `registry/mesh-gradient/mesh-gradient.tsx`
- Modify: `apps/docs/src/app/components/mesh-gradient/page.tsx`
- Create: `packages/matter/src/primitives/filmGrain.ts`
- Create: `packages/matter/src/primitives/filmGrain.test.ts`
- Modify: `packages/matter/src/index.ts`
- Create: `.changeset/<random-name>.md`

### Step group A — inline grain

- [ ] **Step 1: Add grain prop + inline implementation**

Edit `registry/mesh-gradient/shader.tsx`. Add to `three/tsl` imports: `fract`, `length`. Add to the props type:

```tsx
/** Film grain intensity (0..1). Default 0.1. */
grain: AnimatableProp<number>
```

Add the new uniform:

```tsx
const grainU = useAnimatableUniform<number>(props.grain)
```

In the `useEffect`, replace the line `material.colorNode = vec4(color, 1)` with the grain block:

```tsx
    // ---- Film grain ----------------------------------------------------
    // Hash-based per-pixel grain — uncorrelated, high-frequency. Subtractive
    // application matches the ShaderToy reference (slightly darkens the
    // image as grain rises, rather than the more common additive recipe).
    const HASH_C1 = vec2(2127.1, 81.17)
    const HASH_C2 = vec2(1269.5, 283.37)
    const grainBase = vec2(
      uv().dot(HASH_C1),
      uv().dot(HASH_C2),
    ) as ShaderNodeObject<Node>
    const grainHash = fract(sin(grainBase).mul(43758.5453)) as ShaderNodeObject<Node>
    // length(hash.xy) is what the source uses — a scalar in roughly [0, √2].
    // Multiplied by grain (0..1) to control intensity.
    const grainScalar = length(grainHash).mul(grainU as unknown as number) as ShaderNodeObject<Node>
    const colorWithGrain = color.sub(grainScalar) as ShaderNodeObject<Node>

    material.colorNode = vec4(colorWithGrain, 1)
```

Update the `useEffect` deps to include `grainU`:

```tsx
}, [ctx, resNode, speedU, frequencyU, amplitudeU, cycleSpeedU, grainU, a0, a1, a2, a3, b0, b1, b2, b3])
```

- [ ] **Step 2: Update the wrapper with grain default**

In `registry/mesh-gradient/mesh-gradient.tsx`, add `grain?: AnimatableProp<number>` to the props interface, default it to `0.1`, and pass it through to `<MeshGradientShader>`.

- [ ] **Step 3: Add grain slider in docs page**

In `apps/docs/src/app/components/mesh-gradient/page.tsx`, add `grain: number` to `Params`, `grain: 0.1` to `INITIAL`, a slider in the Tweakpane setup (`pane.addBinding(local, 'grain', { min: 0, max: 1, step: 0.01 })` directly after the `cycleSpeed` slider), and pass `grain={params.grain}` to `<MeshGradient>`.

- [ ] **Step 4: Run dev server and verify grain**

Run:

```bash
pnpm --filter @matter/docs dev
```

Open `/components/mesh-gradient`. Expected: visible film grain at the default 0.1. Drag to 0 — grain disappears, gradient is smooth. Drag to 1 — heavy static. Stop dev server.

- [ ] **Step 5: Commit the inline grain**

```bash
git add registry/mesh-gradient/ apps/docs/src/app/components/mesh-gradient/page.tsx
git commit -m "feat(mesh-gradient): subtractive film grain via hash noise (MAT-8 phase 6a)"
```

### Step group B — extract to `@lovo/matter` primitive

- [ ] **Step 6: Write the primitive test (TDD per CLAUDE.md for Tier 2 primitives)**

Create `packages/matter/src/primitives/filmGrain.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { uv } from 'three/tsl'
import { filmGrain } from './filmGrain.js'

describe('filmGrain', () => {
  it('returns a TSL node without throwing', () => {
    expect(() => filmGrain(uv(), 0.1)).not.toThrow()
  })

  it('accepts a node intensity', () => {
    // The intensity argument also accepts a node (e.g., a uniform) so that
    // callers can animate it without rebuilding the material.
    expect(() => filmGrain(uv(), uv().x)).not.toThrow()
  })
})
```

- [ ] **Step 7: Verify the test fails (red)**

Run:

```bash
pnpm --filter @lovo/matter test -- filmGrain
```

Expected: FAIL with `Cannot find module './filmGrain.js'` (or similar — the file doesn't exist yet).

- [ ] **Step 8: Implement the primitive**

Create `packages/matter/src/primitives/filmGrain.ts`:

```ts
import { vec2, sin, fract, length } from 'three/tsl'
import type { ShaderNodeObject } from 'three/tsl'
import type { Node } from 'three/webgpu'
import type { TSLNode } from './colorRamp.js'

/**
 * Hash-based film grain — uncorrelated, high-frequency noise sampled per
 * pixel of `uv`. Returns a non-negative scalar TSL node, suitable for
 * subtracting from (or adding to) a final color.
 *
 * Recipe:
 *
 *   grain(uv, k) = length(fract(sin(vec2(uv·c1, uv·c2)) * 43758.5453)) * k
 *
 * where `c1 = (2127.1, 81.17)` and `c2 = (1269.5, 283.37)` are arbitrary
 * primes that produce visually-pleasing chaos. The output range is roughly
 * `[0, √2 * k]` (we don't normalize — film grain looks better with a
 * little asymmetric weight toward white).
 *
 * @param uvNode — Vec2 TSL node (typically `uv()` or a scaled `uv`).
 * @param intensity — number OR TSL node in `[0, 1]`. Multiplies the grain.
 */
export function filmGrain(uvNode: TSLNode, intensity: TSLNode | number): ShaderNodeObject<Node> {
  const HASH_C1 = vec2(2127.1, 81.17)
  const HASH_C2 = vec2(1269.5, 283.37)
  const base = vec2((uvNode as ShaderNodeObject<Node>).dot(HASH_C1), (uvNode as ShaderNodeObject<Node>).dot(HASH_C2))
  const hash = fract(sin(base).mul(43758.5453))
  return length(hash).mul(intensity as never) as ShaderNodeObject<Node>
}
```

- [ ] **Step 9: Verify the test passes (green)**

Run:

```bash
pnpm --filter @lovo/matter test -- filmGrain
```

Expected: 2 tests pass.

- [ ] **Step 10: Export from the engine package**

Edit `packages/matter/src/index.ts`. Add after the `export { cursorRipple, … }` line:

```ts
export { filmGrain } from './primitives/filmGrain.js'
```

- [ ] **Step 11: Replace the inline implementation with the primitive**

In `registry/mesh-gradient/shader.tsx`, update the import from `@lovo/matter`:

```tsx
import { time, noise, filmGrain } from '@lovo/matter'
```

Replace the inline grain block (the `HASH_C1`/`HASH_C2`/`grainBase`/`grainHash`/`grainScalar`/`colorWithGrain` lines) with:

```tsx
    // ---- Film grain ----------------------------------------------------
    const grainScalar = filmGrain(uv(), grainU as never) as ShaderNodeObject<Node>
    const colorWithGrain = color.sub(grainScalar) as ShaderNodeObject<Node>

    material.colorNode = vec4(colorWithGrain, 1)
```

Remove `fract` and `length` from the `three/tsl` import list (they're no longer used in the shader file).

- [ ] **Step 12: Add a changeset for the @lovo/matter minor bump**

Run:

```bash
pnpm changeset
```

When prompted:
1. Press space to select **`@lovo/matter`** only (the registry/CLI/docs are ignored or unaffected).
2. Press `n` for major, `y` for minor (new public export is a minor under semver).
3. Summary: `Add filmGrain primitive — subtractive hash-based film grain for shader compositions.`

- [ ] **Step 13: Build, typecheck, lint, and run grain test**

Run:

```bash
pnpm build && pnpm typecheck && pnpm lint && pnpm --filter @lovo/matter test -- filmGrain
```

Expected: all pass.

- [ ] **Step 14: Verify the docs page still renders identical grain**

Run `pnpm --filter @matter/docs dev` and open `/components/mesh-gradient`. Drag `grain` 0 → 1 — visually indistinguishable from before the extraction. Stop dev server.

- [ ] **Step 15: Commit the extraction**

```bash
git add packages/matter/ registry/mesh-gradient/shader.tsx .changeset/
git commit -m "feat(matter): extract filmGrain primitive (MAT-8 phase 6b)"
```

---

## Task 7: Final prop API, spec update, baselines, PR

Goal: ship. Polish the playground page to Aurora parity (Copy JSX / Copy params / Reset all), update the spec, regenerate Playwright baselines, and open the PR.

**Files:**
- Modify: `apps/docs/src/app/components/mesh-gradient/page.tsx`
- Modify: `docs/superpowers/specs/2026-05-02-matter-design.md` (subsection at line 414)
- Modify: `registry/registry.json` (final `uses_primitives` list)
- Delete: `apps/docs-tests/visual/mesh-gradient.spec.ts-snapshots/mesh-gradient-default-chromium-darwin.png`
- Delete: `apps/docs-tests/visual/mesh-gradient.spec.ts-snapshots/mesh-gradient-default-chromium-linux.png`
- Regenerate via `test:visual:update`: the same two snapshot files.

- [ ] **Step 1: Add Reset / Copy JSX / Copy params to the playground page**

Edit `apps/docs/src/app/components/mesh-gradient/page.tsx`. Mirror the structure used in `apps/docs/src/app/components/aurora/page.tsx`:

1. Add `fmtNum`, `fmtJsx`, `fmtParams` helpers above the page component (adapt Aurora's helpers — drop the `fmtLayer` helper, replace with palette-array formatting; the values are flat strings + numbers).
2. Above the existing slider bindings, add three buttons in this order: `Reset all`, `Copy JSX`, `Copy params`, with the `flashCopied` pattern from Aurora.
3. The `Reset all` button restores `local` to `INITIAL` and calls `pane.refresh()` + `setParams({...local})`.

Full replacement code:

```tsx
// apps/docs/app/components/mesh-gradient/page.tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { Pane } from 'tweakpane'
import dynamic from 'next/dynamic'
import { VisualTestPause } from '@/lib/visualTestHooks'

const MatterScene = dynamic(() => import('@lovo/matter-react').then((m) => m.MatterScene), {
  ssr: false,
})
const MeshGradient = dynamic(
  () => import('@matter/registry/mesh-gradient').then((m) => m.MeshGradient),
  { ssr: false },
)

interface Params {
  speed: number
  frequency: number
  amplitude: number
  cycleSpeed: number
  grain: number
  a0: string
  a1: string
  a2: string
  a3: string
  b0: string
  b1: string
  b2: string
  b3: string
}

const INITIAL: Params = {
  speed: 2,
  frequency: 5,
  amplitude: 30,
  cycleSpeed: 0.5,
  grain: 0.1,
  a0: '#ffba89',
  a1: '#3162ee',
  a2: '#f69292',
  a3: '#59b5f3',
  b0: '#6931f5',
  b1: '#202a32',
  b2: '#e93334',
  b3: '#e9a04b',
}

const fmtNum = (n: number) => String(Math.round(n * 10000) / 10000)

const fmtJsx = (p: Params) =>
  `<MatterScene>
  <MeshGradient
    speed={${fmtNum(p.speed)}}
    frequency={${fmtNum(p.frequency)}}
    amplitude={${fmtNum(p.amplitude)}}
    cycleSpeed={${fmtNum(p.cycleSpeed)}}
    grain={${fmtNum(p.grain)}}
    paletteA={['${p.a0}', '${p.a1}', '${p.a2}', '${p.a3}']}
    paletteB={['${p.b0}', '${p.b1}', '${p.b2}', '${p.b3}']}
  />
</MatterScene>`

const fmtParams = (p: Params) =>
  `{
  speed: ${fmtNum(p.speed)},
  frequency: ${fmtNum(p.frequency)},
  amplitude: ${fmtNum(p.amplitude)},
  cycleSpeed: ${fmtNum(p.cycleSpeed)},
  grain: ${fmtNum(p.grain)},
  paletteA: ['${p.a0}', '${p.a1}', '${p.a2}', '${p.a3}'],
  paletteB: ['${p.b0}', '${p.b1}', '${p.b2}', '${p.b3}'],
}`

export default function MeshGradientPage() {
  const paneContainerRef = useRef<HTMLDivElement>(null)
  const [params, setParams] = useState<Params>(INITIAL)

  useEffect(() => {
    const container = paneContainerRef.current
    if (!container) return
    const local: Params = { ...INITIAL }
    const pane = new Pane({ container, title: '<MeshGradient>' })

    const syncToReact = () => setParams({ ...local })

    pane.addButton({ title: 'Reset all' }).on('click', () => {
      Object.assign(local, INITIAL)
      pane.refresh()
      syncToReact()
    })

    const flashCopied = (btn: { title: string }, original: string) => {
      btn.title = 'Copied!'
      pane.refresh()
      setTimeout(() => {
        btn.title = original
        pane.refresh()
      }, 1200)
    }
    const jsxBtn = pane.addButton({ title: 'Copy JSX' })
    jsxBtn.on('click', () => {
      void navigator.clipboard.writeText(fmtJsx(local)).then(() => flashCopied(jsxBtn, 'Copy JSX'))
    })
    const paramsBtn = pane.addButton({ title: 'Copy params' })
    paramsBtn.on('click', () => {
      void navigator.clipboard
        .writeText(fmtParams(local))
        .then(() => flashCopied(paramsBtn, 'Copy params'))
    })

    pane.addBlade({ view: 'separator' })

    const globals = pane.addFolder({ title: 'Global' })
    globals.addBinding(local, 'speed', { min: 0, max: 5, step: 0.01 })
    globals.addBinding(local, 'frequency', { min: 0.5, max: 20, step: 0.1 })
    globals.addBinding(local, 'amplitude', { min: 5, max: 100, step: 0.5 })
    globals.addBinding(local, 'cycleSpeed', { label: 'palette cycle', min: 0, max: 2, step: 0.01 })
    globals.addBinding(local, 'grain', { min: 0, max: 1, step: 0.01 })

    const aFolder = pane.addFolder({ title: 'Palette A (light)', expanded: false })
    aFolder.addBinding(local, 'a0', { label: 'color 0' })
    aFolder.addBinding(local, 'a1', { label: 'color 1' })
    aFolder.addBinding(local, 'a2', { label: 'color 2' })
    aFolder.addBinding(local, 'a3', { label: 'color 3' })

    const bFolder = pane.addFolder({ title: 'Palette B (dark)', expanded: false })
    bFolder.addBinding(local, 'b0', { label: 'color 0' })
    bFolder.addBinding(local, 'b1', { label: 'color 1' })
    bFolder.addBinding(local, 'b2', { label: 'color 2' })
    bFolder.addBinding(local, 'b3', { label: 'color 3' })

    pane.on('change', () => syncToReact())

    return () => pane.dispose()
  }, [])

  return (
    <main style={{ minHeight: '100vh', position: 'relative' }}>
      <div style={{ position: 'relative', height: '70vh' }}>
        <MatterScene>
          <MeshGradient
            speed={params.speed}
            frequency={params.frequency}
            amplitude={params.amplitude}
            cycleSpeed={params.cycleSpeed}
            grain={params.grain}
            paletteA={[params.a0, params.a1, params.a2, params.a3]}
            paletteB={[params.b0, params.b1, params.b2, params.b3]}
          />
          <VisualTestPause />
        </MatterScene>
        <div
          ref={paneContainerRef}
          data-tweakpane-host
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            zIndex: 10,
            width: '320px',
            maxHeight: 'calc(100% - 2rem)',
            overflowY: 'auto',
          }}
        />
      </div>
      <section style={{ padding: '2rem', maxWidth: '60ch', margin: '0 auto' }}>
        <h1 style={{ marginTop: 0 }}>&lt;MeshGradient /&gt;</h1>
        <pre
          style={{
            background: '#1a1a2a',
            color: '#e0e0f0',
            padding: '1rem',
            borderRadius: '0.5rem',
            fontSize: '0.85rem',
            whiteSpace: 'pre-wrap',
          }}
        >
          {`<MatterScene>
  <MeshGradient
    paletteA={['#ffba89','#3162ee','#f69292','#59b5f3']}
    paletteB={['#6931f5','#202a32','#e93334','#e9a04b']}
  />
</MatterScene>`}
        </pre>
      </section>
    </main>
  )
}
```

- [ ] **Step 2: Update the spec's MeshGradient subsection**

Edit `docs/superpowers/specs/2026-05-02-matter-design.md`. Locate the `#### <MeshGradient> — Stripe-style multi-point blending` heading near line 414 and replace the whole subsection (heading + code block + bullet list) with:

```markdown
#### `<MeshGradient>` — Linear/Stripe-style warped fluid gradient

```tsx
<MeshGradient
  paletteA={['#ffba89', '#3162ee', '#f69292', '#59b5f3']}
  paletteB={['#6931f5', '#202a32', '#e93334', '#e9a04b']}
  speed={2}        // warp drift rate
  frequency={5}    // sine warp frequency
  amplitude={30}   // sine warp amplitude divisor (higher = subtler)
  cycleSpeed={0.5} // palette A ↔ B crossfade rate
  grain={0.1}      // subtractive film grain (0..1)
/>
```

- **Primitives**: `noise`, `time`, `filmGrain`, `uv`, `vec2`, `vec3`, `mix`, `smoothstep`, `sin`, `cos`, `dot`, `pow`, `uniform`
- **TSL approach**: center UVs at `0.5`, rotate per-pixel by an angle driven by `noise(time*0.05, x*y)`, apply a sine-of-axis domain warp, then build two horizontal-gradient layers via `smoothstep` and `mix`, blend them vertically by `smoothstep(0.5, -0.3, y)`, crossfade two 4-color palettes over time via an eased S-curve `(sign(c)*|c|^0.6 + 1)/2`, and finally subtract `filmGrain(uv, intensity)` for the static.
- **Cursor behavior**: none in v1. Add a `cursorDistort` prop in v2 if desired.
- **Teaches**: domain warping, smoothstep-based gradient construction, layer composition, time-cycled palettes, subtractive grain. Inspired by https://www.shadertoy.com/view/wdyczG.

Replaces the earlier inverse-distance N-point implementation, which lived from M3 through 0.2.0. The new look matches the colloquial meaning of "mesh gradient" used on Linear/Stripe/Apple marketing pages.
```

- [ ] **Step 3: Finalize registry.json**

Edit `registry/registry.json`. Update the `mesh-gradient` block's `uses_primitives` to the final list (adds `filmGrain`):

```json
"uses_primitives": [
  "noise",
  "time",
  "filmGrain",
  "uv",
  "vec2",
  "vec3",
  "vec4",
  "mix",
  "smoothstep",
  "sin",
  "cos",
  "dot",
  "pow",
  "uniform"
],
```

- [ ] **Step 4: Build, typecheck, lint, format**

Run:

```bash
pnpm build && pnpm typecheck && pnpm lint && pnpm format
```

Expected: all pass. If `pnpm format` rewrites files, stage those changes too.

- [ ] **Step 5: Regenerate Playwright visual baselines**

The test at `apps/docs-tests/visual/mesh-gradient.spec.ts` is unchanged but the visual is now completely different, so the existing snapshots must be regenerated.

Delete the old baselines:

```bash
rm apps/docs-tests/visual/mesh-gradient.spec.ts-snapshots/mesh-gradient-default-chromium-darwin.png
rm apps/docs-tests/visual/mesh-gradient.spec.ts-snapshots/mesh-gradient-default-chromium-linux.png
```

Regenerate (this command runs the docs server itself per the existing config, then takes screenshots):

```bash
pnpm --filter @matter/docs-tests test:visual:update -- mesh-gradient
```

Expected: 1 spec, 1 test, snapshot file(s) written. (Local run produces only the `darwin` baseline on macOS; the `linux` baseline regenerates in CI via the GH Actions workflow when this PR runs.)

Visually inspect the new `mesh-gradient-default-chromium-darwin.png` to confirm it looks like the polished version of the shader, not a frame of grain or a paused mid-warp state. The `VisualTestPause` component (set via `?visualTest=1`) freezes `time`, so the screenshot is deterministic.

- [ ] **Step 6: Final sanity sweep**

Run the full validation pipeline:

```bash
pnpm build && pnpm typecheck && pnpm lint && pnpm --filter @lovo/matter test && pnpm --filter @matter/docs-tests test:visual
```

Expected: all green.

- [ ] **Step 7: Commit Phase 7**

```bash
git add apps/docs/src/app/components/mesh-gradient/page.tsx \
        docs/superpowers/specs/2026-05-02-matter-design.md \
        registry/registry.json \
        apps/docs-tests/visual/mesh-gradient.spec.ts-snapshots/
git commit -m "feat(mesh-gradient): polish playground, update spec, regenerate baselines (MAT-8 phase 7)"
```

- [ ] **Step 8: Push and open PR**

```bash
git push -u origin hunter/mat-8-fix-and-review-meshgradient
gh pr create --title "MAT-8: rebuild MeshGradient as warped fluid gradient" --body "$(cat <<'EOF'
## Summary

Replaces the inverse-distance N-point algorithm with a warped 4-color fluid gradient (noise rotation + sine domain warp + smoothstep blend + time-cycling palette + film grain), translated step-by-step from a ShaderToy reference (https://www.shadertoy.com/view/wdyczG, CC BY-NC-SA 3.0).

The visual now matches the colloquial meaning of "mesh gradient" used on Linear / Stripe / Apple marketing pages.

### Breaking changes (registry component — copy-paste, not npm)

- `points`, `blur`, `interactive`, `strength`, `inputs.cursor` props removed.
- New props: `paletteA`, `paletteB`, `speed`, `frequency`, `amplitude`, `cycleSpeed`, `grain`.
- Anyone wanting the old behavior pulls from the `m6-complete` tag.

### Engine changes

- New `filmGrain(uv, intensity)` primitive exported from `@lovo/matter`. Minor version bump via changeset.

## Test plan

- [ ] `pnpm build && pnpm typecheck && pnpm lint` pass locally
- [ ] `pnpm --filter @lovo/matter test` — filmGrain primitive tests pass
- [ ] `pnpm --filter @matter/docs-tests test:visual` — new baselines match
- [ ] Manual: `/components/mesh-gradient` renders, all Tweakpane sliders affect the visual, Copy JSX / Copy params work
EOF
)"
```

---

## Self-review checklist (run after writing this plan, before execution)

1. **Spec coverage:** Every behavior in the ShaderToy reference is implemented: per-pixel noise rotation (Task 2), sine domain warp (Task 3), two-layer smoothstep blend (Task 4), two-palette time crossfade (Task 5), film grain (Task 6). ✅
2. **No placeholders:** No "TBD", "implement later", "add appropriate error handling" — every step has the actual code. ✅
3. **Type consistency:** `MeshGradientShaderProps` grows monotonically across Tasks 1–6; final shape in Task 6 = `speed, frequency, amplitude, cycleSpeed, grain, paletteA, paletteB`. ✅ `MeshGradientProps` (wrapper) mirrors it with optional defaults. ✅
4. **Reference correctness:** The ShaderToy `vec3(299, 186, 137) / vec3(255)` for amberYellow has R out of range — flagged in Task 5 Step 2 with the clamped hex `#ffba89`. ✅
5. **TDD applied where applicable:** Per CLAUDE.md, the shader visuals are not TDD'd (no GPU mock); only the Tier 2 `filmGrain` primitive in Task 6 gets a Vitest unit test (Steps 6–9). ✅
6. **Frequent commits:** 7 phase commits + 1 extra split (Phase 6a + 6b). ✅

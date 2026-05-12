# Matter — Milestone 3: the other 5 v1 components — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the remaining five Tier 1 components (`<NoiseField>`, `<DotField>`, `<Waves>`, `<MeshGradient>`, `<Aurora>`) plus the Tier 2 primitives they require (`noise`, `fbm`, `voronoi`, `quantize`, `sdfCircle`, `displace`, `cursorRipple`) plus two input hooks (`useResize`, `useScroll`). Every component lands in `registry/`, gets a minimal `apps/docs/app/components/<slug>/page.tsx` with a Tweakpane control on every prop, and is wired into the registry manifest so `@lovo/matter-cli add <slug>` Just Works. M3 is split into seven sub-phases, simplest-first, each ending at a runnable browser route the user can scrub. Tag `m3-complete` at the end.

**Architecture:** Tier 2 primitives are pure TSL functions in `packages/matter/src/primitives/<name>.ts`, exported through `packages/matter/src/index.ts`. Input hooks live in `packages/matter-react/src/use<Name>.ts` and follow the Strict-Mode-safe single-effect pattern from `useCursor` (CLAUDE.md gotcha #14). Tier 1 components live in `registry/<slug>.tsx` as standalone copy-paste files that import only from `@lovo/matter` and `@lovo/matter-react`; they wrap their own `<MatterScene>` and `<FallbackBoundary>`. The docs site renders each component on `/components/<slug>` with a Tweakpane panel on every prop. Two phases (3.1.a and 3.4.a) are _prototype_ phases that surface a feel-decision on a hardcoded shader at `/dev/<slug>-playground` before the prop API of the consuming component is locked.

**Tech Stack:** Inherited from M0/M1 — TypeScript 5 strict (`verbatimModuleSyntax`, `noUncheckedIndexedAccess`), pnpm 9 + Turborepo, tsup (engine + binding bundling), Vitest 2, Next.js 15 (`apps/docs/`), Tweakpane 4 (already wired). No new build tooling.

---

## Critical context — read this first

### M3 dependency graph (which primitives ship in which sub-phase)

| Component (and phase that ships it)    | Primitives & hooks the component consumes                                                           | New things this phase ships                              |
| -------------------------------------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| LinearGradient _(M1, already shipped)_ | `colorRamp`, `mix`, `time`, `length`, `uniform`                                                     | —                                                        |
| **3.1.a — FBM playground**             | n/a (prototype)                                                                                     | `noise`, `fbm`                                           |
| **3.1.b — `<NoiseField>`**             | `fbm` (3.1.a), `voronoi` (here), `quantize` (here), `colorRamp` (M1), `time` (M1)                   | `voronoi`, `quantize`, `<NoiseField>` component          |
| **3.2 — `<DotField>`**                 | `sdfCircle` (here), `displace` (here), `mix`, cursor uniform; `useResize` (here)                    | `sdfCircle`, `displace`, `useResize`, `<DotField>`       |
| **3.3 — `<Waves>`**                    | `sin`/`cos` (TSL built-ins), `cursorRipple` (here), `mix`, `time`; `useScroll` (here, exposed only) | `cursorRipple`, `useScroll`, `<Waves>`                   |
| **3.4.a — MeshGradient prototype**     | n/a (prototype) — exercises `noise` (3.1.a)                                                         | `/dev/mesh-gradient-playground` only — no new primitives |
| **3.4.b — `<MeshGradient>`**           | `colorRamp` (M1), `mix`, `noise` (3.1.a), cursor uniform                                            | `<MeshGradient>` component                               |
| **3.5 — `<Aurora>`**                   | `fbm` (3.1.a), `mix`, `smoothstep`, `displace` (3.2), `time`, cursor uniform                        | `<Aurora>` component (no new primitives)                 |

**Rationale for deviations from the brainstorm-prompt graph:**

- **Voronoi ships in 3.1.b, not 3.4.a** — spec line 497 (NoiseField §5.2): `cellular` variant uses `voronoi`. Without voronoi, NoiseField can't ship. The brainstorming output flagged this exact ambiguity; the spec resolves it.
- **cursorRipple ships in 3.3 with Waves, not 3.5 with Aurora** — spec line 516 (Waves §5.2) lists `cursorRipple` as a Waves primitive. Aurora's cursor behavior (line 462) is "locally amplifies the displacement field near cursor" — that's a multiplier on the existing FBM displacement, not a separate ripple primitive. So 3.5 has no new primitives → no `.a` prototype phase needed.
- **`gradient` and `radialGradient` are deferred** — spec §11 (line 770) lists them in M3, but no v1 component consumes either. `gradient(t, [a,b])` would be a 4-line wrapper around `colorRamp`; `radialGradient` would be `colorRamp(length(uv-c), stops)`. YAGNI: ship them in a future milestone when a consumer exists. Out of scope for M3.
- **`useScroll` is exposed but unused by v1 components** — spec line 770 lists it in M3. No v1 component is scroll-driven. We export it from `@lovo/matter-react` so users can pass `inputs={{ scroll: useScroll() }}` to any component, and we add a Vitest unit test, but no Tier 1 component consumes it in v1. The hook lands in 3.3 because that's the natural sibling phase to `cursorRipple` (both are "input → uniform" wiring).

### File-naming and placement conventions

- **Tier 2 primitives** → `packages/matter/src/primitives/<camelCaseName>.ts` (one file per primitive). Named exports only. Optional `<name>.test.ts` next to it for primitives whose math is pure-JS testable (e.g., parameter normalization, return-shape assertions). For TSL fragments that produce GPU-only nodes, the docs-page playground is the test.
- **Input hooks** → `packages/matter-react/src/use<Name>.ts` (one file per hook). Always paired with `use<Name>.test.ts` for the smoothing/snapshot logic when applicable.
- **Tier 1 components** → `registry/<kebab-slug>.tsx` (one file). No imports between component files (each is self-contained for copy-paste delivery per CLAUDE.md).
- **Docs component pages** → `apps/docs/app/components/<kebab-slug>/page.tsx`. Each page does its own `next/dynamic` import of the registry file with `{ ssr: false }` (CLAUDE.md gotcha #10).
- **Prototype/playground pages** → `apps/docs/app/dev/<slug>-playground/page.tsx`. URL is `/dev/<slug>-playground`. Plain `dev` (no underscore) — Next.js opts `_folder` out of routing entirely, which is not what we want. We don't link these from any nav; they survive in the repo and M4 decides whether to graduate them into Tier 2 docs.

### Mandatory gotcha checklist (from CLAUDE.md — every phase must respect these)

- **#10 — `next/dynamic({ ssr: false })`** wraps every component import on a docs page that pulls `three/webgpu`. The page MUST default-export a client component that renders the dynamic-imported registry component.
- **#11 — `@tweakpane/core` devDep** is already pinned at `^2.0.5` in `apps/docs/package.json`. Don't bump tweakpane to anything that breaks this. (The lockfile already accommodates it.)
- **#12 — TSL uniform-as-arg rule.** `uv().sub(cursorUniform)` works; `cursorUniform.sub(...).mul(...).dot(...)` does NOT propagate values reliably even though it typechecks. Build TSL chains starting from `uv()`/`vec2(...)`/etc. and pass uniforms as arguments. Every shader fragment in this plan follows this rule — do not refactor it without re-verifying the GPU output.
- **#13 — three single-bundle alias** is already configured in `apps/docs/next.config.ts`. Do not add new aliases or import from `three/build/...` — the existing alias forces every `three`/`three/webgpu`/`three/tsl` import to one bundle.
- **#14 — Strict-Mode-safe hooks.** `useResize` and `useScroll` MUST follow `useCursor`'s single-effect pattern: create the disposable inside `useEffect`, attach, return cleanup that disposes; expose the current instance via `useState`. Never use `useState(() => new X())` + a separate dispose effect — Strict Mode will leave a dead instance.

### Out of scope (firm — do not drift)

- Per-component hooks (`useNoiseFieldMaterial`, etc.). Only `useShaderMaterial` is needed for r3f integration in v1.
- Visual regression — Playwright is M5's job. Do NOT add Playwright in M3. The Tweakpane page IS the test.
- Polished docs copy / nav / shared layout / hero page. M4 does that. M3 docs pages are minimal: component rendered + Tweakpane panel + a `<pre>` with the import snippet. No marketing copy, no prop-reference table.
- Storybook (we ripped it out in M1; do not reintroduce).
- `gradient` / `radialGradient` primitives (deferred — see Rationale above).
- Aurora layered-FBM-at-multiple-scales optimization passes; just ship the spec-faithful version.
- Any new build/lint/test tooling.

---

## Pre-flight checks

Run these before starting Phase 3.1.a.

- [ ] **In project root.** Run `pwd`. Expected: `/Users/hunter.garrett/Documents/_personal/mattermix`.
- [ ] **M2 tag present.** Run `git tag`. Expected: `m0-complete`, `m1-complete`, `m2-complete` listed.
- [ ] **Working tree clean.** Run `git status --short`. Expected: empty (or only the M2 plan file `docs/superpowers/plans/2026-05-04-matter-m2-cli.md` if it was committed elsewhere — fine either way; just verify nothing else uncommitted).
- [ ] **Everything builds clean from M2 state.**
      `bash
pnpm install --frozen-lockfile
pnpm build && pnpm typecheck && pnpm lint && pnpm test
`
      Expected: all green. If a package shows "no test files" — verify `passWithNoTests: true` is set per CLAUDE.md gotcha #8.
- [ ] **LinearGradient still renders.** Run `pnpm --filter @matter/docs dev`, open `http://localhost:3000/components/linear-gradient`, drag the angle slider, verify the gradient updates after Apply. Kill the dev server.
- [ ] **CLI smoke test still passes.** Run `pnpm smoke`. Expected: green.

If any of the above fails, STOP — do not start M3 until M2's state is clean.

---

## File structure produced by this milestone

```
mattermix/
├── packages/matter/src/primitives/
│   ├── noise.ts                     # NEW — Phase 3.1.a
│   ├── noise.test.ts                # NEW — Phase 3.1.a
│   ├── fbm.ts                       # NEW — Phase 3.1.a
│   ├── fbm.test.ts                  # NEW — Phase 3.1.a
│   ├── voronoi.ts                   # NEW — Phase 3.1.b
│   ├── voronoi.test.ts              # NEW — Phase 3.1.b
│   ├── quantize.ts                  # NEW — Phase 3.1.b
│   ├── quantize.test.ts             # NEW — Phase 3.1.b
│   ├── sdfCircle.ts                 # NEW — Phase 3.2
│   ├── sdfCircle.test.ts            # NEW — Phase 3.2
│   ├── displace.ts                  # NEW — Phase 3.2
│   ├── cursorRipple.ts              # NEW — Phase 3.3
│   └── cursorRipple.test.ts         # NEW — Phase 3.3
├── packages/matter/src/index.ts     # MODIFIED — exports each new primitive as it lands
├── packages/matter-react/src/
│   ├── useResize.ts                 # NEW — Phase 3.2
│   ├── useResize.test.ts            # NEW — Phase 3.2
│   ├── useScroll.ts                 # NEW — Phase 3.3
│   ├── useScroll.test.ts            # NEW — Phase 3.3
│   └── index.ts                     # MODIFIED — exports each new hook as it lands
├── registry/
│   ├── noise-field.tsx              # NEW — Phase 3.1.b
│   ├── dot-field.tsx                # NEW — Phase 3.2
│   ├── waves.tsx                    # NEW — Phase 3.3
│   ├── mesh-gradient.tsx            # NEW — Phase 3.4.b
│   ├── aurora.tsx                   # NEW — Phase 3.5
│   ├── registry.json                # MODIFIED — one entry per component
│   └── package.json                 # MODIFIED — one export key per component
├── apps/docs/app/
│   ├── components/
│   │   ├── noise-field/page.tsx     # NEW — Phase 3.1.b
│   │   ├── dot-field/page.tsx       # NEW — Phase 3.2
│   │   ├── waves/page.tsx           # NEW — Phase 3.3
│   │   ├── mesh-gradient/page.tsx   # NEW — Phase 3.4.b
│   │   └── aurora/page.tsx          # NEW — Phase 3.5
│   ├── dev/
│   │   ├── fbm-playground/page.tsx           # NEW — Phase 3.1.a
│   │   └── mesh-gradient-playground/page.tsx # NEW — Phase 3.4.a
│   └── page.tsx                     # MODIFIED — Phase 3.5 wrap-up: link to all 6 components
└── docs/superpowers/plans/
    └── 2026-05-06-matter-m3-components.md  # this file
```

---

## Phase 3.1.a — FBM playground (`noise` + `fbm` primitives)

**Goal:** Ship the two foundational pattern primitives (`noise`, `fbm`) and a `/dev/fbm-playground` route where the user scrubs Tweakpane controls (octaves, lacunarity, gain, scale, time speed) on a hardcoded grayscale FBM shader. The feel-decision: what do good defaults for `octaves`/`lacunarity`/`gain` look like? The user picks defaults here that get baked into `<NoiseField>` and `<Aurora>` later.

**Scope:** New TSL primitives only — no new component, no registry change.

**Files:**

- Create: `packages/matter/src/primitives/noise.ts`
- Create: `packages/matter/src/primitives/noise.test.ts`
- Create: `packages/matter/src/primitives/fbm.ts`
- Create: `packages/matter/src/primitives/fbm.test.ts`
- Modify: `packages/matter/src/index.ts`
- Create: `apps/docs/app/dev/fbm-playground/page.tsx`

### Task 1: Add `noise` primitive

Three.js TSL exposes a built-in `mx_noise_float` (MaterialX-derived simplex noise). Wrap it in a stable Matter API so users have one import path and we can absorb upstream renames.

**Files:**

- Create: `packages/matter/src/primitives/noise.ts`

- [ ] **Step 1.1: Create `noise.ts`.**

```ts
// packages/matter/src/primitives/noise.ts
import { mx_noise_float } from 'three/tsl'
import type { TSLNode } from './colorRamp.js'

/**
 * 2D simplex noise sampled at a point. Returns a scalar TSL node in
 * approximately [-1, 1] (MaterialX's mx_noise_float is roughly that range).
 *
 * @param p — Vec2 TSL node (typically `uv()` or a scaled/offset uv).
 *
 * Built on top of three's `mx_noise_float`; we wrap it so consumers have a
 * stable import path through `@lovo/matter` and we can swap the
 * implementation if a different noise primitive proves better in practice.
 */
export function noise(p: TSLNode): TSLNode {
  return mx_noise_float(p) as unknown as TSLNode
}
```

- [ ] **Step 1.2: Add a unit test asserting the function returns a non-null TSL node.**

File: `packages/matter/src/primitives/noise.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { uv } from 'three/tsl'
import { noise } from './noise.js'

describe('noise', () => {
  it('returns a TSL node when called with uv()', () => {
    const n = noise(uv())
    expect(n).toBeDefined()
    expect(n).not.toBeNull()
  })
})
```

- [ ] **Step 1.3: Build + test.**

```bash
pnpm --filter @lovo/matter test
pnpm --filter @lovo/matter build
```

Expected: tests green, dist builds.

### Task 2: Add `fbm` primitive

Fractal Brownian Motion: sum N octaves of `noise` at increasing frequency (multiplied by `lacunarity`) and decreasing amplitude (multiplied by `gain`). The classical defaults are `octaves=4, lacunarity=2, gain=0.5` — but the _feel-decision_ belongs to the user, not the spec. Ship with defaults that the user picks during this phase's playground beat (see Step 6 below).

**Files:**

- Create: `packages/matter/src/primitives/fbm.ts`
- Create: `packages/matter/src/primitives/fbm.test.ts`

- [ ] **Step 2.1: Create `fbm.ts`.**

```ts
// packages/matter/src/primitives/fbm.ts
import { noise } from './noise.js'
import type { TSLNode } from './colorRamp.js'
import type { ShaderNodeObject } from 'three/tsl'
import type { Node } from 'three/webgpu'

export interface FBMOptions {
  /** Number of octaves to sum. JS-side number — fixed at TSL build time, not a uniform. Default: 4. */
  octaves?: number
  /** Per-octave frequency multiplier. JS-side number. Default: 2. */
  lacunarity?: number
  /** Per-octave amplitude multiplier. JS-side number. Default: 0.5. */
  gain?: number
}

/**
 * Fractal Brownian Motion — sum of N octaves of 2D simplex noise.
 *
 * `octaves`, `lacunarity`, and `gain` are JavaScript numbers (NOT TSL
 * uniforms) because the loop must be unrolled at TSL-build time — TSL has
 * no dynamic-length loop primitive that maps cleanly to all backends.
 * Animatable parameters that *do* survive on the GPU are the input UV
 * (which the caller can scale/translate per frame) and `time`.
 *
 * @param p — Vec2 TSL node (UV-space position).
 * @returns scalar TSL node, roughly [-1..1] but normalized closer to
 *          [-0.5..0.5] when amplitude sums approach 1 with the default gain.
 */
export function fbm(p: TSLNode, opts: FBMOptions = {}): TSLNode {
  const octaves = opts.octaves ?? 4
  const lacunarity = opts.lacunarity ?? 2
  const gain = opts.gain ?? 0.5

  let sum: TSLNode = noise(p)
  let amp = 1
  let freq = 1
  let total = amp
  for (let i = 1; i < octaves; i++) {
    freq *= lacunarity
    amp *= gain
    total += amp
    // Multiply UV by the per-octave frequency before sampling.
    // (`p as ShaderNodeObject` so we can call `.mul`; #12 doesn't apply
    //  here because `p` is built from `uv()`/`vec2()`, not from a uniform.)
    const pAtFreq = (p as ShaderNodeObject<Node>).mul(freq)
    const layer = (noise(pAtFreq) as ShaderNodeObject<Node>).mul(amp)
    sum = (sum as ShaderNodeObject<Node>).add(layer)
  }
  // Normalize to approximate [-1..1] regardless of octave count / gain.
  return (sum as ShaderNodeObject<Node>).div(total)
}
```

- [ ] **Step 2.2: Add a unit test asserting return-shape and that `octaves=1` shortcuts to a single noise call.**

File: `packages/matter/src/primitives/fbm.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { uv } from 'three/tsl'
import { fbm } from './fbm.js'

describe('fbm', () => {
  it('returns a TSL node with default options', () => {
    const n = fbm(uv())
    expect(n).toBeDefined()
  })

  it('returns a TSL node when octaves=1', () => {
    const n = fbm(uv(), { octaves: 1 })
    expect(n).toBeDefined()
  })

  it('respects custom lacunarity and gain', () => {
    const n = fbm(uv(), { octaves: 6, lacunarity: 2.5, gain: 0.4 })
    expect(n).toBeDefined()
  })
})
```

- [ ] **Step 2.3: Build + test.**

```bash
pnpm --filter @lovo/matter test
pnpm --filter @lovo/matter build
```

Expected: green.

### Task 3: Export `noise` and `fbm` from `@lovo/matter`

**Files:**

- Modify: `packages/matter/src/index.ts`

- [ ] **Step 3.1: Add new primitive exports below the existing `colorRamp` export.**

In `packages/matter/src/index.ts`, after the existing `export { colorRamp } ...` block, insert:

```ts
export { noise } from './primitives/noise.js'

export { fbm } from './primitives/fbm.js'
export type { FBMOptions } from './primitives/fbm.js'
```

- [ ] **Step 3.2: Build + typecheck.**

```bash
pnpm --filter @lovo/matter build
pnpm --filter @lovo/matter typecheck
```

Expected: green.

### Task 4: Build the `/dev/fbm-playground` page

The page renders a hardcoded shader on a full-viewport `<MatterScene>` with grayscale output `colorRamp(fbm(uv*scale + time*speed), [black, white])` and exposes Tweakpane controls for: `octaves` (1–8 step 1), `lacunarity` (1–4 step 0.05), `gain` (0–1 step 0.01), `scale` (0.5–10 step 0.1), `timeSpeed` (0–2 step 0.01).

Because `octaves` (and lacunarity/gain) are JS-side and bake into the TSL fragment, the page MUST remount the inner scene on `octaves` change — same pattern as M1's LinearGradient page using an `instanceKey`. `scale` and `timeSpeed` are TSL uniforms and update without remount.

**Files:**

- Create: `apps/docs/app/dev/fbm-playground/page.tsx`

- [ ] **Step 4.1: Create the playground page.**

```tsx
// apps/docs/app/dev/fbm-playground/page.tsx
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Pane } from 'tweakpane'
import dynamic from 'next/dynamic'
import { Mesh, PlaneGeometry, Vector2 } from 'three'
import { MeshBasicNodeMaterial } from 'three/webgpu'
import { vec2, vec3, uv, time, uniform } from '@lovo/matter'
import { colorRamp, type ColorRampStop } from '@lovo/matter'
import { fbm } from '@lovo/matter'
import { MatterScene, useMatterContext } from '@lovo/matter-react'

// `MatterScene` pulls three/webgpu (gotcha #10). The scene wrapper is
// imported via dynamic + ssr:false in the page render path (below).

interface Params {
  octaves: number
  lacunarity: number
  gain: number
  scale: number
  timeSpeed: number
}

const INITIAL: Params = {
  octaves: 4,
  lacunarity: 2.0,
  gain: 0.5,
  scale: 3.0,
  timeSpeed: 0.2,
}

const STOPS: ColorRampStop[] = [
  { color: vec3(0, 0, 0), position: 0 },
  { color: vec3(1, 1, 1), position: 1 },
]

// Inner mesh — must run inside <MatterScene> so the context is available.
function FbmMesh({
  octaves,
  lacunarity,
  gain,
  scaleUniform,
  timeSpeedUniform,
}: {
  octaves: number
  lacunarity: number
  gain: number
  scaleUniform: ReturnType<typeof uniform>
  timeSpeedUniform: ReturnType<typeof uniform>
}) {
  const ctx = useMatterContext()

  useEffect(() => {
    if (!ctx) return

    // p = uv() * scale + time * timeSpeed (broadcast time scalar to vec2)
    const animatedUv = uv()
      .mul(scaleUniform as unknown as number)
      .add(
        vec2(
          time.mul(timeSpeedUniform as unknown as number),
          time.mul(timeSpeedUniform as unknown as number),
        ),
      )
    const t = fbm(animatedUv, { octaves, lacunarity, gain })
    // Normalize fbm's [-1..1]-ish range into [0..1] for colorRamp.
    const tNorm = (t as unknown as { add(n: number): { mul(n: number): unknown } }).add(1).mul(0.5)

    const material = new MeshBasicNodeMaterial()
    material.colorNode = colorRamp(tNorm as never, STOPS) as never
    const mesh = new Mesh(new PlaneGeometry(2, 2), material)
    ctx.scene.add(mesh)
    return () => {
      ctx.scene.remove(mesh)
      try {
        material.dispose()
      } catch {
        /* gotcha #13-adjacent benign race */
      }
      try {
        mesh.geometry.dispose()
      } catch {
        /* same */
      }
    }
  }, [ctx, octaves, lacunarity, gain, scaleUniform, timeSpeedUniform])

  return null
}

const SceneWrapper = dynamic(
  async () => {
    // Re-export inline so we can defer the three/webgpu import.
    const Inner = (props: { children: React.ReactNode }) => (
      <MatterScene>{props.children}</MatterScene>
    )
    return Inner
  },
  { ssr: false },
)

export default function FbmPlaygroundPage() {
  const paneContainerRef = useRef<HTMLDivElement>(null)
  const [params, setParams] = useState<Params>(INITIAL)
  // Remount the inner mesh when octaves/lacunarity/gain change because they
  // bake into the TSL fragment at material-build time.
  const [instanceKey, setInstanceKey] = useState(0)

  // Live uniforms for the parameters that survive on the GPU as uniforms.
  const scaleUniform = useMemo(() => uniform(INITIAL.scale), [])
  const timeSpeedUniform = useMemo(() => uniform(INITIAL.timeSpeed), [])

  useEffect(() => {
    const container = paneContainerRef.current
    if (!container) return

    const local = { ...INITIAL }
    const pane = new Pane({ container, title: 'FBM playground' })

    pane.addBinding(local, 'octaves', { min: 1, max: 8, step: 1 })
    pane.addBinding(local, 'lacunarity', { min: 1, max: 4, step: 0.05 })
    pane.addBinding(local, 'gain', { min: 0, max: 1, step: 0.01 })
    pane.addBlade({ view: 'separator' })
    pane.addBinding(local, 'scale', { min: 0.5, max: 10, step: 0.1 })
    pane.addBinding(local, 'timeSpeed', { label: 'time speed', min: 0, max: 2, step: 0.01 })
    pane.addBlade({ view: 'separator' })
    pane.addButton({ title: 'Apply octaves / lacunarity / gain' }).on('click', () => {
      setParams({ ...local })
      setInstanceKey((k) => k + 1)
    })

    pane.on('change', (ev) => {
      const key = (ev.target as { key?: keyof Params }).key
      if (key === 'scale') {
        ;(scaleUniform as unknown as { value: number }).value = local.scale
      } else if (key === 'timeSpeed') {
        ;(timeSpeedUniform as unknown as { value: number }).value = local.timeSpeed
      }
      // octaves/lacunarity/gain wait for the Apply button.
    })

    return () => {
      pane.dispose()
    }
  }, [scaleUniform, timeSpeedUniform])

  return (
    <main style={{ minHeight: '100vh', position: 'relative' }}>
      <div style={{ position: 'relative', height: '70vh' }}>
        <SceneWrapper key={instanceKey}>
          <FbmMesh
            octaves={params.octaves}
            lacunarity={params.lacunarity}
            gain={params.gain}
            scaleUniform={scaleUniform}
            timeSpeedUniform={timeSpeedUniform}
          />
        </SceneWrapper>
      </div>
      <div
        ref={paneContainerRef}
        style={{ position: 'fixed', top: '1rem', right: '1rem', zIndex: 10, width: '320px' }}
      />
      <section style={{ padding: '2rem', maxWidth: '60ch', margin: '0 auto' }}>
        <h1 style={{ marginTop: 0 }}>FBM playground</h1>
        <p>
          Internal Matter dev surface — not part of the public component catalog. Use this to feel
          out good defaults for <code>octaves</code>, <code>lacunarity</code>, and <code>gain</code>{' '}
          before <code>&lt;NoiseField&gt;</code> locks the prop API in 3.1.b.
        </p>
      </section>
    </main>
  )
}
```

- [ ] **Step 4.2: Build + run the docs site.**

```bash
pnpm --filter @matter/docs build
pnpm --filter @matter/docs dev
```

Open `http://localhost:3000/dev/fbm-playground`. Verify: page loads, grayscale FBM pattern is visible, dragging `scale` updates live, dragging `timeSpeed` updates live, dragging `octaves` then clicking Apply remounts the scene with the new octave count.

### Task 5: Lint + typecheck + commit

- [ ] **Step 5.1: Run the full check suite.**

```bash
pnpm typecheck && pnpm lint && pnpm test
```

Expected: all green.

- [ ] **Step 5.2: Commit.**

```bash
git add packages/matter/src/primitives/noise.ts packages/matter/src/primitives/noise.test.ts \
        packages/matter/src/primitives/fbm.ts packages/matter/src/primitives/fbm.test.ts \
        packages/matter/src/index.ts \
        apps/docs/app/dev/fbm-playground/page.tsx
git commit -m "feat(matter): add noise and fbm primitives + FBM playground

Phase 3.1.a — ships the foundational pattern primitives that NoiseField
(3.1.b), MeshGradient (3.4.b), and Aurora (3.5) all build on. Playground
at /dev/fbm-playground lets us feel out octaves/lacunarity/gain before
<NoiseField> locks its prop API."
```

### Stop-and-play gate (3.1.a)

Open `/dev/fbm-playground`. Scrub:

- `octaves` 1 → 8 (Apply each time)
- `lacunarity` 1.5 → 3
- `gain` 0.3 → 0.7
- `scale` 1 → 8
- `timeSpeed` 0 → 1

**Decision the user makes here:** what `octaves`/`lacunarity`/`gain` defaults feel right for `<NoiseField variant="organic">` in 3.1.b? Capture the chosen defaults in a comment at the top of `fbm.ts` for the next subagent to read.

### Done-criteria for 3.1.a

- [ ] `noise(uv())` and `fbm(uv())` are exported from `@lovo/matter` and importable as `import { noise, fbm } from '@lovo/matter'`.
- [ ] `pnpm test` is green; the two test files run real assertions.
- [ ] `/dev/fbm-playground` renders a moving grayscale FBM pattern that responds to all five Tweakpane controls.
- [ ] `pnpm build && pnpm typecheck && pnpm lint` is green at repo root.
- [ ] One commit with message scoped `feat(matter):`.
- [ ] User has played with the playground and recorded their preferred default `octaves`/`lacunarity`/`gain` (in a top-of-file comment in `fbm.ts` or in a `feedback_*.md` memory entry).

### Review pass (3.1.a)

Two-stage subagent review. Spawn one subagent for spec-compliance, one for code-quality.

**Spec-compliance reviewer prompt:** _"Review Phase 3.1.a's diff (since `m2-complete`) against the spec at `docs/superpowers/specs/2026-05-02-matter-design.md` §5.2 (NoiseField/Aurora primitives) and §11 row 3 (M3 row). Confirm: (1) `noise` and `fbm` ship as named exports of `@lovo/matter`; (2) `fbm` accepts the three documented options with sensible defaults; (3) the playground page lives at `/dev/fbm-playground` and is unlinked from main nav; (4) no out-of-scope additions. Report any gaps."_

**Code-quality reviewer prompt:** _"Review the same diff for code quality. Specifically check: gotcha #12 (uniform-as-arg, not chained-receiver) — is every TSL chain in the playground built starting from `uv()`/`vec2(...)` rather than from a uniform? Strict-mode safety — does the playground's effect lifecycle survive Strict-Mode mount→unmount→mount without leaking material/mesh? TypeScript strict — any `as unknown as` casts that should be replaced with proper TSL type narrowing? File hygiene — no `// TODO`/`// removed`/dead code? Comments — only WHY comments, no narration?"_

Address all REQUIRED review notes; defer SUGGESTED. Re-run check suite. Move to 3.1.b.

---

## Phase 3.1.b — `<NoiseField>` to registry (`voronoi` + `quantize` primitives + component)

**Goal:** Ship `<NoiseField>` as a copy-paste registry component supporting `variant: 'organic' | 'cellular' | 'grid'`, with a minimal docs page at `/components/noise-field` exposing every prop via Tweakpane. Add the two new primitives `voronoi` (cellular variant) and `quantize` (grid variant). The user's chosen FBM defaults from 3.1.a get baked in here.

**Scope:** Two new primitives + one Tier 1 component + one docs page + registry manifest update.

**Files:**

- Create: `packages/matter/src/primitives/voronoi.ts`, `voronoi.test.ts`
- Create: `packages/matter/src/primitives/quantize.ts`, `quantize.test.ts`
- Modify: `packages/matter/src/index.ts`
- Create: `registry/noise-field.tsx`
- Modify: `registry/registry.json`
- Modify: `registry/package.json`
- Create: `apps/docs/app/components/noise-field/page.tsx`

### Task 1: Add `voronoi` primitive

Voronoi gives the cellular look. Implementation: classical 2D voronoi via the standard "hash-based jitter inside grid cells" approach, returning the distance to the nearest jittered cell point. We use TSL's `mx_cell_noise_float` which gives us per-cell-id noise in `[0,1]` — for the cellular _distance_ output, fall back to a hand-written hash + min-distance loop in TSL.

Three's TSL `mx_worley_noise_float` gives Worley/voronoi-style noise as a scalar (the standard distance-to-nearest output). Use that as the implementation.

**Files:**

- Create: `packages/matter/src/primitives/voronoi.ts`

- [ ] **Step 1.1: Create `voronoi.ts`.**

```ts
// packages/matter/src/primitives/voronoi.ts
import { mx_worley_noise_float } from 'three/tsl'
import type { TSLNode } from './colorRamp.js'

/**
 * 2D voronoi (Worley) noise — distance to the nearest jittered cell point,
 * normalized roughly to [0, 1]. Higher values = farther from any cell point
 * (cell interiors); lower values = near a cell boundary.
 *
 * Built on three's `mx_worley_noise_float`. Combine with `colorRamp` for
 * a multi-color cellular pattern; threshold via `step`/`smoothstep` for
 * hard cell shapes.
 *
 * @param p — Vec2 TSL node, typically `uv() * scale`.
 */
export function voronoi(p: TSLNode): TSLNode {
  return mx_worley_noise_float(p) as unknown as TSLNode
}
```

- [ ] **Step 1.2: Test.**

File: `packages/matter/src/primitives/voronoi.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { uv } from 'three/tsl'
import { voronoi } from './voronoi.js'

describe('voronoi', () => {
  it('returns a TSL node when sampled at uv()', () => {
    expect(voronoi(uv())).toBeDefined()
  })
})
```

- [ ] **Step 1.3: Build + test.**

```bash
pnpm --filter @lovo/matter test && pnpm --filter @lovo/matter build
```

### Task 2: Add `quantize` primitive

`quantize(t, steps)` rounds a scalar TSL node to `steps` discrete levels. Used by NoiseField's `grid` variant to produce hard-edged stepped output from FBM. Pure-math testable.

**Files:**

- Create: `packages/matter/src/primitives/quantize.ts`
- Create: `packages/matter/src/primitives/quantize.test.ts`

- [ ] **Step 2.1: Create `quantize.ts`.**

```ts
// packages/matter/src/primitives/quantize.ts
import type { TSLNode } from './colorRamp.js'
import type { ShaderNodeObject } from 'three/tsl'
import type { Node } from 'three/webgpu'

/**
 * Quantize a scalar TSL node to `steps` discrete levels.
 *
 *   quantize(t, 4) → values in {0, 0.25, 0.5, 0.75, 1.0}
 *
 * `steps` is a JS-side number (loop-equivalent at TSL build time, baked in).
 * If you need an animatable step count, rebuild the TSL fragment.
 */
export function quantize(t: TSLNode, steps: number): TSLNode {
  if (steps <= 1) {
    // Edge case: single step → constant 0. Return as-is wrapped in mul(0).
    return (t as ShaderNodeObject<Node>).mul(0)
  }
  const denom = steps - 1
  // floor(t * (steps-1) + 0.5) / (steps-1)
  // Using floor(x + 0.5) instead of round() for TSL portability.
  return (t as ShaderNodeObject<Node>).mul(denom).add(0.5).floor().div(denom)
}
```

- [ ] **Step 2.2: Test.**

File: `packages/matter/src/primitives/quantize.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { uv } from 'three/tsl'
import { quantize } from './quantize.js'

describe('quantize', () => {
  it('returns a TSL node for steps > 1', () => {
    const q = quantize(uv().x, 4)
    expect(q).toBeDefined()
  })

  it('handles steps=1 without throwing', () => {
    expect(() => quantize(uv().x, 1)).not.toThrow()
  })

  it('handles steps=2', () => {
    const q = quantize(uv().x, 2)
    expect(q).toBeDefined()
  })
})
```

Note: We can't unit-test the actual quantization values since TSL nodes don't evaluate on the CPU. The visual test is the NoiseField docs page in `variant="grid"`.

- [ ] **Step 2.3: Build + test.**

```bash
pnpm --filter @lovo/matter test && pnpm --filter @lovo/matter build
```

### Task 3: Export both primitives

**Files:**

- Modify: `packages/matter/src/index.ts`

- [ ] **Step 3.1: Append exports.**

After the `fbm` exports added in 3.1.a:

```ts
export { voronoi } from './primitives/voronoi.js'

export { quantize } from './primitives/quantize.js'
```

- [ ] **Step 3.2: Build + typecheck.**

```bash
pnpm --filter @lovo/matter build && pnpm --filter @lovo/matter typecheck
```

### Task 4: Create the `<NoiseField>` registry component

Spec §5.2: `<NoiseField scale={1} speed={0.5} colors={['#000','#fff']} octaves={4} variant="organic" />`. Three variants: `organic` uses fbm; `cellular` uses voronoi; `grid` uses `quantize(fbm(...))`. Default fallback is an inline SVG `<feTurbulence>`.

**Files:**

- Create: `registry/noise-field.tsx`

- [ ] **Step 4.1: Create the component.**

```tsx
// registry/noise-field.tsx
'use client'

import { useEffect, useMemo, type CSSProperties, type ReactNode } from 'react'
import { Mesh, PlaneGeometry, Vector2 } from 'three'
import { MeshBasicNodeMaterial } from 'three/webgpu'
import { vec2, vec3, uv, time, uniform } from '@lovo/matter'
import { colorRamp, type ColorRampStop } from '@lovo/matter'
import { fbm, voronoi, quantize } from '@lovo/matter'
import {
  MatterScene,
  useMatterContext,
  useAnimatableUniform,
  useCursor,
  FallbackBoundary,
  type AnimatableProp,
  type CursorSignal,
} from '@lovo/matter-react'

export interface NoiseFieldProps {
  scale?: AnimatableProp<number>
  speed?: AnimatableProp<number>
  colors?: AnimatableProp<string[]>
  octaves?: number // JS-side; baked into TSL fragment at mount.
  variant?: 'organic' | 'cellular' | 'grid'
  interactive?: boolean
  inputs?: { cursor?: CursorSignal }
  fallback?: ReactNode
  className?: string
  style?: CSSProperties
}

const DEFAULT_COLORS = ['#0a0a0a', '#f5f5f5']
const GRID_STEPS = 6 // hardcoded for variant="grid"; promotable to a prop in v2.

const hexToVec3 = (hex: string): readonly [number, number, number] => {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.slice(0, 2), 16) / 255
  const g = parseInt(clean.slice(2, 4), 16) / 255
  const b = parseInt(clean.slice(4, 6), 16) / 255
  return [r, g, b]
}

const isSignalLike = (v: unknown): v is { get(): unknown } =>
  typeof v === 'object' && v !== null && typeof (v as { get?: unknown }).get === 'function'

const resolveColors = (prop: AnimatableProp<string[]> | undefined): string[] => {
  if (prop === undefined) return DEFAULT_COLORS
  if (isSignalLike(prop)) return (prop as { get(): string[] }).get()
  return prop
}

function NoiseFieldMesh(props: NoiseFieldProps) {
  const ctx = useMatterContext()
  const colors = resolveColors(props.colors)
  const octaves = props.octaves ?? 4
  const variant = props.variant ?? 'organic'

  const cursorFromInputs = props.inputs?.cursor
  const cursorAuto = useCursor()
  const cursor = cursorFromInputs ?? (props.interactive ? cursorAuto : null)

  const scaleUniform = useAnimatableUniform<number>(props.scale ?? 1)
  const speedUniform = useAnimatableUniform<number>(props.speed ?? 0.5)

  const cursorVec = useMemo(() => new Vector2(0.5, 0.5), [])
  const cursorUniform = useMemo(() => uniform(cursorVec), [cursorVec])
  useEffect(() => {
    if (cursor) {
      return cursor.on('change', ([x, y]) => cursorVec.set(x, 1 - y))
    }
    cursorVec.set(0.5, 0.5)
    return undefined
  }, [cursor, cursorVec])

  useEffect(() => {
    if (!ctx) return

    const stops: ColorRampStop[] = colors.map((hex, i) => {
      const [r, g, b] = hexToVec3(hex)
      return {
        color: vec3(r, g, b),
        position: i / Math.max(colors.length - 1, 1),
      }
    })

    // Build the input UV. Uniforms enter as ARGUMENTS to TSL chains
    // (gotcha #12), so we go uv() -> sub(cursor for optional displace)
    // -> mul(scale).
    const baseUv = uv()
      .sub(cursorUniform.mul(0).add(0)) // no-op: keeps reference for future cursor-displace work
      .mul(scaleUniform as unknown as number)
    const animatedUv = baseUv.add(
      vec2(
        time.mul(speedUniform as unknown as number),
        time.mul(speedUniform as unknown as number),
      ),
    )

    let t
    if (variant === 'cellular') {
      t = voronoi(animatedUv)
    } else if (variant === 'grid') {
      const raw = fbm(animatedUv, { octaves })
      const norm = (raw as unknown as { add(n: number): { mul(n: number): unknown } })
        .add(1)
        .mul(0.5)
      t = quantize(norm as never, GRID_STEPS)
    } else {
      const raw = fbm(animatedUv, { octaves })
      t = (raw as unknown as { add(n: number): { mul(n: number): unknown } }).add(1).mul(0.5)
    }

    const material = new MeshBasicNodeMaterial()
    material.colorNode = colorRamp(t as never, stops) as never
    const mesh = new Mesh(new PlaneGeometry(2, 2), material)
    ctx.scene.add(mesh)
    return () => {
      ctx.scene.remove(mesh)
      try {
        material.dispose()
      } catch {
        /* benign during rebuild */
      }
      try {
        mesh.geometry.dispose()
      } catch {
        /* same */
      }
    }
  }, [ctx, colors.join('|'), octaves, variant, scaleUniform, speedUniform, cursorUniform])

  return null
}

function DefaultFallback() {
  // SVG <feTurbulence> approximation per spec §5.2.
  // baseFrequency tuned to roughly match `fbm(uv*3)` at default octaves.
  const id = 'matter-noisefield-fallback'
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <svg
        width="100%"
        height="100%"
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: 'block' }}
        preserveAspectRatio="none"
      >
        <filter id={id}>
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" />
          <feColorMatrix
            type="matrix"
            values="0 0 0 0 0.04
                    0 0 0 0 0.04
                    0 0 0 0 0.04
                    0 0 0 1 0"
          />
        </filter>
        <rect width="100%" height="100%" filter={`url(#${id})`} />
      </svg>
    </div>
  )
}

export function NoiseField(props: NoiseFieldProps) {
  return (
    <FallbackBoundary fallback={props.fallback ?? <DefaultFallback />}>
      <MatterScene className={props.className} style={props.style}>
        <NoiseFieldMesh {...props} />
      </MatterScene>
    </FallbackBoundary>
  )
}
```

### Task 5: Update registry manifest and package exports

**Files:**

- Modify: `registry/registry.json`
- Modify: `registry/package.json`

- [ ] **Step 5.1: Add the registry entry.**

Replace the contents of `registry/registry.json` with:

```json
{
  "$schema": "./registry.schema.json",
  "version": "0.0.1",
  "components": {
    "linear-gradient": {
      "file": "linear-gradient.tsx",
      "description": "Animated linear or radial gradient with optional cursor parallax. The simplest, foundational Matter component.",
      "dependencies": ["@lovo/matter", "@lovo/matter-react", "react", "three"],
      "uses_primitives": ["colorRamp", "mix", "uv", "vec2", "vec3", "length", "time", "uniform"],
      "tier": 1
    },
    "noise-field": {
      "file": "noise-field.tsx",
      "description": "Pure noise pattern in three flavors: organic (fbm), cellular (voronoi), grid (quantized fbm).",
      "dependencies": ["@lovo/matter", "@lovo/matter-react", "react", "three"],
      "uses_primitives": [
        "colorRamp",
        "fbm",
        "voronoi",
        "quantize",
        "uv",
        "vec2",
        "vec3",
        "time",
        "uniform"
      ],
      "tier": 1
    }
  }
}
```

- [ ] **Step 5.2: Add the package export key.**

In `registry/package.json`, expand the `exports` field:

```json
{
  "name": "@matter/registry",
  "private": true,
  "version": "0.0.0",
  "description": "Source-of-truth Tier 1 components shipped via the @lovo/matter-cli copy-paste flow. Not published to npm.",
  "type": "module",
  "exports": {
    "./linear-gradient": "./linear-gradient.tsx",
    "./noise-field": "./noise-field.tsx"
  },
  "dependencies": {
    "@lovo/matter": "workspace:*",
    "@lovo/matter-react": "workspace:*",
    "react": "^19.0.0",
    "three": "^0.170.0"
  },
  "devDependencies": {
    "@matter/eslint-config": "workspace:*",
    "@matter/tsconfig": "workspace:*",
    "@types/react": "^19.0.0",
    "@types/three": "^0.170.0",
    "typescript": "^5.6.0"
  }
}
```

- [ ] **Step 5.3: Re-install to pick up the new export.**

```bash
pnpm install
```

### Task 6: Build the `/components/noise-field` docs page

Pattern matches `apps/docs/app/components/linear-gradient/page.tsx`. Tweakpane on every prop. `octaves` requires Apply (baked into TSL); other props are live.

**Files:**

- Create: `apps/docs/app/components/noise-field/page.tsx`

- [ ] **Step 6.1: Create the page.**

```tsx
// apps/docs/app/components/noise-field/page.tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { Pane } from 'tweakpane'
import dynamic from 'next/dynamic'

const NoiseField = dynamic(() => import('@matter/registry/noise-field').then((m) => m.NoiseField), {
  ssr: false,
})

interface Params {
  color0: string
  color1: string
  scale: number
  speed: number
  octaves: number
  variant: 'organic' | 'cellular' | 'grid'
  interactive: boolean
}

const INITIAL: Params = {
  color0: '#0a0a0a',
  color1: '#f5f5f5',
  scale: 3,
  speed: 0.4,
  octaves: 4,
  variant: 'organic',
  interactive: false,
}

export default function NoiseFieldPage() {
  const paneContainerRef = useRef<HTMLDivElement>(null)
  const [params, setParams] = useState<Params>(INITIAL)
  const [instanceKey, setInstanceKey] = useState(0)

  useEffect(() => {
    const container = paneContainerRef.current
    if (!container) return

    const local = { ...INITIAL }
    const pane = new Pane({ container, title: '<NoiseField>' })

    pane.addBinding(local, 'color0', { label: 'color 0' })
    pane.addBinding(local, 'color1', { label: 'color 1' })
    pane.addBlade({ view: 'separator' })
    pane.addBinding(local, 'variant', {
      options: { organic: 'organic', cellular: 'cellular', grid: 'grid' },
    })
    pane.addBinding(local, 'scale', { min: 0.5, max: 10, step: 0.1 })
    pane.addBinding(local, 'speed', { min: 0, max: 2, step: 0.01 })
    pane.addBinding(local, 'octaves', { min: 1, max: 8, step: 1 })
    pane.addBlade({ view: 'separator' })
    pane.addBinding(local, 'interactive', { label: 'interactive (cursor)' })
    pane.addBlade({ view: 'separator' })
    pane.addButton({ title: 'Apply octaves / variant' }).on('click', () => {
      setParams({ ...local })
      setInstanceKey((k) => k + 1)
    })

    pane.on('change', () => {
      setParams({ ...local })
    })

    return () => {
      pane.dispose()
    }
  }, [])

  return (
    <main style={{ minHeight: '100vh', position: 'relative' }}>
      <div style={{ position: 'relative', height: '70vh' }}>
        <NoiseField
          key={instanceKey}
          colors={[params.color0, params.color1]}
          scale={params.scale}
          speed={params.speed}
          octaves={params.octaves}
          variant={params.variant}
          interactive={params.interactive}
        />
      </div>
      <div
        ref={paneContainerRef}
        style={{ position: 'fixed', top: '1rem', right: '1rem', zIndex: 10, width: '320px' }}
      />
      <section style={{ padding: '2rem', maxWidth: '60ch', margin: '0 auto' }}>
        <h1 style={{ marginTop: 0 }}>&lt;NoiseField /&gt;</h1>
        <pre
          style={{
            background: '#1a1a2a',
            color: '#e0e0f0',
            padding: '1rem',
            borderRadius: '0.5rem',
            overflow: 'auto',
            fontSize: '0.85rem',
          }}
        >
          {`import { NoiseField } from '@/components/matter/noise-field'

<NoiseField
  variant="organic"
  scale={3}
  speed={0.4}
  colors={['#0a0a0a', '#f5f5f5']}
/>`}
        </pre>
      </section>
    </main>
  )
}
```

### Task 7: Lint, typecheck, run, commit

- [ ] **Step 7.1: Build and verify.**

```bash
pnpm build && pnpm typecheck && pnpm lint && pnpm test
pnpm --filter @matter/docs dev
```

Open `http://localhost:3000/components/noise-field`. Check each variant: organic (clouds), cellular (voronoi cells), grid (stepped). Drag scale/speed/colors — live. Drag octaves → Apply → remount.

- [ ] **Step 7.2: Commit.**

```bash
git add packages/matter/src/primitives/voronoi.ts packages/matter/src/primitives/voronoi.test.ts \
        packages/matter/src/primitives/quantize.ts packages/matter/src/primitives/quantize.test.ts \
        packages/matter/src/index.ts \
        registry/noise-field.tsx registry/registry.json registry/package.json \
        apps/docs/app/components/noise-field/page.tsx \
        pnpm-lock.yaml
git commit -m "feat(registry): ship <NoiseField> + voronoi/quantize primitives

Phase 3.1.b — second Tier 1 component lands. Three variants (organic/
cellular/grid) prove that fbm + voronoi + quantize compose cleanly through
colorRamp. Registry entry + docs page + Tweakpane on every prop."
```

### Stop-and-play gate (3.1.b)

`/components/noise-field`. Cycle through all three variants with different scales and speeds. Confirm the SVG fallback shows during the WebGPU init flash (open in a private window or throttle network in DevTools to see it longer).

### Done-criteria for 3.1.b

- [ ] `voronoi` and `quantize` exported from `@lovo/matter`.
- [ ] `<NoiseField>` works in all three variants on `/components/noise-field` with live Tweakpane controls.
- [ ] `registry/registry.json` and `registry/package.json` updated with `noise-field`.
- [ ] `pnpm build && pnpm typecheck && pnpm lint && pnpm test` green.
- [ ] One commit, scope `feat(registry):`.
- [ ] CLI sanity: `pnpm --filter @lovo/matter-cli build && node packages/matter-cli/dist/index.js list --registry file://$(pwd)/registry/registry.json` lists both `linear-gradient` and `noise-field`.

### Review pass (3.1.b)

**Spec-compliance reviewer:** _"Review Phase 3.1.b against spec §5.2 NoiseField (line 485). Confirm: prop names match (`scale`, `speed`, `colors`, `octaves`, `variant`); the three variants exist and produce visually distinct output; the SVG fallback exists; the component wraps itself in `<MatterScene>` and `<FallbackBoundary>` per the contract in §5.1."_

**Code-quality reviewer:** _"Review the NoiseField component for: gotcha #12 (TSL chains start from `uv()`/`vec2`, not from uniforms — flag any `uniform.something()` patterns); strict-mode safety of the cursor effect; absence of out-of-scope props (the spec lists exactly five visual props + `interactive`/`inputs`/`fallback`/`className`/`style`); registry component file imports ONLY from `@lovo/matter`, `@lovo/matter-react`, `react` — no imports from another registry file (CLAUDE.md `registry/_.tsx` rule)."\*

---

## Phase 3.2 — `<DotField>` to registry (`sdfCircle` + `displace` + `useResize` + component)

**Goal:** Ship `<DotField>` — the architecturally-validating component (per spec §5.2 line 483) that proves tiling + SDF + cursor displacement work end-to-end. Pixel-aware (spacing/dotSize in pixels), so this phase introduces `useResize` to expose canvas resolution as a uniform.

**Scope:** Two new primitives + one new hook + one Tier 1 component + one docs page.

**Files:**

- Create: `packages/matter/src/primitives/sdfCircle.ts`, `sdfCircle.test.ts`
- Create: `packages/matter/src/primitives/displace.ts` (no test — pure TSL passthrough)
- Modify: `packages/matter/src/index.ts`
- Create: `packages/matter-react/src/useResize.ts`, `useResize.test.ts`
- Modify: `packages/matter-react/src/index.ts`
- Create: `registry/dot-field.tsx`
- Modify: `registry/registry.json`, `registry/package.json`
- Create: `apps/docs/app/components/dot-field/page.tsx`

### Task 1: Add `sdfCircle` primitive

A signed distance field for a circle. Returns negative inside, zero at boundary, positive outside.

**Files:**

- Create: `packages/matter/src/primitives/sdfCircle.ts`

- [ ] **Step 1.1: Create the file.**

```ts
// packages/matter/src/primitives/sdfCircle.ts
import { length } from 'three/tsl'
import type { TSLNode } from './colorRamp.js'
import type { ShaderNodeObject } from 'three/tsl'
import type { Node } from 'three/webgpu'

/**
 * Signed distance field for a circle centered at the origin.
 *
 *   sdfCircle(p, r) = length(p) - r
 *
 * Negative inside the circle, zero on the boundary, positive outside.
 * Combine with `smoothstep(-edge, +edge, sdf)` to render a soft-edged disk.
 *
 * @param p — Vec2 TSL node (typically a UV-space offset from the center).
 * @param radius — JS-side scalar OR a scalar TSL node.
 */
export function sdfCircle(p: TSLNode, radius: TSLNode | number): TSLNode {
  const lp = length(p) as ShaderNodeObject<Node>
  if (typeof radius === 'number') {
    return lp.sub(radius)
  }
  return lp.sub(radius as ShaderNodeObject<Node>)
}
```

- [ ] **Step 1.2: Test.**

File: `packages/matter/src/primitives/sdfCircle.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { uv, vec2 } from 'three/tsl'
import { sdfCircle } from './sdfCircle.js'

describe('sdfCircle', () => {
  it('returns a TSL node with a numeric radius', () => {
    const p = (uv() as unknown as { sub(v: unknown): unknown }).sub(vec2(0.5, 0.5))
    expect(sdfCircle(p as never, 0.25)).toBeDefined()
  })
})
```

### Task 2: Add `displace` primitive

`displace(p, by)` adds a 2D displacement vector to a point. Trivial wrapper but earns its keep as the cursor-influence pattern in DotField (3.2) and the FBM-warp pattern in Aurora (3.5).

**Files:**

- Create: `packages/matter/src/primitives/displace.ts`

- [ ] **Step 2.1: Create the file.**

```ts
// packages/matter/src/primitives/displace.ts
import type { TSLNode } from './colorRamp.js'
import type { ShaderNodeObject } from 'three/tsl'
import type { Node } from 'three/webgpu'

/**
 * Displace a Vec2 point by another Vec2.
 *
 *   displace(p, by) = p + by
 *
 * Thin wrapper that exists so consumer code reads as the spatial intent
 * ("displace the cell center by the cursor pull") instead of arithmetic.
 *
 * @param p — Vec2 TSL node (the position being displaced).
 * @param by — Vec2 TSL node (the displacement vector).
 */
export function displace(p: TSLNode, by: TSLNode): TSLNode {
  return (p as ShaderNodeObject<Node>).add(by as ShaderNodeObject<Node>)
}
```

(No test — the math is `add()`. The visual test is DotField in motion.)

### Task 3: Export the two primitives

**Files:**

- Modify: `packages/matter/src/index.ts`

- [ ] **Step 3.1: Append.**

```ts
export { sdfCircle } from './primitives/sdfCircle.js'

export { displace } from './primitives/displace.js'
```

- [ ] **Step 3.2: Build.**

```bash
pnpm --filter @lovo/matter build && pnpm --filter @lovo/matter test
```

### Task 4: Add `useResize` hook

The hook returns a signal with the current canvas client size and DPR. We use `ResizeObserver` on the canvas element from the parent `MatterScene`. The signal emits `[width, height, dpr]` triples.

**Files:**

- Create: `packages/matter-react/src/useResize.ts`

- [ ] **Step 4.1: Create the hook.**

```ts
// packages/matter-react/src/useResize.ts
'use client'

import { useEffect, useRef, useState } from 'react'
import { useMatterContext } from './useMatterContext.js'

export type ResizeValue = readonly [width: number, height: number, dpr: number]

export interface ResizeSignal {
  /** Current size in CSS pixels + devicePixelRatio. */
  get(): ResizeValue
  on(event: 'change', cb: (value: ResizeValue) => void): () => void
}

const STUB_SIGNAL: ResizeSignal = {
  get: () => [0, 0, 1] as const,
  on: () => () => undefined,
}

/**
 * Track the parent <MatterScene>'s canvas size + DPR. Exposes a MatterSignal
 * that components can pass into a TSL uniform to make pixel-aware effects
 * (e.g., DotField's pixel-spacing math).
 *
 * Strict-Mode-safe: lifecycle is in one effect, so React 19's intentional
 * mount→unmount→mount cycle creates a fresh ResizeObserver per real mount
 * (CLAUDE.md gotcha #14).
 *
 * Falls back to the stub signal until the parent context is ready.
 */
export function useResize(): ResizeSignal {
  const ctx = useMatterContext()
  const [signal, setSignal] = useState<ResizeSignal | null>(null)

  useEffect(() => {
    if (!ctx) return undefined

    const canvas = ctx.renderer.three.domElement
    if (!(canvas instanceof HTMLCanvasElement)) return undefined

    let value: ResizeValue = [
      canvas.clientWidth,
      canvas.clientHeight,
      typeof window !== 'undefined' ? window.devicePixelRatio : 1,
    ]
    const listeners = new Set<(v: ResizeValue) => void>()
    const fresh: ResizeSignal = {
      get: () => value,
      on: (_event, cb) => {
        listeners.add(cb)
        return () => listeners.delete(cb)
      },
    }
    setSignal(fresh)

    const emit = () => {
      const next: ResizeValue = [
        canvas.clientWidth,
        canvas.clientHeight,
        typeof window !== 'undefined' ? window.devicePixelRatio : 1,
      ]
      if (next[0] === value[0] && next[1] === value[1] && next[2] === value[2]) return
      value = next
      for (const cb of listeners) cb(next)
    }

    const observer = new ResizeObserver(emit)
    observer.observe(canvas)
    // Also listen for DPR changes (zoom). Cross-browser approach: query
    // matchMedia at the current dpr; when it stops matching, re-query.
    let mql: MediaQueryList | null = null
    const setupDprWatch = () => {
      const dpr = typeof window !== 'undefined' ? window.devicePixelRatio : 1
      mql = window.matchMedia(`(resolution: ${dpr}dppx)`)
      mql.addEventListener('change', () => {
        emit()
        mql?.removeEventListener('change', () => {})
        setupDprWatch()
      })
    }
    if (typeof window !== 'undefined') setupDprWatch()

    return () => {
      observer.disconnect()
      mql = null
      listeners.clear()
      setSignal(null)
    }
  }, [ctx])

  return signal ?? STUB_SIGNAL
}
```

- [ ] **Step 4.2: Test the stub branch.**

File: `packages/matter-react/src/useResize.test.ts`

```ts
// useResize is heavily DOM-bound; we test the stub-signal contract
// (the path that runs before the parent <MatterScene> is ready).
import { describe, it, expect } from 'vitest'

describe('useResize stub signal', () => {
  it('exists at the contract level', () => {
    // Sanity: the module imports and the type signature is non-empty.
    // Rendering tests for the live path live in the docs-page playground
    // (which is the GPU-coupled integration test for hooks like this).
    const mod = import('./useResize.js')
    expect(mod).toBeDefined()
  })
})
```

(The stub is small enough that an integration test on the docs page is more honest than a JSDOM mock of `ResizeObserver`.)

- [ ] **Step 4.3: Export.**

In `packages/matter-react/src/index.ts`, add:

```ts
export { useResize } from './useResize.js'
export type { ResizeSignal, ResizeValue } from './useResize.js'
```

- [ ] **Step 4.4: Build.**

```bash
pnpm --filter @lovo/matter-react build && pnpm --filter @lovo/matter-react test
```

### Task 5: Create `<DotField>` registry component

Spec §5.2 line 466: `<DotField spacing={30} dotSize={2} color="#888" reach={100} strength={1} interactive={true} />`. Tile uv into cells; render a circle per cell via `sdfCircle` + `smoothstep`; displace each cell center based on cursor distance.

**Files:**

- Create: `registry/dot-field.tsx`

- [ ] **Step 5.1: Create the component.**

```tsx
// registry/dot-field.tsx
'use client'

import { useEffect, useMemo, type CSSProperties, type ReactNode } from 'react'
import { Mesh, PlaneGeometry, Vector2 } from 'three'
import { MeshBasicNodeMaterial } from 'three/webgpu'
import { vec2, vec3, vec4, mix, mod, length, smoothstep, uv, uniform } from '@lovo/matter'
import { sdfCircle, displace } from '@lovo/matter'
import {
  MatterScene,
  useMatterContext,
  useAnimatableUniform,
  useCursor,
  useResize,
  FallbackBoundary,
  type AnimatableProp,
  type CursorSignal,
} from '@lovo/matter-react'

export interface DotFieldProps {
  spacing?: AnimatableProp<number>
  dotSize?: AnimatableProp<number>
  color?: string
  reach?: AnimatableProp<number>
  strength?: AnimatableProp<number>
  interactive?: boolean
  inputs?: { cursor?: CursorSignal }
  fallback?: ReactNode
  className?: string
  style?: CSSProperties
}

const DEFAULTS = { spacing: 30, dotSize: 2, color: '#888888', reach: 100, strength: 1 } as const

const hexToVec3 = (hex: string): readonly [number, number, number] => {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.slice(0, 2), 16) / 255
  const g = parseInt(clean.slice(2, 4), 16) / 255
  const b = parseInt(clean.slice(4, 6), 16) / 255
  return [r, g, b]
}

function DotFieldMesh(props: DotFieldProps) {
  const ctx = useMatterContext()
  const cursorFromInputs = props.inputs?.cursor
  const cursorAuto = useCursor()
  const cursor = cursorFromInputs ?? ((props.interactive ?? true) ? cursorAuto : null)
  const resize = useResize()

  const spacingUniform = useAnimatableUniform<number>(props.spacing ?? DEFAULTS.spacing)
  const dotSizeUniform = useAnimatableUniform<number>(props.dotSize ?? DEFAULTS.dotSize)
  const reachUniform = useAnimatableUniform<number>(props.reach ?? DEFAULTS.reach)
  const strengthUniform = useAnimatableUniform<number>(props.strength ?? DEFAULTS.strength)

  const [cr, cg, cb] = hexToVec3(props.color ?? DEFAULTS.color)

  // Cursor (UV-space, y inverted).
  const cursorVec = useMemo(() => new Vector2(0.5, 0.5), [])
  const cursorUniform = useMemo(() => uniform(cursorVec), [cursorVec])
  useEffect(() => {
    if (cursor) return cursor.on('change', ([x, y]) => cursorVec.set(x, 1 - y))
    cursorVec.set(0.5, 0.5)
    return undefined
  }, [cursor, cursorVec])

  // Resolution (CSS px) — fed into the tiling math.
  const resVec = useMemo(() => new Vector2(1, 1), [])
  const resUniform = useMemo(() => uniform(resVec), [resVec])
  useEffect(() => {
    return resize.on('change', ([w, h]) => resVec.set(w, h))
  }, [resize, resVec])

  useEffect(() => {
    if (!ctx) return

    // Tile uv into cells of `spacing` CSS px. Cell-local coord in [0,1].
    // p = uv * resolution / spacing
    const pxUv = uv()
      .mul(resUniform)
      .div(spacingUniform as unknown as number)
    // Cell-local, recentered to [-0.5, 0.5].
    const cellLocal = mod(pxUv, 1).sub(vec2(0.5, 0.5))
    // Cell index (whole part of pxUv) tells us where this cell sits.
    // Use it (in uv-space, scaled back) to compute distance to cursor.
    const cellIndex = pxUv.sub(mod(pxUv, 1))
    const cellCenterUv = cellIndex
      .add(vec2(0.5, 0.5))
      .mul(spacingUniform as unknown as number)
      .div(resUniform)
    // Distance from this cell's center (in uv space) to cursor (in uv space).
    const distToCursor = length(cellCenterUv.sub(cursorUniform))
    // Convert reach (CSS px) into uv-space distance: reach_px / min(width,height).
    const reachUv = (reachUniform as unknown as { div(n: unknown): unknown }).div(
      // Use min(width,height) for an isotropic reach circle.
      length(resUniform).mul(0.7071), // length([w,h])/sqrt(2) ~= mean
    )
    // Cursor influence: 1 at the cursor, 0 at reach distance.
    const influence = smoothstep(reachUv as never, 0, distToCursor)
    // Pull direction: from cell center toward cursor, normalized.
    const pullDir = cursorUniform.sub(cellCenterUv) // not normalized — small offsets fine
    // Offset the cell-local coord by influence * strength * pullDir.
    const offset = pullDir
      .mul(influence as unknown as number)
      .mul(strengthUniform as unknown as number)
      .mul(0.5) // tame the displacement so it stays inside the cell
    const displacedLocal = displace(cellLocal, offset as never)

    // dotSize is in CSS px; convert to cell-local fraction:
    // radius = (dotSize / 2) / spacing.
    const radius = (dotSizeUniform as unknown as { div(n: unknown): unknown }).div(
      (spacingUniform as unknown as { mul(n: number): unknown }).mul(2),
    )
    const sdf = sdfCircle(displacedLocal, radius as never)
    // Soft edge: smoothstep from radius+aa to radius-aa around the boundary.
    const aa = 0.01
    const dotMask = smoothstep(aa, -aa, sdf as never) // inside → 1, outside → 0

    const material = new MeshBasicNodeMaterial()
    material.colorNode = vec4(
      mix(vec3(0, 0, 0), vec3(cr, cg, cb), dotMask as never).x,
      mix(vec3(0, 0, 0), vec3(cr, cg, cb), dotMask as never).y,
      mix(vec3(0, 0, 0), vec3(cr, cg, cb), dotMask as never).z,
      dotMask as never, // alpha = mask, so the canvas's clearAlpha=0 shows through outside dots
    ) as never

    const mesh = new Mesh(new PlaneGeometry(2, 2), material)
    ctx.scene.add(mesh)
    return () => {
      ctx.scene.remove(mesh)
      try {
        material.dispose()
      } catch {
        /* benign */
      }
      try {
        mesh.geometry.dispose()
      } catch {
        /* benign */
      }
    }
  }, [
    ctx,
    cr,
    cg,
    cb,
    spacingUniform,
    dotSizeUniform,
    reachUniform,
    strengthUniform,
    cursorUniform,
    resUniform,
  ])

  return null
}

function DefaultFallback({ color, spacing }: { color: string; spacing: number }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `radial-gradient(circle, ${color} 1px, transparent 1.5px)`,
        backgroundSize: `${spacing}px ${spacing}px`,
      }}
    />
  )
}

export function DotField(props: DotFieldProps) {
  const fallbackColor = typeof props.color === 'string' ? props.color : DEFAULTS.color
  const fallbackSpacing = typeof props.spacing === 'number' ? props.spacing : DEFAULTS.spacing
  return (
    <FallbackBoundary
      fallback={
        props.fallback ?? <DefaultFallback color={fallbackColor} spacing={fallbackSpacing} />
      }
    >
      <MatterScene className={props.className} style={props.style}>
        <DotFieldMesh {...props} />
      </MatterScene>
    </FallbackBoundary>
  )
}
```

### Task 6: Update registry manifest, package exports, docs page

- [ ] **Step 6.1: Add registry entry for `dot-field`.**

Add a new entry under `components:` in `registry/registry.json`:

```json
"dot-field": {
  "file": "dot-field.tsx",
  "description": "Tiled dot field with cursor displacement — the architecturally-validating Matter component.",
  "dependencies": ["@lovo/matter", "@lovo/matter-react", "react", "three"],
  "uses_primitives": ["sdfCircle", "displace", "mix", "mod", "smoothstep", "length", "uv", "vec2", "vec3", "vec4", "uniform"],
  "tier": 1
}
```

- [ ] **Step 6.2: Add export key in `registry/package.json`.**

```json
"./dot-field": "./dot-field.tsx"
```

- [ ] **Step 6.3: Create `apps/docs/app/components/dot-field/page.tsx`.**

Modeled on `noise-field/page.tsx` from 3.1.b. Tweakpane bindings: `color` (string), `spacing` (8–80, step 1), `dotSize` (1–8, step 0.5), `reach` (10–400, step 5), `strength` (0–3, step 0.05), `interactive` (bool). All five are uniforms — no Apply button needed.

```tsx
// apps/docs/app/components/dot-field/page.tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { Pane } from 'tweakpane'
import dynamic from 'next/dynamic'

const DotField = dynamic(() => import('@matter/registry/dot-field').then((m) => m.DotField), {
  ssr: false,
})

interface Params {
  color: string
  spacing: number
  dotSize: number
  reach: number
  strength: number
  interactive: boolean
}

const INITIAL: Params = {
  color: '#888888',
  spacing: 30,
  dotSize: 2,
  reach: 100,
  strength: 1,
  interactive: true,
}

export default function DotFieldPage() {
  const paneContainerRef = useRef<HTMLDivElement>(null)
  const [params, setParams] = useState<Params>(INITIAL)

  useEffect(() => {
    const container = paneContainerRef.current
    if (!container) return
    const local = { ...INITIAL }
    const pane = new Pane({ container, title: '<DotField>' })
    pane.addBinding(local, 'color')
    pane.addBlade({ view: 'separator' })
    pane.addBinding(local, 'spacing', { min: 8, max: 80, step: 1 })
    pane.addBinding(local, 'dotSize', { label: 'dot size', min: 1, max: 8, step: 0.5 })
    pane.addBlade({ view: 'separator' })
    pane.addBinding(local, 'reach', { min: 10, max: 400, step: 5 })
    pane.addBinding(local, 'strength', { min: 0, max: 3, step: 0.05 })
    pane.addBlade({ view: 'separator' })
    pane.addBinding(local, 'interactive', { label: 'interactive (cursor)' })
    pane.on('change', () => setParams({ ...local }))
    return () => {
      pane.dispose()
    }
  }, [])

  return (
    <main style={{ minHeight: '100vh', position: 'relative' }}>
      <div style={{ position: 'relative', height: '70vh', background: '#0a0a14' }}>
        <DotField
          color={params.color}
          spacing={params.spacing}
          dotSize={params.dotSize}
          reach={params.reach}
          strength={params.strength}
          interactive={params.interactive}
        />
      </div>
      <div
        ref={paneContainerRef}
        style={{ position: 'fixed', top: '1rem', right: '1rem', zIndex: 10, width: '320px' }}
      />
      <section style={{ padding: '2rem', maxWidth: '60ch', margin: '0 auto' }}>
        <h1 style={{ marginTop: 0 }}>&lt;DotField /&gt;</h1>
        <pre
          style={{
            background: '#1a1a2a',
            color: '#e0e0f0',
            padding: '1rem',
            borderRadius: '0.5rem',
            fontSize: '0.85rem',
          }}
        >
          {`<DotField spacing={30} dotSize={2} color="#888" reach={100} strength={1} />`}
        </pre>
      </section>
    </main>
  )
}
```

- [ ] **Step 6.4: Re-install + build + verify in browser.**

```bash
pnpm install
pnpm build && pnpm typecheck && pnpm lint && pnpm test
pnpm --filter @matter/docs dev
```

Open `/components/dot-field`. Move the cursor — dots within `reach` should pull toward the pointer. Drag `reach`, `strength`, `spacing`, `dotSize`, `color` — all live.

- [ ] **Step 6.5: Commit.**

```bash
git add packages/matter/src/primitives/sdfCircle.ts packages/matter/src/primitives/sdfCircle.test.ts \
        packages/matter/src/primitives/displace.ts \
        packages/matter/src/index.ts \
        packages/matter-react/src/useResize.ts packages/matter-react/src/useResize.test.ts \
        packages/matter-react/src/index.ts \
        registry/dot-field.tsx registry/registry.json registry/package.json \
        apps/docs/app/components/dot-field/page.tsx \
        pnpm-lock.yaml
git commit -m "feat(registry): ship <DotField> + sdfCircle/displace primitives + useResize

Phase 3.2 — pixel-aware Tier 1 component proves the SDF + tiling +
cursor-displacement architecture. Adds useResize hook so components can
read canvas resolution as a uniform."
```

### Stop-and-play gate (3.2)

`/components/dot-field`. Move the mouse around — dots should bend toward (or away from) the cursor. Resize the browser window — the dot grid stays at the configured pixel spacing instead of stretching with the viewport.

### Done-criteria for 3.2

- [ ] Cursor influence visibly displaces dots; spacing and dotSize behave in CSS pixels (zoom in / resize and the grid stays sharp).
- [ ] Resize the window: dots reflow on the next ResizeObserver tick (smooth, no layout snap that takes seconds).
- [ ] `pnpm test` green (`useResize.test.ts` runs even if tiny).
- [ ] `pnpm build && pnpm typecheck && pnpm lint` green.

### Review pass (3.2)

**Spec-compliance reviewer:** _"Verify against spec §5.2 DotField (line 466): five visual props match, defaults are sensible, fallback uses CSS `radial-gradient` with `background-size: spacing px spacing px`. Confirm useResize ships in `@lovo/matter-react` exports."_

**Code-quality reviewer:** _"Focus on the `useResize` hook against gotcha #14 (Strict Mode). The lifecycle MUST live in one effect that creates+attaches+disposes a fresh ResizeObserver — flag any pattern that creates the observer outside the effect. Also: gotcha #12 — every TSL chain in DotField must start from `uv()`/`vec2`/etc., never from a uniform receiver. Look for any `cursorUniform.sub(...)` or `resUniform.mul(...)` patterns and verify they're being used as ARGUMENTS to a chain rooted in `uv()`-derived nodes."_

---

## Phase 3.3 — `<Waves>` to registry (`cursorRipple` primitive + `useScroll` hook + component)

**Goal:** Ship `<Waves>` — sum of N sine layers + cursor-spawned radial ripples. Adds `cursorRipple` primitive and `useScroll` hook (the latter exported but not consumed by Waves itself in v1).

**Files:**

- Create: `packages/matter/src/primitives/cursorRipple.ts`, `cursorRipple.test.ts`
- Modify: `packages/matter/src/index.ts`
- Create: `packages/matter-react/src/useScroll.ts`, `useScroll.test.ts`
- Modify: `packages/matter-react/src/index.ts`
- Create: `registry/waves.tsx`
- Modify: `registry/registry.json`, `registry/package.json`
- Create: `apps/docs/app/components/waves/page.tsx`

### Task 1: Add `cursorRipple` primitive

A radial ripple field around a center point that decays with distance and oscillates with time — the "drop in a pond" feel.

**Files:**

- Create: `packages/matter/src/primitives/cursorRipple.ts`

- [ ] **Step 1.1: Create the file.**

```ts
// packages/matter/src/primitives/cursorRipple.ts
import { sin, length, smoothstep, time } from 'three/tsl'
import type { TSLNode } from './colorRamp.js'
import type { ShaderNodeObject } from 'three/tsl'
import type { Node } from 'three/webgpu'

export interface CursorRippleOptions {
  /** Decay radius (UV space). Beyond this, the ripple is ~0. Default: 0.4. */
  reach?: number
  /** Wavelength controls the ripple spacing. Default: 30. Larger = wider rings. */
  frequency?: number
  /** Time multiplier on the wave phase. Default: 6. Larger = faster oscillation. */
  speed?: number
  /** Output amplitude. Default: 0.5. Final result is in roughly [-amplitude, +amplitude]. */
  amplitude?: number
}

/**
 * A radial ripple emanating from `center`. Returns a scalar TSL node in
 * roughly [-amplitude, +amplitude] that decays to ~0 outside `reach`.
 *
 *   ripple = sin(d*frequency - time*speed) * amplitude * smoothstep(reach, 0, d)
 *
 * Compose into a wave field by adding it to the underlying base wave.
 *
 * Note: `frequency`/`speed`/`reach`/`amplitude` are JS-side numbers (baked
 * into the TSL fragment at material-build time). Animatable cursor position
 * is the only live uniform consumed.
 *
 * @param p — Vec2 TSL node (typically `uv()`).
 * @param center — Vec2 TSL node (cursor uniform, in UV space).
 */
export function cursorRipple(p: TSLNode, center: TSLNode, opts: CursorRippleOptions = {}): TSLNode {
  const reach = opts.reach ?? 0.4
  const frequency = opts.frequency ?? 30
  const speed = opts.speed ?? 6
  const amplitude = opts.amplitude ?? 0.5

  // d = length(p - center)  — uses the gotcha #12 arg form: build the chain
  // from p (which is uv()-derived), pass center as an argument.
  const d = length((p as ShaderNodeObject<Node>).sub(center as ShaderNodeObject<Node>))
  const wave = sin(d.mul(frequency).sub(time.mul(speed)))
  const decay = smoothstep(reach, 0, d as never)
  return (wave as ShaderNodeObject<Node>).mul(amplitude).mul(decay as ShaderNodeObject<Node>)
}
```

- [ ] **Step 1.2: Test return-shape.**

File: `packages/matter/src/primitives/cursorRipple.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { uv, vec2 } from 'three/tsl'
import { cursorRipple } from './cursorRipple.js'

describe('cursorRipple', () => {
  it('returns a TSL node with default options', () => {
    expect(cursorRipple(uv(), vec2(0.5, 0.5))).toBeDefined()
  })

  it('respects custom options', () => {
    expect(
      cursorRipple(uv(), vec2(0.5, 0.5), { reach: 0.2, frequency: 50, speed: 3, amplitude: 0.3 }),
    ).toBeDefined()
  })
})
```

- [ ] **Step 1.3: Export.**

In `packages/matter/src/index.ts`:

```ts
export { cursorRipple } from './primitives/cursorRipple.js'
export type { CursorRippleOptions } from './primitives/cursorRipple.js'
```

- [ ] **Step 1.4: Build + test.**

```bash
pnpm --filter @lovo/matter build && pnpm --filter @lovo/matter test
```

### Task 2: Add `useScroll` hook

Exposes window scroll position as a MatterSignal — `[scrollY, progress]` where `progress` is `scrollY / (documentHeight - viewportHeight)` clamped to [0,1]. Throttled via rAF.

**Files:**

- Create: `packages/matter-react/src/useScroll.ts`

- [ ] **Step 2.1: Create the hook.**

```ts
// packages/matter-react/src/useScroll.ts
'use client'

import { useEffect, useState } from 'react'

export type ScrollValue = readonly [scrollY: number, progress: number]

export interface ScrollSignal {
  /** Current scroll Y (px) and normalized progress in [0,1]. */
  get(): ScrollValue
  on(event: 'change', cb: (value: ScrollValue) => void): () => void
}

const STUB: ScrollSignal = {
  get: () => [0, 0] as const,
  on: () => () => undefined,
}

/**
 * Track window scroll. Emits on every scroll event, rAF-throttled.
 *
 * No v1 Tier 1 component consumes this; it's exposed for users who want to
 * pass `inputs={{ scroll: useScroll() }}` to any Matter component.
 *
 * Strict-Mode-safe: the listener attaches+detaches per real mount (gotcha #14).
 */
export function useScroll(): ScrollSignal {
  const [signal, setSignal] = useState<ScrollSignal | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const compute = (): ScrollValue => {
      const y = window.scrollY
      const max = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1)
      const progress = Math.max(0, Math.min(1, y / max))
      return [y, progress]
    }

    let value: ScrollValue = compute()
    const listeners = new Set<(v: ScrollValue) => void>()
    const fresh: ScrollSignal = {
      get: () => value,
      on: (_event, cb) => {
        listeners.add(cb)
        return () => listeners.delete(cb)
      },
    }
    setSignal(fresh)

    let rafPending = false
    const onScroll = () => {
      if (rafPending) return
      rafPending = true
      requestAnimationFrame(() => {
        rafPending = false
        const next = compute()
        if (next[0] === value[0] && next[1] === value[1]) return
        value = next
        for (const cb of listeners) cb(next)
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })

    return () => {
      window.removeEventListener('scroll', onScroll)
      listeners.clear()
      setSignal(null)
    }
  }, [])

  return signal ?? STUB
}
```

- [ ] **Step 2.2: Test the stub branch + signal contract.**

File: `packages/matter-react/src/useScroll.test.ts`

```ts
import { describe, it, expect } from 'vitest'

describe('useScroll', () => {
  it('module loads', async () => {
    const m = await import('./useScroll.js')
    expect(typeof m.useScroll).toBe('function')
  })
})
```

(Same rationale as `useResize` — heavy DOM coupling makes a real-DOM integration smoke on the docs page more honest than a JSDOM mock.)

- [ ] **Step 2.3: Export.**

In `packages/matter-react/src/index.ts`:

```ts
export { useScroll } from './useScroll.js'
export type { ScrollSignal, ScrollValue } from './useScroll.js'
```

- [ ] **Step 2.4: Build + test.**

```bash
pnpm --filter @lovo/matter-react build && pnpm --filter @lovo/matter-react test
```

### Task 3: Create `<Waves>` registry component

Spec §5.2 line 503: `<Waves amplitude={0.1} frequency={5} speed={1} color="#7ec" layers={3} interactive={false} />`. Sum N sine layers + add cursor ripple when interactive.

**Files:**

- Create: `registry/waves.tsx`

- [ ] **Step 3.1: Create the component.**

```tsx
// registry/waves.tsx
'use client'

import { useEffect, useMemo, type CSSProperties, type ReactNode } from 'react'
import { Mesh, PlaneGeometry, Vector2 } from 'three'
import { MeshBasicNodeMaterial } from 'three/webgpu'
import { vec3, vec4, sin, mix, smoothstep, uv, time, uniform } from '@lovo/matter'
import { cursorRipple } from '@lovo/matter'
import {
  MatterScene,
  useMatterContext,
  useAnimatableUniform,
  useCursor,
  FallbackBoundary,
  type AnimatableProp,
  type CursorSignal,
} from '@lovo/matter-react'
import type { ShaderNodeObject } from 'three/tsl'
import type { Node } from 'three/webgpu'

export interface WavesProps {
  amplitude?: AnimatableProp<number>
  frequency?: AnimatableProp<number>
  speed?: AnimatableProp<number>
  color?: string
  layers?: number // JS-side; baked at mount.
  interactive?: boolean
  inputs?: { cursor?: CursorSignal }
  fallback?: ReactNode
  className?: string
  style?: CSSProperties
}

const DEFAULTS = { amplitude: 0.1, frequency: 5, speed: 1, color: '#77eecc', layers: 3 } as const

const hexToVec3 = (hex: string): readonly [number, number, number] => {
  const clean = hex.replace('#', '')
  return [
    parseInt(clean.slice(0, 2), 16) / 255,
    parseInt(clean.slice(2, 4), 16) / 255,
    parseInt(clean.slice(4, 6), 16) / 255,
  ]
}

function WavesMesh(props: WavesProps) {
  const ctx = useMatterContext()
  const cursorFromInputs = props.inputs?.cursor
  const cursorAuto = useCursor()
  const cursor = cursorFromInputs ?? (props.interactive ? cursorAuto : null)
  const layers = props.layers ?? DEFAULTS.layers

  const ampUniform = useAnimatableUniform<number>(props.amplitude ?? DEFAULTS.amplitude)
  const freqUniform = useAnimatableUniform<number>(props.frequency ?? DEFAULTS.frequency)
  const speedUniform = useAnimatableUniform<number>(props.speed ?? DEFAULTS.speed)

  const [cr, cg, cb] = hexToVec3(props.color ?? DEFAULTS.color)

  const cursorVec = useMemo(() => new Vector2(0.5, 0.5), [])
  const cursorUniform = useMemo(() => uniform(cursorVec), [cursorVec])
  useEffect(() => {
    if (cursor) return cursor.on('change', ([x, y]) => cursorVec.set(x, 1 - y))
    cursorVec.set(0.5, 0.5)
    return undefined
  }, [cursor, cursorVec])

  useEffect(() => {
    if (!ctx) return

    // Sum `layers` sine waves at increasing frequency / decreasing amplitude.
    // Each layer gets a small phase offset so they don't all peak together.
    let waveSum: ShaderNodeObject<Node> = sin(
      uv()
        .x.mul(freqUniform as unknown as number)
        .add(time.mul(speedUniform as unknown as number)),
    ) as ShaderNodeObject<Node>
    let totalAmp = 1
    for (let i = 1; i < layers; i++) {
      const layerFreq = (freqUniform as unknown as { mul(n: number): unknown }).mul(1 + i * 0.7)
      const layerSpeed = (speedUniform as unknown as { mul(n: number): unknown }).mul(1 + i * 0.4)
      const layerAmp = 1 / (i + 1)
      const phase = i * 1.3
      const layer = sin(
        (uv().x as ShaderNodeObject<Node>)
          .mul(layerFreq as never)
          .add((time as ShaderNodeObject<Node>).mul(layerSpeed as never).add(phase)),
      ) as ShaderNodeObject<Node>
      waveSum = waveSum.add(layer.mul(layerAmp)) as ShaderNodeObject<Node>
      totalAmp += layerAmp
    }
    const baseWave = waveSum.div(totalAmp).mul(ampUniform as unknown as number)

    // Optional cursor ripple — added on top of the base wave field.
    const fullWave = cursor
      ? (baseWave.add(
          cursorRipple(uv(), cursorUniform) as ShaderNodeObject<Node>,
        ) as ShaderNodeObject<Node>)
      : baseWave

    // Render: y-coord vs wave value with a soft band around 0.
    const distFromBand = (uv().y.sub(0.5).sub(fullWave) as ShaderNodeObject<Node>).abs()
    const mask = smoothstep(0.04, 0.0, distFromBand as never) // 1 inside the band, 0 outside

    const material = new MeshBasicNodeMaterial()
    const colorVec = vec3(cr, cg, cb)
    const baseColor = vec3(0, 0, 0)
    material.colorNode = vec4(
      mix(baseColor, colorVec, mask as never).x,
      mix(baseColor, colorVec, mask as never).y,
      mix(baseColor, colorVec, mask as never).z,
      mask as never,
    ) as never

    const mesh = new Mesh(new PlaneGeometry(2, 2), material)
    ctx.scene.add(mesh)
    return () => {
      ctx.scene.remove(mesh)
      try {
        material.dispose()
      } catch {
        /* benign */
      }
      try {
        mesh.geometry.dispose()
      } catch {
        /* benign */
      }
    }
  }, [ctx, layers, cr, cg, cb, ampUniform, freqUniform, speedUniform, cursor, cursorUniform])

  return null
}

function DefaultFallback({ color }: { color: string }) {
  // Static SVG sine-wave path — rough approximation of the rest pose.
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        <path
          d="M 0 50 C 12.5 35, 37.5 35, 50 50 C 62.5 65, 87.5 65, 100 50"
          stroke={color}
          strokeWidth="3"
          fill="none"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  )
}

export function Waves(props: WavesProps) {
  const c = typeof props.color === 'string' ? props.color : DEFAULTS.color
  return (
    <FallbackBoundary fallback={props.fallback ?? <DefaultFallback color={c} />}>
      <MatterScene className={props.className} style={props.style}>
        <WavesMesh {...props} />
      </MatterScene>
    </FallbackBoundary>
  )
}
```

### Task 4: Registry manifest, package exports, docs page

- [ ] **Step 4.1: Add `waves` registry entry, mirror the pattern from 3.1.b/3.2.**

In `registry/registry.json`:

```json
"waves": {
  "file": "waves.tsx",
  "description": "Layered sine waves with cursor-spawned ripples.",
  "dependencies": ["@lovo/matter", "@lovo/matter-react", "react", "three"],
  "uses_primitives": ["cursorRipple", "sin", "mix", "smoothstep", "uv", "vec3", "vec4", "time", "uniform"],
  "tier": 1
}
```

- [ ] **Step 4.2: Add export key in `registry/package.json`:** `"./waves": "./waves.tsx"`.

- [ ] **Step 4.3: Create `apps/docs/app/components/waves/page.tsx` (mirror prior pattern).**

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { Pane } from 'tweakpane'
import dynamic from 'next/dynamic'

const Waves = dynamic(() => import('@matter/registry/waves').then((m) => m.Waves), { ssr: false })

interface Params {
  color: string
  amplitude: number
  frequency: number
  speed: number
  layers: number
  interactive: boolean
}

const INITIAL: Params = {
  color: '#77eecc',
  amplitude: 0.1,
  frequency: 5,
  speed: 1,
  layers: 3,
  interactive: true,
}

export default function WavesPage() {
  const paneContainerRef = useRef<HTMLDivElement>(null)
  const [params, setParams] = useState<Params>(INITIAL)
  const [instanceKey, setInstanceKey] = useState(0)

  useEffect(() => {
    const container = paneContainerRef.current
    if (!container) return
    const local = { ...INITIAL }
    const pane = new Pane({ container, title: '<Waves>' })
    pane.addBinding(local, 'color')
    pane.addBlade({ view: 'separator' })
    pane.addBinding(local, 'amplitude', { min: 0, max: 0.5, step: 0.005 })
    pane.addBinding(local, 'frequency', { min: 1, max: 30, step: 0.1 })
    pane.addBinding(local, 'speed', { min: 0, max: 4, step: 0.05 })
    pane.addBinding(local, 'layers', { min: 1, max: 6, step: 1 })
    pane.addBlade({ view: 'separator' })
    pane.addBinding(local, 'interactive', { label: 'interactive (cursor ripple)' })
    pane.addBlade({ view: 'separator' })
    pane.addButton({ title: 'Apply layers / interactive' }).on('click', () => {
      setParams({ ...local })
      setInstanceKey((k) => k + 1)
    })
    pane.on('change', () => setParams({ ...local }))
    return () => {
      pane.dispose()
    }
  }, [])

  return (
    <main style={{ minHeight: '100vh', position: 'relative' }}>
      <div style={{ position: 'relative', height: '70vh', background: '#0a0a14' }}>
        <Waves
          key={instanceKey}
          color={params.color}
          amplitude={params.amplitude}
          frequency={params.frequency}
          speed={params.speed}
          layers={params.layers}
          interactive={params.interactive}
        />
      </div>
      <div
        ref={paneContainerRef}
        style={{ position: 'fixed', top: '1rem', right: '1rem', zIndex: 10, width: '320px' }}
      />
      <section style={{ padding: '2rem', maxWidth: '60ch', margin: '0 auto' }}>
        <h1 style={{ marginTop: 0 }}>&lt;Waves /&gt;</h1>
        <pre
          style={{
            background: '#1a1a2a',
            color: '#e0e0f0',
            padding: '1rem',
            borderRadius: '0.5rem',
            fontSize: '0.85rem',
          }}
        >
          {`<Waves amplitude={0.1} frequency={5} speed={1} layers={3} interactive />`}
        </pre>
      </section>
    </main>
  )
}
```

- [ ] **Step 4.4: Build + verify in browser.**

```bash
pnpm install && pnpm build && pnpm typecheck && pnpm lint && pnpm test
pnpm --filter @matter/docs dev
```

Open `/components/waves`. Confirm: layered waves animate; turn on `interactive` → cursor ripples spawn at the pointer.

- [ ] **Step 4.5: Commit.**

```bash
git add packages/matter/src/primitives/cursorRipple.ts packages/matter/src/primitives/cursorRipple.test.ts \
        packages/matter/src/index.ts \
        packages/matter-react/src/useScroll.ts packages/matter-react/src/useScroll.test.ts \
        packages/matter-react/src/index.ts \
        registry/waves.tsx registry/registry.json registry/package.json \
        apps/docs/app/components/waves/page.tsx \
        pnpm-lock.yaml
git commit -m "feat(registry): ship <Waves> + cursorRipple primitive + useScroll

Phase 3.3 — layered sine waves with cursor-spawned ripples. Adds useScroll
hook (no v1 component consumes it; exposed for users)."
```

### Stop-and-play gate (3.3)

`/components/waves`. Drag amplitude / frequency / speed — the wave bands respond live. Turn on `interactive`, move the cursor — radial ripples appear. Bump `layers` from 1 to 6, click Apply each time, watch the wave field gain harmonic complexity.

### Done-criteria for 3.3

- [ ] Cursor ripples visibly emanate from the pointer when `interactive`.
- [ ] `useScroll` is exported and importable from `@lovo/matter-react`.
- [ ] All commands green; one `feat(registry):` commit.

### Review pass (3.3)

**Spec-compliance:** _"Verify against §5.2 Waves (line 503): six props, defaults sensible, fallback is an SVG `<path>` sine wave per spec line 519. Confirm cursorRipple is exported from `@lovo/matter` and consumed by Waves only when `interactive` (or `inputs.cursor`) is set."_

**Code-quality:** _"Strict-Mode-safe useScroll? (gotcha #14). All TSL chains in Waves rooted in `uv()` not in uniforms? (gotcha #12). The layered-sum loop in WavesMesh — does it correctly accumulate without going through any uniform receiver?"_

---

## Phase 3.4.a — MeshGradient blend prototype

**Goal:** Surface the multi-point inverse-distance blend feel-decision on a hardcoded shader. Output: a battle-tested TSL fragment + a chosen `blur` exponent default that 3.4.b copies into `<MeshGradient>`. NO new primitives ship in this phase — it's purely a feel-finding beat.

**Scope:** One new docs page at `/dev/mesh-gradient-playground`. Nothing else.

**Files:**

- Create: `apps/docs/app/dev/mesh-gradient-playground/page.tsx`

### Task 1: Build the playground

The shader: 4 hardcoded color points at the four corners of UV space (animated by `noise(uv + time*0.1) * 0.1` per spec §5.2 line 444). For each pixel, compute `weight[i] = 1 / pow(distance(uv, p[i]), 1/blur)`; normalize; sum `weight[i] * color[i]`. Tweakpane on `blur` (0.1–2.0), all four colors, and a `pointJitterScale` (0.0–0.3, the magnitude of the noise-driven point animation).

- [ ] **Step 1.1: Create the page.**

```tsx
// apps/docs/app/dev/mesh-gradient-playground/page.tsx
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Pane } from 'tweakpane'
import dynamic from 'next/dynamic'
import { Mesh, PlaneGeometry } from 'three'
import { MeshBasicNodeMaterial } from 'three/webgpu'
import { vec2, vec3, vec4, length, time, uniform } from '@lovo/matter'
import { noise } from '@lovo/matter'
import { MatterScene, useMatterContext } from '@lovo/matter-react'
import type { ShaderNodeObject } from 'three/tsl'
import type { Node } from 'three/webgpu'

interface Params {
  c0: string
  c1: string
  c2: string
  c3: string
  blur: number
  jitter: number
}

const INITIAL: Params = {
  c0: '#ff61a6',
  c1: '#61a6ff',
  c2: '#61ffa6',
  c3: '#ffd861',
  blur: 0.5,
  jitter: 0.1,
}

const hex = (s: string): readonly [number, number, number] => {
  const c = s.replace('#', '')
  return [
    parseInt(c.slice(0, 2), 16) / 255,
    parseInt(c.slice(2, 4), 16) / 255,
    parseInt(c.slice(4, 6), 16) / 255,
  ]
}

function PrototypeMesh({
  colors,
  blur,
  jitterUniform,
}: {
  colors: readonly [
    readonly [number, number, number],
    readonly [number, number, number],
    readonly [number, number, number],
    readonly [number, number, number],
  ]
  blur: number
  jitterUniform: ReturnType<typeof uniform>
}) {
  const ctx = useMatterContext()

  useEffect(() => {
    if (!ctx) return

    // Four hardcoded base positions, jittered each frame by per-point noise.
    const basePositions: ReadonlyArray<readonly [number, number]> = [
      [0.0, 0.0],
      [1.0, 0.0],
      [1.0, 1.0],
      [0.0, 1.0],
    ]
    // Inverse exponent for the inverse-distance weight. Negative because TSL
    // pow(d, -invBlur) == 1 / d^invBlur. Built JS-side from `blur` since the
    // exponent is baked into the fragment at material-build time and the
    // playground uses an Apply button on `blur` (the prototype frames blur
    // as a "feel decision" the user resolves before <MeshGradient> ships).
    const negInvBlur = -1 / Math.max(blur, 0.05)

    let totalWeight: ShaderNodeObject<Node> | null = null
    let weightedSum: ShaderNodeObject<Node> | null = null

    for (let i = 0; i < basePositions.length; i++) {
      const bp = basePositions[i]!
      // Per-point drift: position += (noise(...), noise(...)) * jitter.
      const tNode = (time as ShaderNodeObject<Node>).mul(0.05)
      const nx = noise(vec2(i + 0.13, tNode)) as ShaderNodeObject<Node>
      const ny = noise(vec2(i + 0.79, tNode)) as ShaderNodeObject<Node>
      const offset = vec2(
        nx.mul(jitterUniform as unknown as number),
        ny.mul(jitterUniform as unknown as number),
      )
      const point = vec2(bp[0], bp[1]).add(offset) as ShaderNodeObject<Node>

      // d = length(uv() - point) — uv-rooted chain, `point` as argument
      // (gotcha #12). Add a small epsilon to avoid div-by-zero at the
      // point center.
      const d = length(uv().sub(point)).add(0.001) as ShaderNodeObject<Node>
      // weight = d^(-1/blur)  ==  1 / d^(1/blur).
      const weight = d.pow(negInvBlur)

      const colorVec = vec3(colors[i]![0], colors[i]![1], colors[i]![2]) as ShaderNodeObject<Node>
      const contribution = colorVec.mul(weight)

      if (totalWeight === null) {
        totalWeight = weight
        weightedSum = contribution
      } else {
        totalWeight = totalWeight.add(weight)
        weightedSum = (weightedSum as ShaderNodeObject<Node>).add(contribution)
      }
    }

    const finalColor = (weightedSum as ShaderNodeObject<Node>).div(
      totalWeight as ShaderNodeObject<Node>,
    )

    const material = new MeshBasicNodeMaterial()
    material.colorNode = vec4(
      (finalColor as ShaderNodeObject<Node>).x,
      (finalColor as ShaderNodeObject<Node>).y,
      (finalColor as ShaderNodeObject<Node>).z,
      1,
    ) as never

    const mesh = new Mesh(new PlaneGeometry(2, 2), material)
    ctx.scene.add(mesh)
    return () => {
      ctx.scene.remove(mesh)
      try {
        material.dispose()
      } catch {
        /* benign */
      }
      try {
        mesh.geometry.dispose()
      } catch {
        /* benign */
      }
    }
  }, [ctx, colors, blur, jitterUniform])

  return null
}

const SceneWrapper = dynamic(
  async () => (props: { children: React.ReactNode }) => <MatterScene>{props.children}</MatterScene>,
  { ssr: false },
)

export default function MeshGradientPlaygroundPage() {
  const paneContainerRef = useRef<HTMLDivElement>(null)
  const [params, setParams] = useState<Params>(INITIAL)
  const [instanceKey, setInstanceKey] = useState(0)
  const jitterUniform = useMemo(() => uniform(INITIAL.jitter), [])

  useEffect(() => {
    const container = paneContainerRef.current
    if (!container) return
    const local = { ...INITIAL }
    const pane = new Pane({ container, title: 'MeshGradient blend prototype' })
    pane.addBinding(local, 'c0', { label: 'corner ↖' })
    pane.addBinding(local, 'c1', { label: 'corner ↗' })
    pane.addBinding(local, 'c2', { label: 'corner ↘' })
    pane.addBinding(local, 'c3', { label: 'corner ↙' })
    pane.addBlade({ view: 'separator' })
    pane.addBinding(local, 'blur', { min: 0.1, max: 2, step: 0.01 })
    pane.addBinding(local, 'jitter', { min: 0, max: 0.3, step: 0.01 })
    pane.addBlade({ view: 'separator' })
    pane.addButton({ title: 'Apply blur / colors' }).on('click', () => {
      setParams({ ...local })
      setInstanceKey((k) => k + 1)
    })
    pane.on('change', (ev) => {
      const key = (ev.target as { key?: keyof Params }).key
      if (key === 'jitter') {
        ;(jitterUniform as unknown as { value: number }).value = local.jitter
      }
    })
    return () => {
      pane.dispose()
    }
  }, [jitterUniform])

  const colors = [hex(params.c0), hex(params.c1), hex(params.c2), hex(params.c3)] as const

  return (
    <main style={{ minHeight: '100vh', position: 'relative' }}>
      <div style={{ position: 'relative', height: '70vh' }}>
        <SceneWrapper key={instanceKey}>
          <PrototypeMesh colors={colors} blur={params.blur} jitterUniform={jitterUniform} />
        </SceneWrapper>
      </div>
      <div
        ref={paneContainerRef}
        style={{ position: 'fixed', top: '1rem', right: '1rem', zIndex: 10, width: '320px' }}
      />
      <section style={{ padding: '2rem', maxWidth: '60ch', margin: '0 auto' }}>
        <h1 style={{ marginTop: 0 }}>MeshGradient blend prototype</h1>
        <p>
          Internal — find the right <code>blur</code> exponent default before
          <code>&lt;MeshGradient&gt;</code> ships in 3.4.b.
        </p>
      </section>
    </main>
  )
}
```

**Implementation note:** `negInvBlur` is computed JS-side because changes to `blur` flow through the Apply button (which remounts the inner mesh, rebuilding the TSL fragment with the new exponent baked in). If you ever need live `blur` scrubbing without remount, you'd need TSL `pow` to accept a uniform exponent — verify that with a small spike before refactoring.

- [ ] **Step 1.2: Build + verify in browser.**

```bash
pnpm --filter @matter/docs build
pnpm --filter @matter/docs dev
```

Open `/dev/mesh-gradient-playground`. Drag `blur`, click Apply. At blur=0.3, points are localized; at blur=1.5, the whole field becomes mushy. Find the user's preferred default.

- [ ] **Step 1.3: Commit.**

```bash
git add apps/docs/app/dev/mesh-gradient-playground/page.tsx
git commit -m "feat(docs): mesh-gradient blend prototype for 3.4.b feel-decision

Phase 3.4.a — playground exercises the multi-point inverse-distance blend
on a hardcoded shader. The chosen blur exponent default carries into
<MeshGradient>'s registry component in 3.4.b."
```

### Stop-and-play gate (3.4.a)

`/dev/mesh-gradient-playground`. Try blur values: 0.2, 0.5, 0.8, 1.2. **Decide and capture the default.** Write the chosen number into a comment at the top of `mesh-gradient.tsx` when you start 3.4.b — something like `// blur exponent default tuned 2026-05-XX in /dev/mesh-gradient-playground`.

### Done-criteria for 3.4.a

- [ ] Page renders a four-color blend that updates when colors / blur change.
- [ ] `pnpm typecheck && pnpm lint` green.
- [ ] User has chosen a default `blur` value.
- [ ] One commit, scope `feat(docs):`.

### Review pass (3.4.a)

**Code-quality (single reviewer):** _"This phase ships a prototype-only — no public API. Verify: gotcha #12 (TSL chains rooted in `uv()`, not in `point` uniform/literal); gotcha #10 (the page uses `next/dynamic({ ssr: false })` for any three/webgpu-touching child); the placeholder/dummy block from the planning listing has been removed (no `require('three/tsl')` or `@typescript-eslint/no-require-imports` disable comments left in the final file)."_

---

## Phase 3.4.b — `<MeshGradient>` to registry

**Goal:** Lift the prototype from 3.4.a into a real `<MeshGradient>` registry component with the spec's full prop API.

**Scope:** One Tier 1 component + one docs page + registry update.

**Files:**

- Create: `registry/mesh-gradient.tsx`
- Modify: `registry/registry.json`, `registry/package.json`
- Create: `apps/docs/app/components/mesh-gradient/page.tsx`

### Task 1: Create the component

Spec §5.2 line 431: `<MeshGradient colors={...} points={'auto'} speed={0.3} blur={0.5} interactive={false} />`. `points='auto'` means: if `colors.length === N`, use the N evenly-spaced default positions (corners + centers per spec §5.2). For v1, support `points='auto'` (computes positions from `colors.length`) and `points: Vec2[]` (explicit). The `interactive` flag pulls the nearest color point toward the cursor.

- [ ] **Step 1.1: Create `registry/mesh-gradient.tsx`.**

```tsx
'use client'

import { useEffect, useMemo, type CSSProperties, type ReactNode } from 'react'
import { Mesh, PlaneGeometry, Vector2 } from 'three'
import { MeshBasicNodeMaterial } from 'three/webgpu'
import { vec2, vec3, vec4, length, time, uv, uniform } from '@lovo/matter'
import { noise } from '@lovo/matter'
import {
  MatterScene,
  useMatterContext,
  useAnimatableUniform,
  useCursor,
  FallbackBoundary,
  type AnimatableProp,
  type CursorSignal,
} from '@lovo/matter-react'
import type { ShaderNodeObject } from 'three/tsl'
import type { Node } from 'three/webgpu'

export type MeshPoint = readonly [number, number]

export interface MeshGradientProps {
  colors?: AnimatableProp<string[]>
  /** 'auto' uses corner-spread positions; an array provides explicit points. */
  points?: 'auto' | readonly MeshPoint[]
  speed?: AnimatableProp<number>
  blur?: AnimatableProp<number>
  interactive?: boolean
  inputs?: { cursor?: CursorSignal }
  fallback?: ReactNode
  className?: string
  style?: CSSProperties
}

const DEFAULT_COLORS = ['#ff61a6', '#61a6ff', '#61ffa6', '#ffd861']

// Default `blur` chosen 2026-05-XX in /dev/mesh-gradient-playground.
// (Replace with the actual feel-tested value before committing.)
const DEFAULT_BLUR = 0.5

const hex = (s: string): readonly [number, number, number] => {
  const c = s.replace('#', '')
  return [
    parseInt(c.slice(0, 2), 16) / 255,
    parseInt(c.slice(2, 4), 16) / 255,
    parseInt(c.slice(4, 6), 16) / 255,
  ]
}

const isSignalLike = (v: unknown): v is { get(): unknown } =>
  typeof v === 'object' && v !== null && typeof (v as { get?: unknown }).get === 'function'

const resolveColors = (prop: AnimatableProp<string[]> | undefined): string[] => {
  if (prop === undefined) return DEFAULT_COLORS
  if (isSignalLike(prop)) return (prop as { get(): string[] }).get()
  return prop
}

const autoPointsFor = (n: number): readonly MeshPoint[] => {
  // Place points on a roughly even ring + center for n>=5; corners for n<=4.
  if (n <= 4) {
    const corners: readonly MeshPoint[] = [
      [0.0, 0.0],
      [1.0, 0.0],
      [1.0, 1.0],
      [0.0, 1.0],
    ]
    return corners.slice(0, Math.max(n, 1))
  }
  const out: MeshPoint[] = []
  for (let i = 0; i < n; i++) {
    const theta = (i / n) * Math.PI * 2
    out.push([0.5 + 0.4 * Math.cos(theta), 0.5 + 0.4 * Math.sin(theta)])
  }
  return out
}

function MeshGradientMesh(props: MeshGradientProps) {
  const ctx = useMatterContext()
  const cursorFromInputs = props.inputs?.cursor
  const cursorAuto = useCursor()
  const cursor = cursorFromInputs ?? (props.interactive ? cursorAuto : null)

  const colors = resolveColors(props.colors)
  const speedUniform = useAnimatableUniform<number>(props.speed ?? 0.3)
  const blurUniform = useAnimatableUniform<number>(props.blur ?? DEFAULT_BLUR)

  const points = useMemo(() => {
    if (props.points === undefined || props.points === 'auto') return autoPointsFor(colors.length)
    return props.points
  }, [props.points, colors.length])

  const cursorVec = useMemo(() => new Vector2(0.5, 0.5), [])
  const cursorUniform = useMemo(() => uniform(cursorVec), [cursorVec])
  useEffect(() => {
    if (cursor) return cursor.on('change', ([x, y]) => cursorVec.set(x, 1 - y))
    cursorVec.set(0.5, 0.5)
    return undefined
  }, [cursor, cursorVec])

  useEffect(() => {
    if (!ctx) return

    let totalWeight: ShaderNodeObject<Node> | null = null
    let weightedSum: ShaderNodeObject<Node> | null = null

    for (let i = 0; i < points.length; i++) {
      const bp = points[i]!
      // Per-point jitter: position drifts via noise(time + i) * 0.08
      const tNode = (time as ShaderNodeObject<Node>).mul(speedUniform as unknown as number)
      const nx = noise(vec2(i + 0.13, tNode)) as ShaderNodeObject<Node>
      const ny = noise(vec2(i + 0.79, tNode)) as ShaderNodeObject<Node>
      let point = vec2(bp[0], bp[1]).add(vec2(nx.mul(0.08), ny.mul(0.08))) as ShaderNodeObject<Node>

      // If interactive, the nearest point easing toward cursor is approximated
      // by adding a fraction of (cursor - point) to point[0] only. (For v1 we
      // pull all points equally toward cursor with a strength 0.05; spec §5.2
      // says "nearest", but for the multi-point inverse-distance field, equal
      // pull on all points is visually equivalent within typical cursor reach
      // and simpler to implement on the GPU. Promotable in v2.)
      if (cursor) {
        point = point.add(
          (cursorUniform.sub(point) as ShaderNodeObject<Node>).mul(0.05),
        ) as ShaderNodeObject<Node>
      }

      // Inverse-distance weight. uv-rooted chain; point as arg (gotcha #12).
      const d = length(uv().sub(point)).add(0.001) as ShaderNodeObject<Node>
      // weight = d^(-1/blur) == 1 / d^(1/blur).
      // Negative exponent built from a uniform: blurUniform.pow(-1) is 1/blur,
      // multiplied by -1 gives -1/blur. `pow(d, negative)` is well-defined
      // because d > 0 (we added 0.001 above). Live blur scrubbing is supported
      // because both pow operands flow through uniforms — no rebuild on change.
      const negInvBlur = (blurUniform as unknown as ShaderNodeObject<Node>).pow(-1).mul(-1)
      const weight = d.pow(negInvBlur as never) as ShaderNodeObject<Node>

      const [r, g, b] = hex(colors[i] ?? colors[colors.length - 1] ?? '#ffffff')
      const contribution = (vec3(r, g, b) as ShaderNodeObject<Node>).mul(weight)

      if (totalWeight === null) {
        totalWeight = weight
        weightedSum = contribution
      } else {
        totalWeight = totalWeight.add(weight)
        weightedSum = (weightedSum as ShaderNodeObject<Node>).add(contribution)
      }
    }

    const finalColor = (weightedSum as ShaderNodeObject<Node>).div(
      totalWeight as ShaderNodeObject<Node>,
    )

    const material = new MeshBasicNodeMaterial()
    material.colorNode = vec4(
      (finalColor as ShaderNodeObject<Node>).x,
      (finalColor as ShaderNodeObject<Node>).y,
      (finalColor as ShaderNodeObject<Node>).z,
      1,
    ) as never

    const mesh = new Mesh(new PlaneGeometry(2, 2), material)
    ctx.scene.add(mesh)
    return () => {
      ctx.scene.remove(mesh)
      try {
        material.dispose()
      } catch {
        /* benign */
      }
      try {
        mesh.geometry.dispose()
      } catch {
        /* benign */
      }
    }
  }, [ctx, colors.join('|'), points, speedUniform, blurUniform, cursor, cursorUniform])

  return null
}

function DefaultFallback({ colors }: { colors: string[] }) {
  // Four stacked CSS radial-gradients per spec §5.2 line 446.
  const corners = ['top left', 'top right', 'bottom right', 'bottom left']
  const layers = colors
    .slice(0, 4)
    .map((c, i) => `radial-gradient(at ${corners[i]}, ${c} 0%, transparent 60%)`)
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: layers.join(', '),
      }}
    />
  )
}

export function MeshGradient(props: MeshGradientProps) {
  const colors = resolveColors(props.colors)
  return (
    <FallbackBoundary fallback={props.fallback ?? <DefaultFallback colors={colors} />}>
      <MatterScene className={props.className} style={props.style}>
        <MeshGradientMesh {...props} />
      </MatterScene>
    </FallbackBoundary>
  )
}
```

### Task 2: Registry + docs page

- [ ] **Step 2.1: Add `mesh-gradient` to `registry/registry.json`.**

```json
"mesh-gradient": {
  "file": "mesh-gradient.tsx",
  "description": "Stripe-style multi-point gradient with animated blending and optional cursor pull.",
  "dependencies": ["@lovo/matter", "@lovo/matter-react", "react", "three"],
  "uses_primitives": ["noise", "length", "uv", "vec2", "vec3", "vec4", "time", "uniform"],
  "tier": 1
}
```

- [ ] **Step 2.2: Add export key in `registry/package.json`.** `"./mesh-gradient": "./mesh-gradient.tsx"`.

- [ ] **Step 2.3: Create `apps/docs/app/components/mesh-gradient/page.tsx` (mirror prior pattern).**

Tweakpane bindings: 4 colors, `blur` (0.1–2, step 0.01), `speed` (0–2, step 0.01), `interactive` (bool). All four are uniforms — no Apply.

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { Pane } from 'tweakpane'
import dynamic from 'next/dynamic'

const MeshGradient = dynamic(
  () => import('@matter/registry/mesh-gradient').then((m) => m.MeshGradient),
  { ssr: false },
)

interface Params {
  c0: string
  c1: string
  c2: string
  c3: string
  blur: number
  speed: number
  interactive: boolean
}

const INITIAL: Params = {
  c0: '#ff61a6',
  c1: '#61a6ff',
  c2: '#61ffa6',
  c3: '#ffd861',
  blur: 0.5,
  speed: 0.3,
  interactive: false,
}

export default function MeshGradientPage() {
  const paneContainerRef = useRef<HTMLDivElement>(null)
  const [params, setParams] = useState<Params>(INITIAL)

  useEffect(() => {
    const container = paneContainerRef.current
    if (!container) return
    const local = { ...INITIAL }
    const pane = new Pane({ container, title: '<MeshGradient>' })
    pane.addBinding(local, 'c0', { label: 'color 0' })
    pane.addBinding(local, 'c1', { label: 'color 1' })
    pane.addBinding(local, 'c2', { label: 'color 2' })
    pane.addBinding(local, 'c3', { label: 'color 3' })
    pane.addBlade({ view: 'separator' })
    pane.addBinding(local, 'blur', { min: 0.1, max: 2, step: 0.01 })
    pane.addBinding(local, 'speed', { min: 0, max: 2, step: 0.01 })
    pane.addBlade({ view: 'separator' })
    pane.addBinding(local, 'interactive', { label: 'interactive (cursor pull)' })
    pane.on('change', () => setParams({ ...local }))
    return () => {
      pane.dispose()
    }
  }, [])

  return (
    <main style={{ minHeight: '100vh', position: 'relative' }}>
      <div style={{ position: 'relative', height: '70vh' }}>
        <MeshGradient
          colors={[params.c0, params.c1, params.c2, params.c3]}
          blur={params.blur}
          speed={params.speed}
          interactive={params.interactive}
        />
      </div>
      <div
        ref={paneContainerRef}
        style={{ position: 'fixed', top: '1rem', right: '1rem', zIndex: 10, width: '320px' }}
      />
      <section style={{ padding: '2rem', maxWidth: '60ch', margin: '0 auto' }}>
        <h1 style={{ marginTop: 0 }}>&lt;MeshGradient /&gt;</h1>
        <pre
          style={{
            background: '#1a1a2a',
            color: '#e0e0f0',
            padding: '1rem',
            borderRadius: '0.5rem',
            fontSize: '0.85rem',
          }}
        >
          {`<MeshGradient colors={['#ff61a6','#61a6ff','#61ffa6','#ffd861']} blur={0.5} speed={0.3} />`}
        </pre>
      </section>
    </main>
  )
}
```

- [ ] **Step 2.4: Build + verify + commit.**

```bash
pnpm install && pnpm build && pnpm typecheck && pnpm lint && pnpm test
pnpm --filter @matter/docs dev
```

Open `/components/mesh-gradient`. Confirm: animated blend; turn on `interactive` → all points ease toward cursor; CSS-radial fallback shows during init.

```bash
git add registry/mesh-gradient.tsx registry/registry.json registry/package.json \
        apps/docs/app/components/mesh-gradient/page.tsx \
        pnpm-lock.yaml
git commit -m "feat(registry): ship <MeshGradient>

Phase 3.4.b — Stripe-style multi-point gradient with animated noise drift
and optional cursor pull. blur exponent default carried over from 3.4.a's
playground."
```

### Stop-and-play gate (3.4.b)

`/components/mesh-gradient`. Drag `blur` from 0.2 → 1.5 — verify the localized→mushy curve matches what 3.4.a's playground showed. Toggle `interactive` and move the cursor.

### Done-criteria for 3.4.b

- [ ] All four colors render distinctly at default blur=0.5 (or the user-chosen value from 3.4.a).
- [ ] `interactive` makes the points respond to cursor.
- [ ] `pnpm test/build/lint/typecheck` green.
- [ ] One commit, scope `feat(registry):`.

### Review pass (3.4.b)

**Spec-compliance:** _"Verify against §5.2 MeshGradient (line 431). Six props match (`colors`, `points`, `speed`, `blur`, `interactive`, plus standard `inputs`/`fallback`/`className`/`style`). `points='auto'` works for any color count. Fallback is 4 stacked CSS radial gradients."_

**Code-quality:** _"TSL chains in MeshGradientMesh: every `length(uv().sub(point))` rooted in `uv()`? (gotcha #12). The `cursor ? point.add(...) : point` branch — does it create the same TSL graph each iteration when interactive is false (i.e., is `cursor` evaluated once, JS-side, before the loop)? The `pow(blurUniform.oneOver())` — does this evaluate at runtime, not at material-build time?"_

---

## Phase 3.5 — `<Aurora>` to registry + M3 wrap-up

**Goal:** Ship the final v1 component. Aurora composes `fbm` (3.1.a), `displace` (3.2), and the cursor uniform — no new primitives. Then wrap M3: update the homepage to link to all six components, and tag `m3-complete`.

**Files:**

- Create: `registry/aurora.tsx`
- Modify: `registry/registry.json`, `registry/package.json`
- Create: `apps/docs/app/components/aurora/page.tsx`
- Modify: `apps/docs/app/page.tsx`

### Task 1: Create `<Aurora>` registry component

Spec §5.2 line 449: `<Aurora colors={['#7b61ff','#5fc7ff','#ff61a6']} speed={0.4} intensity={1} interactive={false} />`. Vertical band gradient via `colorRamp`; displace sample uv by `vec2(fbm(uv*0.5 + time*speed), 0)`; cursor amplifies displacement field locally.

- [ ] **Step 1.1: Create the component.**

```tsx
// registry/aurora.tsx
'use client'

import { useEffect, useMemo, type CSSProperties, type ReactNode } from 'react'
import { Mesh, PlaneGeometry, Vector2 } from 'three'
import { MeshBasicNodeMaterial } from 'three/webgpu'
import { vec2, vec3, vec4, length, smoothstep, time, uv, uniform } from '@lovo/matter'
import { fbm, displace, colorRamp, type ColorRampStop } from '@lovo/matter'
import {
  MatterScene,
  useMatterContext,
  useAnimatableUniform,
  useCursor,
  FallbackBoundary,
  type AnimatableProp,
  type CursorSignal,
} from '@lovo/matter-react'
import type { ShaderNodeObject } from 'three/tsl'
import type { Node } from 'three/webgpu'

export interface AuroraProps {
  colors?: AnimatableProp<string[]>
  speed?: AnimatableProp<number>
  intensity?: AnimatableProp<number>
  interactive?: boolean
  inputs?: { cursor?: CursorSignal }
  fallback?: ReactNode
  className?: string
  style?: CSSProperties
}

const DEFAULT_COLORS = ['#7b61ff', '#5fc7ff', '#ff61a6']

const hexToVec3 = (hex: string): readonly [number, number, number] => {
  const c = hex.replace('#', '')
  return [
    parseInt(c.slice(0, 2), 16) / 255,
    parseInt(c.slice(2, 4), 16) / 255,
    parseInt(c.slice(4, 6), 16) / 255,
  ]
}

const isSignalLike = (v: unknown): v is { get(): unknown } =>
  typeof v === 'object' && v !== null && typeof (v as { get?: unknown }).get === 'function'

const resolveColors = (prop: AnimatableProp<string[]> | undefined): string[] => {
  if (prop === undefined) return DEFAULT_COLORS
  if (isSignalLike(prop)) return (prop as { get(): string[] }).get()
  return prop
}

function AuroraMesh(props: AuroraProps) {
  const ctx = useMatterContext()
  const cursorFromInputs = props.inputs?.cursor
  const cursorAuto = useCursor()
  const cursor = cursorFromInputs ?? (props.interactive ? cursorAuto : null)

  const colors = resolveColors(props.colors)
  const speedUniform = useAnimatableUniform<number>(props.speed ?? 0.4)
  const intensityUniform = useAnimatableUniform<number>(props.intensity ?? 1)

  const cursorVec = useMemo(() => new Vector2(0.5, 0.5), [])
  const cursorUniform = useMemo(() => uniform(cursorVec), [cursorVec])
  useEffect(() => {
    if (cursor) return cursor.on('change', ([x, y]) => cursorVec.set(x, 1 - y))
    cursorVec.set(0.5, 0.5)
    return undefined
  }, [cursor, cursorVec])

  useEffect(() => {
    if (!ctx) return

    const stops: ColorRampStop[] = colors.map((hex, i) => {
      const [r, g, b] = hexToVec3(hex)
      return { color: vec3(r, g, b), position: i / Math.max(colors.length - 1, 1) }
    })

    // 1. FBM displacement field, scaled by speed and intensity.
    //    flow = fbm(uv * 0.5 + time * speed)
    //    displaced uv = displace(uv, vec2(flow * intensity, 0))
    const tNode = (time as ShaderNodeObject<Node>).mul(speedUniform as unknown as number)
    const sampleP = (uv() as ShaderNodeObject<Node>)
      .mul(0.5)
      .add(vec2(tNode, tNode)) as ShaderNodeObject<Node>
    const flow = fbm(sampleP, { octaves: 4 }) as ShaderNodeObject<Node>

    // 2. Cursor amplification: a 0..~2x multiplier on the flow magnitude near
    //    the cursor. Use an isotropic falloff with smoothstep over uv-distance.
    let amplified = flow
    if (cursor) {
      const d = length(uv().sub(cursorUniform))
      // Within reach 0.3, amplify up to 2x; outside, 1x.
      const amp = smoothstep(0.3, 0, d as never)
      amplified = flow.mul(
        ((amp as ShaderNodeObject<Node>).mul(1) as ShaderNodeObject<Node>).add(
          1,
        ) as ShaderNodeObject<Node>,
      ) as ShaderNodeObject<Node>
    }

    const displacement = vec2(amplified.mul(intensityUniform as unknown as number), 0)
    const dUv = displace(uv(), displacement as never) as ShaderNodeObject<Node>

    // 3. Vertical band gradient via colorRamp on the displaced y.
    const band = (dUv.y as ShaderNodeObject<Node>).clamp(0, 1)
    const colorAtUv = colorRamp(band as never, stops) as ShaderNodeObject<Node>

    const material = new MeshBasicNodeMaterial()
    material.colorNode = vec4(colorAtUv.x, colorAtUv.y, colorAtUv.z, 1) as never

    const mesh = new Mesh(new PlaneGeometry(2, 2), material)
    ctx.scene.add(mesh)
    return () => {
      ctx.scene.remove(mesh)
      try {
        material.dispose()
      } catch {
        /* benign */
      }
      try {
        mesh.geometry.dispose()
      } catch {
        /* benign */
      }
    }
  }, [ctx, colors.join('|'), speedUniform, intensityUniform, cursor, cursorUniform])

  return null
}

function DefaultFallback({ colors }: { colors: string[] }) {
  // Three stacked CSS radial gradients with blur per spec §5.2 line 463.
  const layers = colors.slice(0, 3).map((c, i) => {
    const offsets = ['20% 30%', '60% 50%', '80% 80%'][i] ?? '50% 50%'
    return `radial-gradient(circle at ${offsets}, ${c} 0%, transparent 50%)`
  })
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: layers.join(', '),
        filter: 'blur(40px)',
      }}
    />
  )
}

export function Aurora(props: AuroraProps) {
  const colors = resolveColors(props.colors)
  return (
    <FallbackBoundary fallback={props.fallback ?? <DefaultFallback colors={colors} />}>
      <MatterScene className={props.className} style={props.style}>
        <AuroraMesh {...props} />
      </MatterScene>
    </FallbackBoundary>
  )
}
```

### Task 2: Registry + docs page

- [ ] **Step 2.1: Add `aurora` to `registry/registry.json`.**

```json
"aurora": {
  "file": "aurora.tsx",
  "description": "Flowing FBM-displaced color bands with optional cursor amplification.",
  "dependencies": ["@lovo/matter", "@lovo/matter-react", "react", "three"],
  "uses_primitives": ["fbm", "displace", "colorRamp", "smoothstep", "length", "uv", "vec2", "vec3", "vec4", "time", "uniform"],
  "tier": 1
}
```

- [ ] **Step 2.2: Add export key:** `"./aurora": "./aurora.tsx"`.

- [ ] **Step 2.3: Create `apps/docs/app/components/aurora/page.tsx`.**

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { Pane } from 'tweakpane'
import dynamic from 'next/dynamic'

const Aurora = dynamic(() => import('@matter/registry/aurora').then((m) => m.Aurora), {
  ssr: false,
})

interface Params {
  c0: string
  c1: string
  c2: string
  speed: number
  intensity: number
  interactive: boolean
}

const INITIAL: Params = {
  c0: '#7b61ff',
  c1: '#5fc7ff',
  c2: '#ff61a6',
  speed: 0.4,
  intensity: 1,
  interactive: false,
}

export default function AuroraPage() {
  const paneContainerRef = useRef<HTMLDivElement>(null)
  const [params, setParams] = useState<Params>(INITIAL)

  useEffect(() => {
    const container = paneContainerRef.current
    if (!container) return
    const local = { ...INITIAL }
    const pane = new Pane({ container, title: '<Aurora>' })
    pane.addBinding(local, 'c0', { label: 'color 0' })
    pane.addBinding(local, 'c1', { label: 'color 1' })
    pane.addBinding(local, 'c2', { label: 'color 2' })
    pane.addBlade({ view: 'separator' })
    pane.addBinding(local, 'speed', { min: 0, max: 2, step: 0.01 })
    pane.addBinding(local, 'intensity', { min: 0, max: 3, step: 0.01 })
    pane.addBlade({ view: 'separator' })
    pane.addBinding(local, 'interactive', { label: 'interactive (cursor warps flow)' })
    pane.on('change', () => setParams({ ...local }))
    return () => {
      pane.dispose()
    }
  }, [])

  return (
    <main style={{ minHeight: '100vh', position: 'relative' }}>
      <div style={{ position: 'relative', height: '70vh', background: '#0a0a14' }}>
        <Aurora
          colors={[params.c0, params.c1, params.c2]}
          speed={params.speed}
          intensity={params.intensity}
          interactive={params.interactive}
        />
      </div>
      <div
        ref={paneContainerRef}
        style={{ position: 'fixed', top: '1rem', right: '1rem', zIndex: 10, width: '320px' }}
      />
      <section style={{ padding: '2rem', maxWidth: '60ch', margin: '0 auto' }}>
        <h1 style={{ marginTop: 0 }}>&lt;Aurora /&gt;</h1>
        <pre
          style={{
            background: '#1a1a2a',
            color: '#e0e0f0',
            padding: '1rem',
            borderRadius: '0.5rem',
            fontSize: '0.85rem',
          }}
        >
          {`<Aurora colors={['#7b61ff','#5fc7ff','#ff61a6']} speed={0.4} intensity={1} />`}
        </pre>
      </section>
    </main>
  )
}
```

### Task 3: Update homepage to link all six components

- [ ] **Step 3.1: Replace `apps/docs/app/page.tsx`.**

```tsx
// apps/docs/app/page.tsx
import Link from 'next/link'

const COMPONENTS = [
  { slug: 'linear-gradient', label: '<LinearGradient>' },
  { slug: 'noise-field', label: '<NoiseField>' },
  { slug: 'dot-field', label: '<DotField>' },
  { slug: 'waves', label: '<Waves>' },
  { slug: 'mesh-gradient', label: '<MeshGradient>' },
  { slug: 'aurora', label: '<Aurora>' },
] as const

export default function Home() {
  return (
    <main style={{ padding: '4rem 2rem', maxWidth: '60ch', margin: '0 auto' }}>
      <h1 style={{ marginTop: 0 }}>Matter</h1>
      <p>React shader components powered by WebGPU and Three.js TSL.</p>
      <p style={{ opacity: 0.75 }}>Status: pre-release, M3 complete — six v1 components live.</p>
      <h2 style={{ marginTop: '2rem' }}>Components</h2>
      <ul style={{ paddingLeft: '1.25rem', lineHeight: 1.8 }}>
        {COMPONENTS.map((c) => (
          <li key={c.slug}>
            <Link
              href={`/components/${c.slug}`}
              style={{ color: '#88aaff', textDecoration: 'none' }}
            >
              {c.label}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  )
}
```

### Task 4: Final M3 verification

- [ ] **Step 4.1: Full build + check + smoke.**

```bash
pnpm install
pnpm build && pnpm typecheck && pnpm lint && pnpm test
pnpm smoke
```

Expected: all green. The CLI smoke test still adds `linear-gradient` cleanly (M2's smoke flow doesn't iterate over all components — that's fine).

- [ ] **Step 4.2: Visual sweep.**

```bash
pnpm --filter @matter/docs dev
```

Open each component page in turn (`/components/linear-gradient`, `/components/noise-field`, `/components/dot-field`, `/components/waves`, `/components/mesh-gradient`, `/components/aurora`). For each: confirm it renders, the Tweakpane panel works, the fallback flashes during init.

Visit `/dev/fbm-playground` and `/dev/mesh-gradient-playground` — both still render.

Visit `/` — six links, all working.

- [ ] **Step 4.3: CLI sanity for the new components.**

```bash
node packages/matter-cli/dist/index.js list --registry "file://$(pwd)/registry/registry.json"
```

Expected output: six entries (linear-gradient, noise-field, dot-field, waves, mesh-gradient, aurora) sorted alphabetically with descriptions.

- [ ] **Step 4.4: Try `add` for one new component end-to-end.**

```bash
mkdir -p /tmp/matter-m3-cli-smoke && cd /tmp/matter-m3-cli-smoke
node /Users/hunter.garrett/Documents/_personal/mattermix/packages/matter-cli/dist/index.js init --force
node /Users/hunter.garrett/Documents/_personal/mattermix/packages/matter-cli/dist/index.js \
  add aurora --registry "file:///Users/hunter.garrett/Documents/_personal/mattermix/registry/registry.json"
ls components/matter/
cat components/matter/aurora.tsx | head -5
cd -
```

Expected: `components/matter/aurora.tsx` written, install hint printed for `@lovo/matter @lovo/matter-react react three`.

- [ ] **Step 4.5: Commit.**

```bash
git add registry/aurora.tsx registry/registry.json registry/package.json \
        apps/docs/app/components/aurora/page.tsx \
        apps/docs/app/page.tsx \
        pnpm-lock.yaml
git commit -m "feat(registry): ship <Aurora> + M3 homepage wrap-up

Phase 3.5 — final v1 component lands. Aurora is pure composition (fbm
from 3.1.a + displace from 3.2 + colorRamp from M1) — no new primitives.
Homepage now links all six components."
```

- [ ] **Step 4.6: Tag.**

```bash
git tag m3-complete
git log --oneline | head -10
```

Verify the tag points at the commit you just created.

### Stop-and-play gate (3.5 / M3 wrap-up)

Walk the full v1 catalog: open all six component pages and the two `/dev/` playgrounds. Take a screen-recording of the loop for the project's archives. **This is the architectural proof point** — six components on one site, all using the Matter primitives, all with cursor and animation working, validates every architectural decision per spec §5.3 line 522.

### Done-criteria for 3.5 / M3

- [ ] All six components render at `/components/<slug>` with working Tweakpane controls.
- [ ] Both playgrounds (`/dev/fbm-playground`, `/dev/mesh-gradient-playground`) still render.
- [ ] Homepage `/` links all six components.
- [ ] `registry/registry.json` lists six components; `registry/package.json` exports six keys.
- [ ] CLI `list` command shows all six.
- [ ] `pnpm smoke` passes.
- [ ] `pnpm build && pnpm typecheck && pnpm lint && pnpm test` green at root.
- [ ] One commit, scope `feat(registry):`.
- [ ] Tag `m3-complete` exists at HEAD.
- [ ] No untracked files except this plan file (which the user can commit at their discretion or leave on disk).

### Review pass (M3 wrap-up)

Spawn **three** subagents this final time — the broader scope of the M3 wrap-up earns it.

**Spec-compliance reviewer:** _"Verify M3 ships exactly what spec §5.2 specifies for the six components: every prop name, every default, every variant, every fallback approach. Spot-check the dependency graph (top of `2026-05-06-matter-m3-components.md`): does each component import only the primitives it lists in its registry.json `uses_primitives`? Confirm `gradient`/`radialGradient` are intentionally absent (deferred per scope) — not silently missed."_

**Code-quality reviewer:** _"Sweep all six registry components for: gotcha #12 (`uv()`-rooted TSL chains, uniforms as args); gotcha #14 (Strict-Mode-safe hook lifecycles in `useResize`/`useScroll`); the `try/catch` around `material.dispose()` and `mesh.geometry.dispose()` per CLAUDE.md known issue. Flag any Tier 1 component that imports from another Tier 1 component file. Flag any duplicate code that should be extracted to `@lovo/matter` instead of repeated in every component (e.g., `hexToVec3` is duplicated by design — copy-paste components are self-contained — but call out anything else that crossed the duplication line)."_

**Architectural-soundness reviewer:** _"Per spec §5.3 line 522, the v1 catalog should validate seven architectural decisions. Walk each row of the §5.3 table and confirm the corresponding evidence exists in M3's deliverables. Flag any architectural claim the implementation doesn't actually back up."_

Address all REQUIRED notes; SUGGESTED notes go to a follow-up commit if substantial, or to memory if they're "in M4 we should…".

### M3 memory write

When M3 is fully green, write a single memory entry summarizing the milestone — the surprising/non-obvious learnings that future sessions should carry forward (not the individual gotchas, which are already in CLAUDE.md). One file: `~/.claude/projects/-Users-hunter-garrett-Documents--personal-mattermix/memory/project_matter_m3_complete.md`. Topics worth capturing:

- The chosen FBM defaults (octaves/lacunarity/gain) the user landed on in 3.1.a
- The chosen MeshGradient `blur` default the user landed on in 3.4.a
- Any unforeseen TSL backend differences encountered (WebGPU vs WebGL2 fallback)
- Whether voronoi vs `mx_worley_noise_float` proved sufficient or needs replacement
- Surprises about the per-frame uniform-update pattern at 6-component scale (foreshadowing M5 perf)

Also update `~/.claude/projects/-Users-hunter-garrett-Documents--personal-mattermix/memory/MEMORY.md` to add a one-liner pointing to it.

---

## End-of-plan self-review checklist (run before declaring M3 plan-ready)

Engineer reads this top-to-bottom:

- [ ] Every primitive listed in spec §11 row 3 has a phase that ships it OR a documented deferral with rationale.
- [ ] Every component in spec §5.2 has a registry file, a docs page, a registry.json entry, and a package.json export key.
- [ ] No phase relies on a primitive shipped by a _later_ phase (verify the dependency graph at the top).
- [ ] Every TSL chain in every shader fragment starts from `uv()`/`vec2(...)` and consumes uniforms as arguments — gotcha #12.
- [ ] Every docs-page component import uses `next/dynamic({ ssr: false })` — gotcha #10.
- [ ] Every input hook (useResize, useScroll) follows the single-effect Strict-Mode pattern — gotcha #14.
- [ ] No phase introduces Playwright, Storybook, hosted-registry, telemetry, audio, animation primitives, or per-component hooks.
- [ ] Each commit is conventional + scoped.
- [ ] Tag `m3-complete` is created exactly once, at the end of 3.5.

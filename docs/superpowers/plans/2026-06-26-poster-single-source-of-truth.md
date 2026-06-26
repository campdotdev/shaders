# Poster Single-Source-of-Truth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make each component's poster render the exact same scene + initial params as its live docs demo, defined once and shared, so posters can never drift from what users see.

**Architecture:** For each of the five components, split the demo's initial configuration into `params.ts` (the `INITIAL` params + types — pure data, statically importable by the page) and `scene.tsx` (a default-exported scene component rendering the `<ShaderScene>…</ShaderScene>` tree at `INITIAL` by default, dynamically imported by the page with `ssr:false`, and esbuild-imported directly by the poster CLI). A `pnpm posters` script points the CLI's `--source` straight at each `scene.tsx`. The hand-maintained `packages/matter-cli/posters/` copies are deleted.

**Tech Stack:** TypeScript 5 strict, React 19, Next.js 15 (`apps/docs`), three.js 0.170 WebGPU/TSL, `@matter/registry` components, `@lovo/matter-cli` poster command (esbuild + Playwright), Tweakpane.

## Global Constraints

- TypeScript strict, `verbatimModuleSyntax`, `noUncheckedIndexedAccess`; `import type` for type-only imports.
- Clear descriptive names; no emojis; Conventional Commits (scope without `@lovo/`); no Claude attribution trailers.
- **esbuild (poster bundling) resolves only node_modules — NOT the `@/` tsconfig alias.** In `params.ts`/`scene.tsx`, import palette via the **relative** path `../../../lib/palette`, never `@/lib/palette`. Type-only imports (`@lovo/matter`, `@matter/registry/*`) are erased by esbuild and are safe.
- **`three/webgpu` cannot SSR** (touches `self` at module load). Therefore `scene.tsx` (which statically imports the shader components) must be **dynamically imported by the page with `{ ssr: false }`**. The poster renders in a real browser (Playwright), so static imports are fine there.
- The page needs `INITIAL` **synchronously** (to seed Tweakpane), so `INITIAL` lives in `params.ts` (no heavy deps) — never inside the dynamically-imported `scene.tsx`.
- `scene.tsx` accepts optional `children` rendered inside `<ShaderScene>` so the page injects `<VisualTestPause />`; the poster passes none.
- Scene components default `params = INITIAL` so the CLI renders them with no props.
- Run the poster CLI **one invocation at a time** (sequential) — concurrent runs collide on the poster server port.
- Poster formats: `linear-gradient`→`.png`, `simplex-noise`→`.png`, `aurora`/`grain`/`mesh-gradient`→`.jpg`. CLI defaults (1280×720 @ DPR2 = 2560×1440) preserve existing asset dimensions.
- Node 22 for any `next build`/poster generation (Node 23 breaks the docs build — see CLAUDE.md).

---

## Task 1: Prep — commit stray lockfile, clean working tree

**Files:**
- Modify (commit): `pnpm-lock.yaml`
- Revert: `apps/docs/public/posters/grain.jpg`, `packages/matter-cli/posters/grain.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces: a clean working tree on top of the committed MAT-41 work, so subsequent tasks start clean.

- [ ] **Step 1: Confirm the lockfile change is the Task-4 `@lovo/matter` link**

Run: `git diff pnpm-lock.yaml`
Expected: the only change adds a `@lovo/matter` `link:../matter` entry under `@lovo/matter-cli` (left uncommitted when Task 4 added the devDependency). If it shows anything else, stop and report.

- [ ] **Step 2: Commit the lockfile**

```bash
git add pnpm-lock.yaml
git commit -m "chore(matter-cli): commit lockfile for @lovo/matter devDependency link"
```

- [ ] **Step 3: Revert the in-progress grain quick-fix (superseded by this refactor)**

The working tree holds an uncommitted grain quick-fix from the MAT-41 gate. The refactor regenerates grain from the new shared scene and deletes the old poster source, so revert to a clean tree:

```bash
git checkout -- apps/docs/public/posters/grain.jpg packages/matter-cli/posters/grain.tsx
git status --short
```
Expected: `git status --short` prints nothing (clean tree).

---

## Task 2: grain — shared params + scene (pattern-setter)

**Files:**
- Create: `apps/docs/src/app/components/grain/params.ts`
- Create: `apps/docs/src/app/components/grain/scene.tsx`
- Modify: `apps/docs/src/app/components/grain/page.tsx`
- Regenerate: `apps/docs/public/posters/grain.jpg`

**Interfaces:**
- Consumes: `INITIAL`, `GrainParams` from `./params`; `<GrainScene params? children?>` default export from `./scene`.
- Produces: the canonical params/scene/page pattern reused by Tasks 3–6. `scene.tsx` default-exports `GrainScene({ params = INITIAL, children }): JSX`.

- [ ] **Step 1: Create `params.ts`**

```ts
import type { GrainBlend } from '@matter/registry/grain';

export interface GrainParams {
  intensity: number;
  speed: number;
  grainBlend: GrainBlend;
}

export const INITIAL: GrainParams = {
  intensity: 0.15,
  speed: 0.3,
  grainBlend: 'additive',
};
```

- [ ] **Step 2: Create `scene.tsx`**

```tsx
'use client';

import { ShaderScene } from '@lovo/matter-react';
import { Grain } from '@matter/registry/grain';
import { LinearGradient } from '@matter/registry/linear-gradient';
import type { ReactNode } from 'react';

import { INITIAL, type GrainParams } from './params';

export default function GrainScene({
  params = INITIAL,
  children,
}: {
  params?: GrainParams;
  children?: ReactNode;
} = {}) {
  return (
    <ShaderScene>
      <LinearGradient />
      <Grain grainBlend={params.grainBlend} intensity={params.intensity} speed={params.speed} />
      {children}
    </ShaderScene>
  );
}
```

- [ ] **Step 3: Regenerate the poster from the new scene (proves it bundles + renders)**

```bash
node packages/matter-cli/dist/index.js poster \
  --source apps/docs/src/app/components/grain/scene.tsx \
  --output apps/docs/public/posters/grain.jpg \
  --format jpg
```
Expected: `Wrote poster: apps/docs/public/posters/grain.jpg (1280×720, …)`, exit 0. (If the CLI isn't built, run `pnpm --filter @lovo/matter-cli build` first.)

- [ ] **Step 4: Repoint `page.tsx` at the shared module**

In `apps/docs/src/app/components/grain/page.tsx`:
- Delete the inline `interface GrainParams { … }` and `const INITIAL: GrainParams = { … }`.
- Delete the `import type { GrainBlend } from '@matter/registry/grain';` line (now in `params.ts`).
- Delete the two component dynamic imports (`const LinearGradient = dynamic(...)`, `const Grain = dynamic(...)`) and the `ShaderScene` import — the scene owns them now.
- Add near the other imports:
  ```tsx
  import { INITIAL, type GrainParams } from './params';
  ```
  and the scene dynamic import:
  ```tsx
  const GrainScene = dynamic(() => import('./scene'), { ssr: false });
  ```
- Keep the `useTweakpane<GrainParams>('<Grain>', INITIAL, …)` call (now `INITIAL`/`GrainParams` come from `./params`).
- Replace the render block

  ```tsx
  <ShaderScene>
    <LinearGradient />
    <Grain grainBlend={params.grainBlend} intensity={params.intensity} speed={params.speed} />
    <VisualTestPause />
  </ShaderScene>
  ```

  with

  ```tsx
  <GrainScene params={params}>
    <VisualTestPause />
  </GrainScene>
  ```
- Keep everything else (the `<Image src="/posters/grain.jpg" …>` fallback, layout, Tweakpane container).

- [ ] **Step 5: Typecheck and lint the docs app**

Run: `pnpm --filter @matter/docs typecheck && pnpm --filter @matter/docs lint`
Expected: both pass, no unused-import errors (if any moved import is now unused in the page, remove it).

- [ ] **Step 6: Commit**

```bash
git add apps/docs/src/app/components/grain/params.ts apps/docs/src/app/components/grain/scene.tsx apps/docs/src/app/components/grain/page.tsx apps/docs/public/posters/grain.jpg
git commit -m "refactor(docs): share grain scene between page and poster"
```

---

## Task 3: simplex-noise — shared params + scene

**Files:**
- Create: `apps/docs/src/app/components/simplex-noise/params.ts`
- Create: `apps/docs/src/app/components/simplex-noise/scene.tsx`
- Modify: `apps/docs/src/app/components/simplex-noise/page.tsx`
- Regenerate: `apps/docs/public/posters/simplex-noise.png`

**Interfaces:**
- Consumes: `INITIAL`, `Params` from `./params`; `<SimplexNoiseScene params? children?>` default export from `./scene`.
- Produces: poster now includes `colorSpace`/`hueInterpolation` and palette-token colors (was hardcoded hex + omitted props).

- [ ] **Step 1: Create `params.ts`**

```ts
import type { ColorSpace, HueInterpolation } from '@lovo/matter';

import { palette } from '../../../lib/palette';

export interface Params {
  scale: number;
  speed: number;
  contrast: number;
  bias: number;
  softness: number;
  seed: number;
  colorSpace: ColorSpace;
  hueInterpolation: HueInterpolation;
  colorCount: number;
  color0: string;
  color1: string;
  color2: string;
  color3: string;
  color4: string;
}

export const INITIAL: Params = {
  scale: 10,
  speed: 0.2,
  contrast: 2.5,
  bias: 0.5,
  softness: 0,
  seed: 0,
  colorSpace: 'oklab',
  hueInterpolation: 'shorter',
  colorCount: 5,
  color0: palette.blue.base,
  color1: palette.violet.base,
  color2: palette.purple.base,
  color3: palette.magenta.base,
  color4: palette.teal.base,
};
```

- [ ] **Step 2: Create `scene.tsx`**

```tsx
'use client';

import { ShaderScene } from '@lovo/matter-react';
import { SimplexNoise } from '@matter/registry/simplex-noise';
import type { ColorStop } from '@matter/registry/simplex-noise';
import type { ReactNode } from 'react';

import { INITIAL, type Params } from './params';

export default function SimplexNoiseScene({
  params = INITIAL,
  children,
}: {
  params?: Params;
  children?: ReactNode;
} = {}) {
  const allColors = [params.color0, params.color1, params.color2, params.color3, params.color4];
  const stops: ColorStop[] = allColors.slice(0, params.colorCount).map((color) => ({ color }));

  return (
    <ShaderScene>
      <SimplexNoise
        bias={params.bias}
        colorSpace={params.colorSpace}
        contrast={params.contrast}
        hueInterpolation={params.hueInterpolation}
        scale={params.scale}
        seed={params.seed}
        softness={params.softness}
        speed={params.speed}
        stops={stops}
      />
      {children}
    </ShaderScene>
  );
}
```

- [ ] **Step 3: Regenerate the poster**

```bash
node packages/matter-cli/dist/index.js poster \
  --source apps/docs/src/app/components/simplex-noise/scene.tsx \
  --output apps/docs/public/posters/simplex-noise.png \
  --format png
```
Expected: `Wrote poster: …simplex-noise.png …`, exit 0.

- [ ] **Step 4: Repoint `page.tsx`**

In `apps/docs/src/app/components/simplex-noise/page.tsx`:
- Delete the inline `interface Params { … }` and `const INITIAL: Params = { … }`.
- Delete the `import type { ColorSpace, HueInterpolation } from '@lovo/matter';`, `import type { ColorStop } from '@matter/registry/simplex-noise';`, and `import { palette } from '@/lib/palette';` lines (now in `params.ts`/`scene.tsx`).
- Delete the `SimplexNoise` dynamic import and the `ShaderScene` import.
- Delete the in-page `stops` derivation (`const allColors = …; const stops: ColorStop[] = …`) — it moved into `scene.tsx`.
- Add:
  ```tsx
  import { INITIAL, type Params } from './params';
  ```
  and
  ```tsx
  const SimplexNoiseScene = dynamic(() => import('./scene'), { ssr: false });
  ```
- Keep `useTweakpane<Params>('<SimplexNoise>', INITIAL, …)`.
- Replace the render block

  ```tsx
  <ShaderScene>
    <SimplexNoise … stops={stops} />
    <VisualTestPause />
  </ShaderScene>
  ```

  with

  ```tsx
  <SimplexNoiseScene params={params}>
    <VisualTestPause />
  </SimplexNoiseScene>
  ```
- Keep the `<Image src="/posters/simplex-noise.png" …>` fallback and everything else.

- [ ] **Step 5: Typecheck and lint**

Run: `pnpm --filter @matter/docs typecheck && pnpm --filter @matter/docs lint`
Expected: pass; remove any now-unused imports the linter flags.

- [ ] **Step 6: Commit**

```bash
git add apps/docs/src/app/components/simplex-noise/params.ts apps/docs/src/app/components/simplex-noise/scene.tsx apps/docs/src/app/components/simplex-noise/page.tsx apps/docs/public/posters/simplex-noise.png
git commit -m "refactor(docs): share simplex-noise scene between page and poster"
```

---

## Task 4: mesh-gradient — shared params + scene (drops the stray grain overlay)

**Files:**
- Create: `apps/docs/src/app/components/mesh-gradient/params.ts`
- Create: `apps/docs/src/app/components/mesh-gradient/scene.tsx`
- Modify: `apps/docs/src/app/components/mesh-gradient/page.tsx`
- Regenerate: `apps/docs/public/posters/mesh-gradient.jpg`

**Interfaces:**
- Consumes: `INITIAL`, `Params` from `./params`; `<MeshGradientScene params? children?>` default export from `./scene`.
- Produces: poster **without** the `<Grain>` overlay (the live page renders none) and with `colorSpace`/`hueInterpolation` + palette tokens.

- [ ] **Step 1: Create `params.ts`**

```ts
import type { ColorSpace, HueInterpolation } from '@lovo/matter';

import { palette } from '../../../lib/palette';

export interface Params {
  speed: number;
  frequency: number;
  amplitude: number;
  cycleSpeed: number;
  cycleEase: number;
  colorSpace: ColorSpace;
  hueInterpolation: HueInterpolation;
  a0: string;
  a1: string;
  a2: string;
  a3: string;
  b0: string;
  b1: string;
  b2: string;
  b3: string;
}

export const INITIAL: Params = {
  speed: 2,
  frequency: 5,
  amplitude: 30,
  cycleSpeed: 0.5,
  cycleEase: 0.6,
  colorSpace: 'oklab',
  hueInterpolation: 'shorter',
  a0: palette.lime.base,
  a1: palette.green.base,
  a2: palette.teal.base,
  a3: palette.sky.base,
  b0: palette.amber.base,
  b1: palette.orange.base,
  b2: palette.red.base,
  b3: palette.magenta.base,
};
```

- [ ] **Step 2: Create `scene.tsx`** (note: **no `<Grain>`** — matches the live page)

```tsx
'use client';

import { ShaderScene } from '@lovo/matter-react';
import { MeshGradient } from '@matter/registry/mesh-gradient';
import type { ReactNode } from 'react';

import { INITIAL, type Params } from './params';

export default function MeshGradientScene({
  params = INITIAL,
  children,
}: {
  params?: Params;
  children?: ReactNode;
} = {}) {
  return (
    <ShaderScene>
      <MeshGradient
        amplitude={params.amplitude}
        colorSpace={params.colorSpace}
        cycleEase={params.cycleEase}
        cycleSpeed={params.cycleSpeed}
        frequency={params.frequency}
        hueInterpolation={params.hueInterpolation}
        palettes={[
          [params.a0, params.a1, params.a2, params.a3],
          [params.b0, params.b1, params.b2, params.b3],
        ]}
        speed={params.speed}
      />
      {children}
    </ShaderScene>
  );
}
```

- [ ] **Step 3: Regenerate the poster**

```bash
node packages/matter-cli/dist/index.js poster \
  --source apps/docs/src/app/components/mesh-gradient/scene.tsx \
  --output apps/docs/public/posters/mesh-gradient.jpg \
  --format jpg
```
Expected: `Wrote poster: …mesh-gradient.jpg …`, exit 0.

- [ ] **Step 4: Repoint `page.tsx`**

In `apps/docs/src/app/components/mesh-gradient/page.tsx`:
- Delete the inline `interface Params { … }` and `const INITIAL: Params = { … }`.
- Delete `import type { ColorSpace, HueInterpolation } from '@lovo/matter';` and `import { palette } from '@/lib/palette';`.
- Delete the `MeshGradient` dynamic import and the `ShaderScene` import.
- Add `import { INITIAL, type Params } from './params';` and `const MeshGradientScene = dynamic(() => import('./scene'), { ssr: false });`.
- Keep `useTweakpane<Params>('<MeshGradient>', INITIAL, …)`.
- Replace the render block

  ```tsx
  <ShaderScene>
    <MeshGradient … palettes={[…]} … />
    <VisualTestPause />
  </ShaderScene>
  ```

  with

  ```tsx
  <MeshGradientScene params={params}>
    <VisualTestPause />
  </MeshGradientScene>
  ```
- Keep the `<Image src="/posters/mesh-gradient.jpg" …>` fallback and the rest.

- [ ] **Step 5: Typecheck and lint**

Run: `pnpm --filter @matter/docs typecheck && pnpm --filter @matter/docs lint`
Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add apps/docs/src/app/components/mesh-gradient/params.ts apps/docs/src/app/components/mesh-gradient/scene.tsx apps/docs/src/app/components/mesh-gradient/page.tsx apps/docs/public/posters/mesh-gradient.jpg
git commit -m "refactor(docs): share mesh-gradient scene between page and poster (drop stray grain overlay)"
```

---

## Task 5: aurora — shared params + scene (fixes the bare-`<Aurora/>` poster)

**Files:**
- Create: `apps/docs/src/app/components/aurora/params.ts`
- Create: `apps/docs/src/app/components/aurora/scene.tsx`
- Modify: `apps/docs/src/app/components/aurora/page.tsx`
- Regenerate: `apps/docs/public/posters/aurora.jpg`

**Interfaces:**
- Consumes: `INITIAL`, `AuroraParams`, `MIN_LAYERS`, `MAX_LAYERS` from `./params`; `<AuroraScene params? children?>` default export from `./scene`.
- Produces: poster renders the full 11-prop / 4-layer `INITIAL` (was bare `<Aurora />` defaults).

- [ ] **Step 1: Create `params.ts`**

```ts
import type { AuroraDirection } from '@matter/registry/aurora';

import { palette } from '../../../lib/palette';

export interface PlainAuroraLayer {
  color: string;
  speed: number;
  intensity: number;
  seed: number;
  falloff: number;
}

export interface AuroraParams {
  intensity: number;
  speed: number;
  densityX: number;
  densityY: number;
  falloff: number;
  driftX: number;
  driftY: number;
  turbulence: number;
  direction: AuroraDirection;
  horizon: string;
  sky: string;
  layers: PlainAuroraLayer[];
}

export const MIN_LAYERS = 1;
export const MAX_LAYERS = 8;

export const INITIAL: AuroraParams = {
  intensity: 1,
  speed: 0.6,
  densityX: 1.35,
  densityY: 5.35,
  falloff: 1.1,
  driftX: 0.2,
  driftY: -3.15,
  turbulence: 1.3,
  direction: 'top',
  horizon: '#040009',
  sky: '#146389',
  layers: [
    { color: palette.green.base, speed: 0.07, intensity: 0.6, seed: 0, falloff: 1 },
    { color: palette.blue.base, speed: 0.1, intensity: 0.2, seed: 5, falloff: 1 },
    { color: palette.violet.base, speed: 0.15, intensity: 0.3, seed: 11, falloff: 1 },
    { color: palette.magenta.base, speed: 0.07, intensity: 0.2, seed: 17, falloff: 1 },
  ],
};
```

- [ ] **Step 2: Create `scene.tsx`**

```tsx
'use client';

import { ShaderScene } from '@lovo/matter-react';
import { Aurora } from '@matter/registry/aurora';
import type { AuroraLayer } from '@matter/registry/aurora';
import type { ReactNode } from 'react';

import { INITIAL, type AuroraParams } from './params';

export default function AuroraScene({
  params = INITIAL,
  children,
}: {
  params?: AuroraParams;
  children?: ReactNode;
} = {}) {
  const layers: AuroraLayer[] = params.layers.map((layer) => ({
    color: layer.color,
    speed: layer.speed,
    intensity: layer.intensity,
    seed: layer.seed,
    falloff: layer.falloff,
  }));

  return (
    <ShaderScene>
      <Aurora
        background={{ horizon: params.horizon, sky: params.sky }}
        densityX={params.densityX}
        densityY={params.densityY}
        direction={params.direction}
        driftX={params.driftX}
        driftY={params.driftY}
        falloff={params.falloff}
        intensity={params.intensity}
        layers={layers}
        speed={params.speed}
        turbulence={params.turbulence}
      />
      {children}
    </ShaderScene>
  );
}
```

- [ ] **Step 3: Regenerate the poster**

```bash
node packages/matter-cli/dist/index.js poster \
  --source apps/docs/src/app/components/aurora/scene.tsx \
  --output apps/docs/public/posters/aurora.jpg \
  --format jpg
```
Expected: `Wrote poster: …aurora.jpg …`, exit 0.

- [ ] **Step 4: Repoint `page.tsx`**

In `apps/docs/src/app/components/aurora/page.tsx`:
- Delete the inline `interface PlainAuroraLayer`, `interface AuroraParams`, `const MIN_LAYERS`, `const MAX_LAYERS`, and `const INITIAL: AuroraParams = { … }`.
- Delete `import type { AuroraDirection, AuroraLayer } from '@matter/registry/aurora';` and `import { palette } from '@/lib/palette';`.
- Delete the `Aurora` dynamic import and the `ShaderScene` import.
- Delete the in-page `layers` derivation (`const layers: AuroraLayer[] = params.layers.map(…)`) — it moved into `scene.tsx`.
- Add:
  ```tsx
  import { INITIAL, MAX_LAYERS, MIN_LAYERS, type AuroraParams } from './params';
  ```
  and `const AuroraScene = dynamic(() => import('./scene'), { ssr: false });`.
- This page manages Tweakpane manually with `useRef`/`useState`/`useEffect`; keep that code, now reading `INITIAL`/`MIN_LAYERS`/`MAX_LAYERS` from `./params`. The `useState<AuroraParams>(() => structuredClone(INITIAL))` and `const local: AuroraParams = structuredClone(INITIAL)` lines are unchanged except the type/const now come from `./params`.
- Replace the render block

  ```tsx
  <ShaderScene>
    <Aurora … layers={layers} … />
    <VisualTestPause />
  </ShaderScene>
  ```

  with

  ```tsx
  <AuroraScene params={params}>
    <VisualTestPause />
  </AuroraScene>
  ```
- Keep the `<Image src="/posters/aurora.jpg" …>` fallback and the rest.

- [ ] **Step 5: Typecheck and lint**

Run: `pnpm --filter @matter/docs typecheck && pnpm --filter @matter/docs lint`
Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add apps/docs/src/app/components/aurora/params.ts apps/docs/src/app/components/aurora/scene.tsx apps/docs/src/app/components/aurora/page.tsx apps/docs/public/posters/aurora.jpg
git commit -m "refactor(docs): share aurora scene between page and poster"
```

---

## Task 6: linear-gradient — shared params + scene

**Files:**
- Create: `apps/docs/src/app/components/linear-gradient/params.ts`
- Create: `apps/docs/src/app/components/linear-gradient/scene.tsx`
- Modify: `apps/docs/src/app/components/linear-gradient/page.tsx`
- Regenerate: `apps/docs/public/posters/linear-gradient.png`

**Interfaces:**
- Consumes: `INITIAL`, `Params`, `Stop`, `MIN_STOPS`, `MAX_STOPS` from `./params`; `<LinearGradientScene params? children?>` default export from `./scene`.
- Produces: poster with `colorSpace: 'oklab'` / `hueInterpolation: 'shorter'` and `paletteOklch` colors (was hardcoded hex + omitted props). The scene owns the gradient remount key.

- [ ] **Step 1: Create `params.ts`** (note: this page uses `paletteOklch`, not `palette`)

```ts
import type { ColorSpace, HueInterpolation } from '@lovo/matter';

import { paletteOklch } from '../../../lib/palette';

export interface Stop {
  color: string;
  position: number;
}

export interface Params {
  angle: number;
  speed: number;
  focalX: number;
  focalY: number;
  colorSpace: ColorSpace;
  hueInterpolation: HueInterpolation;
  stops: Stop[];
}

export const MIN_STOPS = 1;
export const MAX_STOPS = 6;

export const INITIAL: Params = {
  angle: 90,
  speed: 0,
  focalX: 0.5,
  focalY: 0.5,
  colorSpace: 'oklab',
  hueInterpolation: 'shorter',
  stops: [
    { color: paletteOklch.violet.base, position: 0 },
    { color: paletteOklch.purple.base, position: 0.5 },
    { color: paletteOklch.magenta.dark, position: 1 },
  ],
};
```

- [ ] **Step 2: Create `scene.tsx`** (the gradient remount key moves here — `colorRamp` bakes stops as literals, so the material must rebuild when they change)

```tsx
'use client';

import { ShaderScene } from '@lovo/matter-react';
import { LinearGradient } from '@matter/registry/linear-gradient';
import type { ReactNode } from 'react';

import { INITIAL, type Params } from './params';

export default function LinearGradientScene({
  params = INITIAL,
  children,
}: {
  params?: Params;
  children?: ReactNode;
} = {}) {
  const remountKey = `${params.colorSpace}-${params.hueInterpolation}-${params.stops
    .map((stop) => `${stop.color}@${stop.position}`)
    .join(',')}`;

  return (
    <ShaderScene>
      <LinearGradient
        angle={params.angle}
        colorSpace={params.colorSpace}
        focalPoint={[params.focalX, params.focalY]}
        hueInterpolation={params.hueInterpolation}
        key={remountKey}
        speed={params.speed}
        stops={params.stops}
      />
      {children}
    </ShaderScene>
  );
}
```

Before writing, open `page.tsx` and confirm the existing `remountKey` derivation; if it keys on the same three inputs (colorSpace, hueInterpolation, stops) the expression above is equivalent. If the page keys on something additional, mirror that here so live remount behavior is unchanged.

- [ ] **Step 3: Regenerate the poster**

```bash
node packages/matter-cli/dist/index.js poster \
  --source apps/docs/src/app/components/linear-gradient/scene.tsx \
  --output apps/docs/public/posters/linear-gradient.png \
  --format png
```
Expected: `Wrote poster: …linear-gradient.png …`, exit 0.

- [ ] **Step 4: Repoint `page.tsx`**

In `apps/docs/src/app/components/linear-gradient/page.tsx`:
- Delete the inline `interface Stop`, `interface Params`, `const MIN_STOPS`, `const MAX_STOPS`, `const INITIAL: Params = { … }`, and the in-page `remountKey` derivation (moved to `scene.tsx`).
- Delete `import type { ColorSpace, HueInterpolation } from '@lovo/matter';` and `import { paletteOklch } from '@/lib/palette';`.
- Delete the `LinearGradient` dynamic import and the `ShaderScene` import.
- Add:
  ```tsx
  import { INITIAL, MAX_STOPS, MIN_STOPS, type Params, type Stop } from './params';
  ```
  and `const LinearGradientScene = dynamic(() => import('./scene'), { ssr: false });`.
- This page manages Tweakpane manually; keep the `useState<Params>(() => structuredClone(INITIAL))` / `const local: Params = structuredClone(INITIAL)` code, now reading from `./params`. Keep `MIN_STOPS`/`MAX_STOPS`/`Stop` usages in the add/remove-stop Tweakpane handlers.
- Replace the render block

  ```tsx
  <ShaderScene>
    <LinearGradient … key={remountKey} … stops={params.stops} />
    <VisualTestPause />
  </ShaderScene>
  ```

  with

  ```tsx
  <LinearGradientScene params={params}>
    <VisualTestPause />
  </LinearGradientScene>
  ```
- Keep the `<Image src="/posters/linear-gradient.png" …>` fallback and the rest.

- [ ] **Step 5: Typecheck and lint**

Run: `pnpm --filter @matter/docs typecheck && pnpm --filter @matter/docs lint`
Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add apps/docs/src/app/components/linear-gradient/params.ts apps/docs/src/app/components/linear-gradient/scene.tsx apps/docs/src/app/components/linear-gradient/page.tsx apps/docs/public/posters/linear-gradient.png
git commit -m "refactor(docs): share linear-gradient scene between page and poster"
```

---

## Task 7: build-posters script, delete old sources, fix README, full regenerate

**Files:**
- Create: `scripts/build-posters.sh`
- Modify: `package.json` (root — add `posters` script)
- Delete: `packages/matter-cli/posters/` (all five `.tsx` files)
- Modify: `packages/matter-cli/README.md` (flag names)
- Regenerate: all five `apps/docs/public/posters/*`

**Interfaces:**
- Consumes: the five `apps/docs/src/app/components/<name>/scene.tsx` modules from Tasks 2–6.
- Produces: `pnpm posters` regenerates every committed poster from its docs scene module.

- [ ] **Step 1: Create `scripts/build-posters.sh`**

```bash
#!/usr/bin/env bash
# Regenerate every committed poster image from its docs scene module.
# Each poster's --source is the SAME scene the live docs page renders, so the
# poster cannot drift from the demo. Runs one at a time: the poster dev server
# binds a fixed port and concurrent runs collide.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

CLI="node packages/matter-cli/dist/index.js poster"
COMPONENTS_DIR="apps/docs/src/app/components"
OUT_DIR="apps/docs/public/posters"

if [ ! -f packages/matter-cli/dist/index.js ]; then
  echo "error: CLI not built. Run: pnpm --filter @lovo/matter-cli build" >&2
  exit 1
fi

# name:format pairs (png for the flat shaders, jpg for the busy ones)
for pair in \
  "linear-gradient:png" \
  "simplex-noise:png" \
  "aurora:jpg" \
  "grain:jpg" \
  "mesh-gradient:jpg"; do
  name="${pair%%:*}"
  format="${pair##*:}"
  echo "==> $name ($format)"
  $CLI \
    --source "${COMPONENTS_DIR}/${name}/scene.tsx" \
    --output "${OUT_DIR}/${name}.${format}" \
    --format "${format}"
done

echo "All posters regenerated."
```

- [ ] **Step 2: Make it executable and add the root `posters` script**

```bash
chmod +x scripts/build-posters.sh
```

In the root `package.json` `"scripts"` block, add:
```json
"posters": "bash scripts/build-posters.sh",
```

- [ ] **Step 3: Delete the obsolete hand-authored poster sources**

```bash
git rm -r packages/matter-cli/posters
```
Expected: removes the five `.tsx` files. (They are referenced nowhere else — verified during planning.)

- [ ] **Step 4: Fix the stale flag names in the CLI README**

In `packages/matter-cli/README.md`, update the poster examples: replace `--from` → `--source`, `--out` → `--output`, `--type` → `--format`. Verify with:

Run: `grep -nE "\-\-from|\-\-out |\-\-type" packages/matter-cli/README.md || echo "no stale flags"`
Expected: `no stale flags`.

- [ ] **Step 5: Regenerate all posters via the new script**

Run (on Node 22): `pnpm posters`
Expected: five `==> <name>` lines each ending in `Wrote poster: …`, then `All posters regenerated.`, exit 0.

- [ ] **Step 6: Confirm determinism (no diff vs the per-task regenerations)**

Run: `git status --short apps/docs/public/posters/`
Expected: **empty** — Tasks 2–6 already regenerated each poster from the same scenes at deterministic t=0, so re-running the script produces byte-identical files. If any poster shows as modified, investigate (nondeterminism) before continuing.

- [ ] **Step 7: Verify the docs site still builds**

Run (on Node 22): `pnpm --filter @matter/docs build`
Expected: build succeeds — proves each page's `dynamic(() => import('./scene'), { ssr: false })` + static `./params` import compiles and renders without SSR errors.

- [ ] **Step 8: Commit**

```bash
git add scripts/build-posters.sh package.json packages/matter-cli/README.md
git commit -m "chore: add pnpm posters script, delete hand-authored poster sources, fix README flags"
```

---

## Self-Review

**Spec coverage:**
- Shared scene module per component (`params.ts` + `scene.tsx`) → Tasks 2–6. ✅
- Whole `<ShaderScene>` wrapper shared; `children` for `<VisualTestPause/>` → every scene `scene.tsx`. ✅
- Pages consume shared module; Tweakpane seeded from imported `INITIAL` → Tasks 2–6 Step 4. ✅
- No separate poster entry files; CLI `--source` points at `scene.tsx` → Task 7 script. ✅
- Default export so no `--export-name` → every `scene.tsx` default-exports. ✅
- `build-posters.sh` + `pnpm posters`, sequential, correct formats → Task 7. ✅
- Delete `packages/matter-cli/posters/` → Task 7 Step 3. ✅
- README flag fix → Task 7 Step 4. ✅
- Regenerate all five → Task 7 Step 5; drift fixes baked in (grain 0.15, mesh no grain, aurora full props, simplex/linear colorSpace+hueInterpolation+palette) → Tasks 2–6. ✅
- Working-tree note (subsume the grain quick-fix; commit lockfile) → Task 1. ✅
- esbuild relative palette import (no `@/`) → Global Constraints + every palette-using `params.ts`. ✅
- SSR: `scene.tsx` dynamic-imported `{ssr:false}`; `INITIAL` synchronously importable from `params.ts` → Global Constraints + page edits. ✅

**Placeholder scan:** No TBD/TODO; every created file has complete code; every command has an expected result. The one judgment step (linear-gradient `remountKey` parity in Task 6 Step 2) names the exact inputs and provides equivalent code. ✅

**Type consistency:** `INITIAL`/`Params`/`GrainParams`/`AuroraParams` exported from each `params.ts` and imported by both its `scene.tsx` and `page.tsx`. Scene default exports named `<Component>Scene`, dynamic-imported under the same name in each page. `params?` + `children?` signature identical across all five scenes. Type sources match the pages' current imports (`ColorSpace`/`HueInterpolation` ← `@lovo/matter`; `ColorStop`/`GrainBlend`/`AuroraDirection`/`AuroraLayer` ← `@matter/registry/*`). ✅

# Aurora Raymarched Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **CO-WRITE OVERRIDE (non-negotiable):** `registry/aurora/shader.tsx` is co-written — Claude presents each code chunk with a TSL explanation and the USER types it. Neither Claude nor any subagent may call Edit/Write on `registry/aurora/shader.tsx`. All other files (wrapper, demo, docs) may be edited normally. Every task ends at a "GATE" — stop, let the user run the dev server and react, before starting the next task.

**Goal:** Rebuild `<Aurora>` as a raymarched volumetric sky-band (nimitz-inspired) with an altitude color ramp replacing the per-layer API.

**Architecture:** A fullscreen quad whose fragment shader casts a per-pixel ray from a virtual camera, marches ~40 altitude slices above a horizon, samples a triangle-wave FBM field at each slice, and accumulates emission + coverage. Output stays a premultiplied transparent layer. File split unchanged: `aurora.tsx` (wrapper) + `shader.tsx` (TSL).

**Tech Stack:** TypeScript 5 strict, React 19, three 0.170 WebGPU + TSL (`Loop`, `Fn`, `toVar`), `@lovo/matter` primitives (`colorRamp`, `elapsedTime`), Tweakpane + tweakpane-plugin-color-plus (demo).

**Spec:** `docs/superpowers/specs/2026-07-08-aurora-raymarch-rebuild-design.md`

## Global Constraints

- Branch: `hunter/mat-46-make-the-aurora-more-realistic`. Never push to main; PR at the end.
- Conventional Commits; scope `registry` for component files, no `@lovo/` prefix. No emojis anywhere.
- TS strict, `verbatimModuleSyntax` (use `import type`), `noUncheckedIndexedAccess`.
- Destructure props in component signatures — never `props.x` access.
- Clear names over abbreviations (MAT-34): no `p`, `rz`, `bp`, `ro`, `rd`. Single letters only for math-mirroring locals (`x`, `y`).
- TSL gotcha 12: never chain methods on a raw `uniform(...)` receiver — build expressions from `uv()`/`vec2()`/`float()` chains and pass uniforms as arguments.
- Gotcha 17/18/19: continuous params flow through stable uniform nodes (no material rebuild on drag); structural values (stop count/positions/colors, step count, direction) are baked literals with string-proxy deps (`colorStopsKey`).
- Output contract: `material.transparent = true` AND `material.premultipliedAlpha = true`; rgb = light contribution (may exceed 1), alpha = coverage clamped [0, 1].
- The docs site imports `registry/` raw (transpilePackages) — shader edits hot-reload; no package build needed for registry/demo work.
- Node 22 (`fnm use 22` or equivalent) for anything that builds the docs site (`pnpm snap`).
- License: nimitz's "Auroras" (ShaderToy `XtGGRt`, CC BY-NC-SA) is a *technique reference only*. No GLSL is transcribed into the repo; all TSL is written fresh and constants are re-derived/re-tuned at gates.
- No GPU unit tests — validation is the demo page at every gate + Playwright visual baselines at the end.
- Dev server for gates: `pnpm --filter @matter/docs dev`, page `http://localhost:3000/components/aurora`.

---

### Task 0: Reference study (no repo changes)

**Files:** none.

**Interfaces:**
- Consumes: nothing.
- Produces: shared vocabulary for Tasks 2–5 (ray origin/direction, slice, march, extinction, running average).

- [ ] **Step 1: Open the reference together**

User opens `https://www.shadertoy.com/view/XtGGRt` in a browser. Claude walks through the `aurora()` function on screen (do not copy code into the repo):

1. `ro`/`rd` — every pixel gets a ray (origin + direction) from screen coordinates. Pixels whose rays point below the horizon never hit the aurora: the sky-band composition is free.
2. The 50-iteration loop — each iteration intersects the ray with a horizontal plane at an increasing altitude ("slice"). `pow(i, 1.4)` spacing packs slices tightly at the bottom (sharp bright lower edge — the physical signature of a curtain) and spreads them out above (long soft fade).
3. `triNoise2d` — a triangle-wave FBM: cheap, streaky noise whose creases become the curtain filaments. Its per-octave rotation is time-animated: that's the shimmer.
4. Accumulation — each slice's contribution is averaged with the previous (`avgCol`) then added with an exponential decay (`exp2(-i·0.065)`). Averaging softens slice noise into wisps; the decay is atmospheric extinction. **This accumulation is why raymarched auroras read as light, not paint.**
5. The per-iteration `sin(...)` color is a hue ramp keyed on iteration index = altitude. We replace it with Matter's `colorRamp` driven by user stops.

- [ ] **Step 2: Confirm the adaptation differences**

Review with the user what we deliberately do differently: no stars/ground (transparent layer), colors from `colorRamp(altitude)` not a sin ramp, `speed`/`drift`/`turbulence`/`density`/`falloff` as uniforms, direction support, constants re-derived at gates (license + feel).

**GATE 0:** user says go.

---

### Task 1: API cutover with a placeholder band

Everything compiles and renders end-to-end with the NEW props before any raymarching exists. The placeholder is a soft horizon-band gradient — ugly but observable, and it proves stops/ramp/premultiplied wiring.

**Files:**
- Rewrite: `registry/aurora/shader.tsx` (**USER TYPES**)
- Rewrite: `registry/aurora/aurora.tsx` (Claude)
- Rewrite: `apps/docs/src/app/components/aurora/params.ts` (Claude)
- Rewrite: `apps/docs/src/app/components/aurora/scene.tsx` (Claude)
- Rewrite: `apps/docs/src/app/components/aurora/page.tsx` (Claude)

**Interfaces:**
- Consumes: `ColorStop`, `colorStopsKey`, `toColorRampStops` from `registry/utils/color`; `colorRamp`, `ColorSpace`, `HueInterpolation` from `@lovo/matter`; `AnimatableProp`, `useAnimatableUniform`, `useResize`, `useShaderContext` from `@lovo/matter-react`.
- Produces: `AuroraShaderProps` (exact shape below) and `AuroraShader` — every later task edits only the material-graph section inside `shader.tsx`'s effect. `Aurora`/`AuroraProps`/`DEFAULT_STOPS`/`AuroraDirection`/`ColorStop` exported from `registry/aurora/aurora.tsx`.

- [ ] **Step 1 (USER TYPES): replace `registry/aurora/shader.tsx` wholesale**

```tsx
'use client';

import { useEffect, useMemo } from 'react';

import { type ColorSpace, colorRamp, type HueInterpolation } from '@lovo/matter';
import {
  type AnimatableProp,
  useAnimatableUniform,
  useResize,
  useShaderContext,
} from '@lovo/matter-react';
import { smoothstep, uniform, uv, vec4 } from 'three/tsl';
import { Mesh, MeshBasicNodeMaterial, PlaneGeometry } from 'three/webgpu';

import { type ColorStop, colorStopsKey, toColorRampStops } from '../utils/color';

export type AuroraDirection = 'bottom' | 'top' | 'left' | 'right';

/** Raymarch slice count. Provisional `steps` prop while tuning (MAT-46 Task 7 decides its fate). */
export const DEFAULT_STEPS = 40;

export interface AuroraShaderProps {
  stops: ColorStop[];
  intensity: AnimatableProp<number>;
  speed: AnimatableProp<number>;
  drift: AnimatableProp<number>;
  turbulence: AnimatableProp<number>;
  density: AnimatableProp<number>;
  falloff: AnimatableProp<number>;
  direction: AuroraDirection;
  colorSpace: ColorSpace;
  hueInterpolation: HueInterpolation;
  steps: number;
}

export function AuroraShader({
  stops,
  intensity,
  speed,
  drift,
  turbulence,
  density,
  falloff,
  direction,
  colorSpace,
  hueInterpolation,
  steps,
}: AuroraShaderProps) {
  const shaderContext = useShaderContext();
  const resize = useResize();

  const intensityUniform = useAnimatableUniform<number>(intensity);
  const speedUniform = useAnimatableUniform<number>(speed);
  const driftUniform = useAnimatableUniform<number>(drift);
  const turbulenceUniform = useAnimatableUniform<number>(turbulence);
  const densityUniform = useAnimatableUniform<number>(density);
  const falloffUniform = useAnimatableUniform<number>(falloff);

  const [initialWidth, initialHeight] = resize.get();
  const aspectNode = useMemo(
    () => uniform(initialHeight > 0 ? initialWidth / initialHeight : 16 / 9),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    const [canvasWidth, canvasHeight] = resize.get();

    if (canvasWidth > 0 && canvasHeight > 0) aspectNode.value = canvasWidth / canvasHeight;

    return resize.on('change', ([updatedWidth, updatedHeight]) => {
      if (updatedWidth > 0 && updatedHeight > 0) aspectNode.value = updatedWidth / updatedHeight;
    });
  }, [resize, aspectNode]);

  const stopsKey = colorStopsKey(stops);

  useEffect(() => {
    const material = new MeshBasicNodeMaterial();

    material.transparent = true;
    // rgb below is the accumulated curtain light itself (premultiplied), alpha
    // is coverage. Without this flag NormalBlending scales rgb by alpha a
    // second time and everything dims quadratically (MAT-45).
    material.premultipliedAlpha = true;

    const rampStops = toColorRampStops(stops);

    // ── Placeholder graph (replaced by the raymarch in Tasks 2–6) ──────────
    // A soft band: rises quickly above the "horizon" (y ≈ 0.25) and fades out
    // toward the top. Altitude for the ramp is just screen height for now.
    const altitude = uv().y;
    const band = smoothstep(0.22, 0.34, altitude).mul(
      smoothstep(0.4, 0.85, altitude).oneMinus(),
    );

    const rampColor = colorRamp(altitude, rampStops, colorSpace, hueInterpolation);
    const emission = rampColor.mul(band).mul(intensityUniform);
    const coverage = band.mul(0.8);

    material.colorNode = vec4(emission, coverage);
    // ── End placeholder graph ───────────────────────────────────────────────

    const mesh = new Mesh(new PlaneGeometry(2, 2), material);

    shaderContext?.scene.add(mesh);

    return () => {
      shaderContext?.scene.remove(mesh);
      try {
        material.dispose();
      } catch {
        // three/webgpu can throw during dispose under Strict Mode double-invoke
      }
    };
    // stopsKey is a stable string proxy for `stops` — listing the array itself
    // would rebuild on identity-only changes. Stop colors/positions, direction,
    // and steps are baked as literals, so content changes must rebuild.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    shaderContext,
    stopsKey,
    colorSpace,
    hueInterpolation,
    direction,
    steps,
    intensityUniform,
    speedUniform,
    driftUniform,
    turbulenceUniform,
    densityUniform,
    falloffUniform,
    aspectNode,
  ]);

  return null;
}
```

TSL concepts to explain while typing: why `colorRamp` bakes stops as literals (structural vs uniform split), why `premultipliedAlpha` must be set, why `smoothstep(...).oneMinus()` instead of reversed smoothstep edges (reversed edges are undefined behavior in WGSL). Note: `direction`, `steps`, and the speed/drift/turbulence/density/falloff uniforms are wired but unused until Tasks 2–6 — expected; the linter tolerates unused effect deps, and unused *variables* are avoided because every uniform is created and listed.

- [ ] **Step 2 (Claude): replace `registry/aurora/aurora.tsx` wholesale**

```tsx
'use client';

import type { ColorSpace, HueInterpolation } from '@lovo/matter';
import type { AnimatableProp } from '@lovo/matter-react';

import type { ColorStop } from '../utils/color';
import { type AuroraDirection, AuroraShader, DEFAULT_STEPS } from './shader';

export type { AuroraDirection } from './shader';
export type { ColorStop } from '../utils/color';

// Altitude ramp, low → high, in physical emission order: oxygen green at the
// curtain base, teal mid, ionized blue high, pink fringe at the top.
export const DEFAULT_STOPS: ColorStop[] = [
  { color: '#0ae24b', position: 0 }, // palette.green.base
  { color: '#00cda6', position: 0.35 }, // palette.teal.base
  { color: '#1b9fda', position: 0.7 }, // palette.sky.light
  { color: '#e765b8', position: 1 }, // palette.magenta.light
];

export interface AuroraProps {
  stops?: ColorStop[];
  intensity?: AnimatableProp<number>;
  speed?: AnimatableProp<number>;
  drift?: AnimatableProp<number>;
  turbulence?: AnimatableProp<number>;
  density?: AnimatableProp<number>;
  falloff?: AnimatableProp<number>;
  direction?: AuroraDirection;
  colorSpace?: ColorSpace;
  hueInterpolation?: HueInterpolation;
  /** Provisional while tuning (MAT-46): raymarch slice count. */
  steps?: number;
}

export function Aurora({
  stops = DEFAULT_STOPS,
  intensity = 1,
  speed = 1,
  drift = 0.5,
  turbulence = 1,
  density = 1,
  falloff = 1,
  direction = 'bottom',
  colorSpace = 'oklab',
  hueInterpolation = 'shorter',
  steps = DEFAULT_STEPS,
}: AuroraProps) {
  return (
    <AuroraShader
      colorSpace={colorSpace}
      density={density}
      direction={direction}
      drift={drift}
      falloff={falloff}
      hueInterpolation={hueInterpolation}
      intensity={intensity}
      speed={speed}
      steps={steps}
      stops={stops}
      turbulence={turbulence}
    />
  );
}
```

- [ ] **Step 3 (Claude): replace `apps/docs/src/app/components/aurora/params.ts` wholesale**

Per the demo color convention, INITIAL colors are oklch-format strings (color-plus `formatLocked` keys off the initial format), so use `paletteOklch`, not `palette`.

```ts
import type { ColorSpace } from '@lovo/matter';
import type { AuroraDirection } from '@matter/registry/aurora';

import { paletteOklch } from '../../../lib/palette';

export interface PlainColorStop {
  color: string;
  position: number;
}

export interface AuroraParams {
  intensity: number;
  speed: number;
  drift: number;
  turbulence: number;
  density: number;
  falloff: number;
  direction: AuroraDirection;
  colorSpace: ColorSpace;
  steps: number;
  stops: PlainColorStop[];
}

export const MIN_STOPS = 2;
export const MAX_STOPS = 6;

export const INITIAL: AuroraParams = {
  intensity: 1,
  speed: 1,
  drift: 0.5,
  turbulence: 1,
  density: 1,
  falloff: 1,
  direction: 'bottom',
  colorSpace: 'oklab',
  steps: 40,
  stops: [
    { color: paletteOklch.green.base, position: 0 },
    { color: paletteOklch.teal.base, position: 0.35 },
    { color: paletteOklch.sky.light, position: 0.7 },
    { color: paletteOklch.magenta.light, position: 1 },
  ],
};
```

- [ ] **Step 4 (Claude): replace `apps/docs/src/app/components/aurora/scene.tsx` wholesale**

```tsx
'use client';

import type { ReactNode } from 'react';

import { ShaderScene } from '@lovo/matter-react';
import { Aurora, type ColorStop } from '@matter/registry/aurora';

import { type AuroraParams, INITIAL } from './params';

export default function AuroraScene({
  params = INITIAL,
  children,
}: {
  params?: AuroraParams;
  children?: ReactNode;
} = {}) {
  const stops: ColorStop[] = params.stops.map((stop) => ({
    color: stop.color,
    position: stop.position,
  }));

  return (
    <ShaderScene>
      <Aurora
        colorSpace={params.colorSpace}
        density={params.density}
        direction={params.direction}
        drift={params.drift}
        falloff={params.falloff}
        intensity={params.intensity}
        speed={params.speed}
        steps={params.steps}
        stops={stops}
        turbulence={params.turbulence}
      />
      {children}
    </ShaderScene>
  );
}
```

- [ ] **Step 5 (Claude): replace `apps/docs/src/app/components/aurora/page.tsx` wholesale**

Mirrors the linear-gradient page's stop-row pattern (color-plus picker, `formatLocked`, add/remove rows) plus the aurora page's chrome (poster, VisualTestPause, copy buttons).

```tsx
'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';

import { Pane } from 'tweakpane';
import * as TweakpanePluginColorPlus from 'tweakpane-plugin-color-plus';

import { DemoPoster } from '@/components/DemoPoster';
import { addCopyButtons } from '@/lib/paneUtils';
import { VisualTestPause } from '@/lib/visualTestHooks';

import {
  type AuroraParams,
  INITIAL,
  MAX_STOPS,
  MIN_STOPS,
  type PlainColorStop,
} from './params';

const AuroraScene = dynamic(() => import('./scene'), { ssr: false });

const formatNumber = (numericValue: number) => String(Math.round(numericValue * 10000) / 10000);

const formatStops = (stops: PlainColorStop[]) =>
  stops
    .map((stop) => `{ color: '${stop.color}', position: ${formatNumber(stop.position)} }`)
    .join(',\n      ');

const formatJsx = (params: AuroraParams) =>
  `<ShaderScene>
  <Aurora
    intensity={${formatNumber(params.intensity)}}
    speed={${formatNumber(params.speed)}}
    drift={${formatNumber(params.drift)}}
    turbulence={${formatNumber(params.turbulence)}}
    density={${formatNumber(params.density)}}
    falloff={${formatNumber(params.falloff)}}
    direction="${params.direction}"
    colorSpace="${params.colorSpace}"
    stops={[
      ${formatStops(params.stops)},
    ]}
  />
</ShaderScene>`;

const formatParams = (params: AuroraParams) =>
  `{
  intensity: ${formatNumber(params.intensity)},
  speed: ${formatNumber(params.speed)},
  drift: ${formatNumber(params.drift)},
  turbulence: ${formatNumber(params.turbulence)},
  density: ${formatNumber(params.density)},
  falloff: ${formatNumber(params.falloff)},
  direction: '${params.direction}',
  colorSpace: '${params.colorSpace}',
  stops: [
    ${formatStops(params.stops)},
  ],
}`;

export default function AuroraPage() {
  const paneContainerRef = useRef<HTMLDivElement>(null);
  const [params, setParams] = useState<AuroraParams>(() => structuredClone(INITIAL));

  useEffect(() => {
    const container = paneContainerRef.current;

    if (!container) return;

    const local: AuroraParams = structuredClone(INITIAL);
    const pane = new Pane({ container, title: '<Aurora>' });

    // Pre-release wide-gamut color picker (docs-only). The built-in Tweakpane
    // picker is sRGB and rejects oklch()/oklab() strings; color-plus adapts its
    // UI to the bound color's gamut.
    pane.registerPlugin(TweakpanePluginColorPlus);

    const sync = () => setParams(structuredClone(local));

    pane.addButton({ title: 'Reset all' }).on('click', () => {
      Object.assign(local, structuredClone(INITIAL));
      rebuildStops();
      pane.refresh();
      sync();
    });

    addCopyButtons(
      pane,
      () => formatJsx(local),
      () => formatParams(local),
    );

    const globals = pane.addFolder({ title: 'Global' });

    globals.addBinding(local, 'intensity', { min: 0, max: 3, step: 0.01 });
    globals.addBinding(local, 'speed', { min: 0, max: 3, step: 0.01 });
    globals.addBinding(local, 'drift', { min: -3, max: 3, step: 0.01 });
    globals.addBinding(local, 'turbulence', { min: 0, max: 3, step: 0.01 });
    globals.addBinding(local, 'density', { min: 0.25, max: 4, step: 0.01 });
    globals.addBinding(local, 'falloff', { min: 0, max: 2, step: 0.01 });
    globals.addBinding(local, 'direction', {
      label: 'horizon',
      options: { Bottom: 'bottom', Top: 'top', Left: 'left', Right: 'right' },
    });
    globals.addBinding(local, 'colorSpace', {
      label: 'color space',
      options: { oklab: 'oklab', oklch: 'oklch', srgb: 'srgb' },
    });
    // Provisional while tuning (MAT-46 Task 7 decides whether steps ships).
    globals.addBinding(local, 'steps', { min: 10, max: 80, step: 5 });

    pane.addBlade({ view: 'separator' });

    const stopsFolder = pane.addFolder({ title: 'Stops (low → high altitude)' });

    // Tweakpane folders are static; to render variable-length lists we dispose
    // every child of the stops folder and rebuild on each mutation.
    const rebuildStops = () => {
      for (const child of [...stopsFolder.children]) child.dispose();

      local.stops.forEach((stop, stopIndex) => {
        const row = stopsFolder.addFolder({
          title: `Stop ${stopIndex}`,
          expanded: stopIndex === 0,
        });

        // Wide-gamut picker (color-plus). `formatLocked` keeps the written-back
        // value in the bound color's format (oklch here) no matter how the
        // picker is used.
        row.addBinding(stop, 'color', {
          label: 'color',
          view: 'color-plus',
          color: { formatLocked: true },
        });
        row.addBinding(stop, 'position', { min: 0, max: 1, step: 0.01 });

        const removeButton = row.addButton({ title: 'Remove stop' });

        if (local.stops.length <= MIN_STOPS) removeButton.disabled = true;
        removeButton.on('click', () => {
          local.stops.splice(stopIndex, 1);
          rebuildStops();
          sync();
        });
      });

      const addButton = stopsFolder.addButton({ title: '+ Add stop' });

      if (local.stops.length >= MAX_STOPS) addButton.disabled = true;
      addButton.on('click', () => {
        const last = local.stops[local.stops.length - 1];
        // Duplicate the last stop's color so the new stop is visible.
        const nextColor = last?.color ?? 'oklch(0.6 0 0)';

        local.stops.push({ color: nextColor, position: 1 });
        rebuildStops();
        sync();
      });
    };

    rebuildStops();

    pane.on('change', sync);

    return () => {
      pane.dispose();
    };
  }, []);

  return (
    <main style={{ minHeight: '100vh', position: 'relative' }}>
      <div data-shader-demo style={{ position: 'relative', background: '#0b0f1a' }}>
        <DemoPoster
          alt="Aurora shader preview: green and teal light curtains with a blue veil and pink fringe over a dark backdrop"
          src="/posters/aurora.jpg"
        >
          <AuroraScene params={params}>
            <VisualTestPause />
          </AuroraScene>
        </DemoPoster>
        <div
          aria-hidden="true"
          data-tweakpane-host
          ref={paneContainerRef}
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
        <h1 style={{ marginTop: 0 }}>&lt;Aurora /&gt;</h1>
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
          {`<ShaderScene>
  <Aurora intensity={1} stops={[...]} />
</ShaderScene>`}
        </pre>
      </section>
    </main>
  );
}
```

Before committing, compare against `apps/docs/src/app/components/linear-gradient/page.tsx` for the exact `addBinding` option spellings (`view: 'color-plus'`, `color: { formatLocked: true }`), the `registerPlugin` call, and the `colorSpace` option list (the values above are a guess — the engine's `ColorSpace` union is authoritative). If the linear-gradient page differs from the code above, follow the linear-gradient page.

- [ ] **Step 6: Verify**

Run: `pnpm typecheck && pnpm lint` — expect green (8/6 tasks successful).
Run: `pnpm --filter @matter/docs dev`, open `http://localhost:3000/components/aurora`.
Expected: a soft horizontal color band (green low → pink high) over the transparent backdrop; stop rows add/remove/recolor live; sliders move without console errors (most have no visual effect yet — expected).

**GATE 1:** user plays with the stop rows, confirms the API feel.

- [ ] **Step 7: Commit**

```bash
git add registry/aurora apps/docs/src/app/components/aurora
git commit -m "feat(registry)!: replace aurora layers with an altitude stops API

Placeholder band shader; the raymarched volume lands in follow-up commits."
```

---

### Task 2: Camera ray + single-slice field

Replace the placeholder band with a real per-pixel ray and ONE altitude-plane intersection, sampling `simplexNoise` as a stand-in field. Teaches: NDC, rays, plane intersection, the horizon mask.

**Files:**
- Modify: `registry/aurora/shader.tsx` (**USER TYPES**) — only the placeholder-graph section and the `three/tsl` import line.

**Interfaces:**
- Consumes: `AuroraShaderProps` from Task 1.
- Produces: `rayOrigin`, `rayDirection`, `horizonMask` node names reused verbatim by Tasks 4–6.

- [ ] **Step 1 (USER TYPES): update the `three/tsl` import**

```tsx
import { clamp, float, normalize, smoothstep, uniform, uv, vec2, vec3, vec4 } from 'three/tsl';
```

Also add `simplexNoise` to the `@lovo/matter` import:

```tsx
import { type ColorSpace, colorRamp, type HueInterpolation, simplexNoise } from '@lovo/matter';
```

- [ ] **Step 2 (USER TYPES): replace the placeholder-graph section**

Everything between the `── Placeholder graph` and `── End placeholder graph` comments becomes:

```tsx
    // ── Aurora graph ────────────────────────────────────────────────────────
    // Screen position → normalized device coords: center-origin, x scaled by
    // aspect so ribbons don't stretch on wide canvases.
    const ndcX = uv().x.sub(0.5).mul(2).mul(aspectNode);
    const ndcY = uv().y.sub(0.5).mul(2);

    // Virtual camera: sits below the aurora looking toward the horizon (+z),
    // biased slightly upward so the band occupies the upper frame.
    const rayOrigin = vec3(0, 0, -6.7);
    const rayDirection = normalize(vec3(ndcX, ndcY.mul(0.8).add(0.25), 1.4));

    // One horizontal slice at the curtain-base altitude. The bent divisor
    // (rd.y·2 + 0.4 instead of plain rd.y) fakes atmospheric curvature: rays
    // that graze the horizon hit at a finite distance instead of infinity, so
    // the sheet bends down toward the horizon line.
    const sliceAltitude = float(0.9);
    const marchDistance = sliceAltitude.sub(rayOrigin.y).div(rayDirection.y.mul(2).add(0.4));
    const samplePoint = rayOrigin.add(rayDirection.mul(marchDistance));

    // Sample the field on the ground plane: z runs toward the horizon,
    // x runs across the screen.
    const groundCoords = vec2(samplePoint.z, samplePoint.x).mul(densityUniform);
    const fieldValue = simplexNoise(groundCoords).mul(0.5).add(0.5);

    // Rays pointing below the horizon never hit the sky — fade them out fast.
    const horizonMask = clamp(rayDirection.y.mul(15).add(0.4), 0, 1);

    const brightness = fieldValue.mul(horizonMask);

    // Fixed-altitude tint (the ramp's curtain-base green) until Task 5 drives
    // the ramp per-slice. Keeps the ramp plumbing live through Tasks 2–4.
    const sliceColor = colorRamp(float(0.15), rampStops, colorSpace, hueInterpolation);

    material.colorNode = vec4(sliceColor.mul(brightness), brightness);
    // ── End aurora graph ────────────────────────────────────────────────────
```

Note: the intensity uniform intentionally drops out of the graph this task; it returns in Task 5.

TSL concepts to explain while typing: what a ray is, why dividing altitude by `rayDirection.y` finds the plane hit, why the bent divisor curves the sheet, why gotcha 12 doesn't bite here (uniforms only appear as `.mul(...)`/`.add(...)` arguments).

- [ ] **Step 3: Verify**

Dev server still running; page hot-reloads.
Expected: a green-tinted noise sheet in perspective — large blobs overhead compressing toward a horizon line in the lower third; pure transparency below the horizon. `density` now visibly scales the pattern.

**GATE 2:** user confirms the perspective reads correctly and plays with density.

- [ ] **Step 4: Commit**

```bash
git add registry/aurora/shader.tsx
git commit -m "feat(registry): aurora camera ray and single-slice field"
```

---

### Task 3: Triangle-noise FBM field

Swap the simplex stand-in for the streaky triangle-wave FBM that gives curtains their filaments, and wire `speed` (shimmer) + `turbulence` (warp).

**Files:**
- Modify: `registry/aurora/shader.tsx` (**USER TYPES**) — add module-scope helpers, replace the field sampling lines.

**Interfaces:**
- Consumes: `groundCoords` from Task 2.
- Produces: `triangleField(coords, shimmerPhase, warpStrength)` — exact signature reused in Task 4's loop.

- [ ] **Step 1 (USER TYPES): update imports**

Remove `simplexNoise` from the `@lovo/matter` import; add `elapsedTime`:

```tsx
import { type ColorSpace, colorRamp, elapsedTime, type HueInterpolation } from '@lovo/matter';
```

Extend the `three/tsl` import:

```tsx
import {
  abs,
  clamp,
  cos,
  float,
  fract,
  normalize,
  sin,
  smoothstep,
  uniform,
  uv,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import type { ShaderNodeObject } from 'three/tsl';
import { Mesh, MeshBasicNodeMaterial, PlaneGeometry, type Node } from 'three/webgpu';
```

(If `type Node` fails to import from `three/webgpu`, use `import type { Node } from 'three/webgpu';` as a separate line.)

- [ ] **Step 2 (USER TYPES): add module-scope helpers above `AuroraShader`**

```tsx
type TSLValue = ShaderNodeObject<Node>;

/**
 * Triangle wave of x in [0.01, 0.49]. Where simplex is billowy, the triangle
 * wave has straight slopes and sharp creases — the creases become the curtain
 * filaments.
 */
const triangleWave = (value: TSLValue): TSLValue => fract(value).sub(0.5).abs().clamp(0.01, 0.49);

/** Rotate a vec2 by an angle without mat2 — keeps everything a plain chain. */
const rotate2d = (point: TSLValue, angle: TSLValue): TSLValue =>
  vec2(
    point.x.mul(cos(angle)).sub(point.y.mul(sin(angle))),
    point.x.mul(sin(angle)).add(point.y.mul(cos(angle))),
  );

/**
 * Streaky FBM built from triangle waves: five octaves, each rotated and
 * domain-warped by the previous. `shimmerPhase` rotates the warp over time
 * (the aurora shimmer); `warpStrength` scales the warp (turbulence).
 * Returns a field value in [0, 0.55] whose reciprocal shaping concentrates
 * brightness into thin filaments.
 */
const triangleField = (
  coords: TSLValue,
  shimmerPhase: TSLValue,
  warpStrength: TSLValue,
): TSLValue => {
  let sampleCoords = rotate2d(coords, coords.x.mul(0.06));
  let octaveCoords = sampleCoords;
  let fieldSum: TSLValue = float(0);
  let amplitude = 1.8;
  let warpDivisor = 2.5;

  for (let octave = 0; octave < 5; octave += 1) {
    const ridge = rotate2d(
      vec2(
        triangleWave(octaveCoords.x).add(triangleWave(octaveCoords.y)),
        triangleWave(octaveCoords.y.add(triangleWave(octaveCoords.x))),
      ).mul(0.75),
      shimmerPhase,
    );

    sampleCoords = sampleCoords.sub(ridge.div(warpDivisor).mul(warpStrength));
    sampleCoords = sampleCoords.mul(1.21);
    octaveCoords = octaveCoords.mul(1.3);
    warpDivisor *= 0.45;
    amplitude *= 0.42;

    fieldSum = fieldSum.add(
      triangleWave(sampleCoords.x.add(triangleWave(sampleCoords.y))).mul(amplitude),
    );

    sampleCoords = rotate2d(sampleCoords, float(-0.3)).negate();
  }

  return float(1).div(fieldSum.mul(29).pow(1.3)).clamp(0, 0.55);
};
```

TSL concepts to explain: FBM (stacked octaves at rising frequency/falling amplitude), domain warping (feeding noise its own output as an offset), why the JS `for` loop unrolls at graph-build time (5 octaves are structural, unlike the GPU-side march loop coming in Task 4), and why `amplitude`/`warpDivisor` stay plain JS numbers (compile-time literals, not nodes).

- [ ] **Step 3 (USER TYPES): swap the field sample inside the effect**

Replace the `fieldValue` line from Task 2 with:

```tsx
    const shimmerPhase = elapsedTime.mul(speedUniform).mul(0.06);
    const fieldValue = triangleField(groundCoords, shimmerPhase, turbulenceUniform);
```

- [ ] **Step 4: Verify**

Expected: the sheet is now streaky filaments instead of blobs; `speed` animates a slow shimmer; `turbulence` at 0 gives calm straight streaks, at 3 chaotic swirls; `density` scales ribbon frequency.

**GATE 3:** user feels speed/turbulence/density on the single sheet. This is the moment to tune the FBM constants (1.85→ridge scale, 0.75, 29, 1.3 exponent) by eye if the character is off.

- [ ] **Step 5: Commit**

```bash
git add registry/aurora/shader.tsx
git commit -m "feat(registry): triangle-wave fbm curtain field"
```

---

### Task 4: The march

Turn one slice into a GPU-side loop over ~40 slices with pow-spaced altitudes, running-average softening, exponential extinction, and per-pixel jitter. Still single-hue (the per-slice ramp lands in Task 5). This is the task where "solid" dies.

**Files:**
- Modify: `registry/aurora/shader.tsx` (**USER TYPES**) — wrap the graph in `Fn`, add the loop.

**Interfaces:**
- Consumes: `rayOrigin`, `rayDirection`, `horizonMask`, `triangleField`, `shimmerPhase` from Tasks 2–3.
- Produces: `accumulated` (vec4 var: rgb emission sum, a coverage sum) consumed by Task 5's output shaping; `stepIndex`/`STEP_COUNT` naming for the ramp.

- [ ] **Step 1 (USER TYPES): extend the `three/tsl` import**

```tsx
import {
  Fn,
  Loop,
  abs,
  clamp,
  cos,
  dot,
  exp2,
  float,
  fract,
  mix,
  normalize,
  screenCoordinate,
  sin,
  smoothstep,
  uniform,
  uv,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
```

- [ ] **Step 2 (USER TYPES): restructure the graph into an `Fn` and march**

Replace the aurora-graph section (from `── Aurora graph` to `── End aurora graph`, keeping `rampStops`) with:

```tsx
    // ── Aurora graph ────────────────────────────────────────────────────────
    const stepCount = steps;

    const auroraNode = Fn(() => {
      const ndcX = uv().x.sub(0.5).mul(2).mul(aspectNode);
      const ndcY = uv().y.sub(0.5).mul(2);

      const rayOrigin = vec3(0, 0, -6.7);
      const rayDirection = normalize(vec3(ndcX, ndcY.mul(0.8).add(0.25), 1.4));

      const shimmerPhase = elapsedTime.mul(speedUniform).mul(0.06);

      // Fixed-altitude tint until Task 5 drives the ramp per-slice.
      const sliceColor = colorRamp(float(0.15), rampStops, colorSpace, hueInterpolation);

      // Screen-space hash: decorrelates the slice offsets pixel-to-pixel so
      // the march's discrete slices dissolve into grain instead of banding.
      const screenHash = fract(
        sin(dot(screenCoordinate.xy, vec2(12.9898, 4.1414))).mul(43758.5453),
      );

      // Accumulators must be GPU-side variables (`toVar`) because the loop
      // below runs on the GPU — a JS variable can't change per iteration there.
      const accumulated = vec4(0).toVar();
      const runningAverage = vec4(0).toVar();

      Loop(stepCount, ({ i }) => {
        const stepIndex = float(i);

        // Ramp the jitter in over the first steps — the lowest slices form
        // the curtain's sharp bottom edge and shouldn't be blurred.
        const jitter = screenHash.mul(0.006).mul(smoothstep(0, 15, stepIndex));

        // Slice altitudes: pow(i, 1.4) packs slices tightly at the base
        // (sharp bright lower border) and spreads them out with height
        // (long soft fade upward).
        const sliceAltitude = stepIndex.pow(1.4).mul(0.002).add(0.8);
        const marchDistance = sliceAltitude
          .sub(rayOrigin.y)
          .div(rayDirection.y.mul(2).add(0.4))
          .sub(jitter);
        const samplePoint = rayOrigin.add(rayDirection.mul(marchDistance));
        const groundCoords = vec2(samplePoint.z, samplePoint.x).mul(densityUniform);

        const fieldValue = triangleField(groundCoords, shimmerPhase, turbulenceUniform);

        const slice = vec4(sliceColor.mul(fieldValue), fieldValue);

        // Average-then-accumulate: blending each slice into a running average
        // before adding smears slice-to-slice noise into continuous wisps.
        runningAverage.assign(mix(runningAverage, slice, 0.5));

        // Atmospheric extinction: each successive slice contributes
        // exponentially less. smoothstep suppresses the first few slices,
        // which otherwise read as a hard floor.
        const extinction = exp2(stepIndex.mul(-0.065).sub(2.5));

        accumulated.addAssign(runningAverage.mul(extinction).mul(smoothstep(0, 5, stepIndex)));
      });

      const horizonMask = clamp(rayDirection.y.mul(15).add(0.4), 0, 1);

      const emission = accumulated.rgb.mul(horizonMask).mul(1.8);
      const coverage = accumulated.a.mul(horizonMask).mul(1.5).clamp(0, 1);

      return vec4(emission.max(0), coverage);
    })();

    material.colorNode = auroraNode;
    // ── End aurora graph ────────────────────────────────────────────────────
```

TSL concepts to explain while typing: `Fn` gives the graph a *statement* context (expressions describe dataflow; `Loop`/`toVar`/`assign` emit statements and need a function body); why the loop count is a baked literal (structural — changing `steps` recompiles, which is why it's in the effect deps); `addAssign`/`assign` vs `=`.

- [ ] **Step 3: Verify**

Expected: green volumetric curtains — sharp bright lower edges, wispy tops, and visible parallax between near and far ribbons in the static perspective (drift animation arrives in Task 6). Drag `steps` from 10 → 80: banding at low counts dissolves by ~40. Watch for the two classic mistakes: all-black output (accumulators declared outside `Fn`) and single-slice look (assignment instead of `addAssign`).

Perf check: page should hold 60 fps fullscreen on the dev machine at steps=40. If it doesn't, drop to 30 and note it for Task 7.

**GATE 4:** the money gate — user confirms "solid" is gone; feel the steps/quality curve.

- [ ] **Step 4: Commit**

```bash
git add registry/aurora/shader.tsx
git commit -m "feat(registry): raymarch the aurora volume"
```

---

### Task 5: Altitude color ramp + output shaping

Color returns: each slice is tinted by `colorRamp(altitude)` from the user's stops, `falloff` shapes the vertical extent, `intensity` scales the output.

**Files:**
- Modify: `registry/aurora/shader.tsx` (**USER TYPES**) — three lines inside the loop, two after it.

**Interfaces:**
- Consumes: `accumulated`, `stepIndex`, `stepCount`, `rampStops` from earlier tasks.
- Produces: the final output contract (premultiplied vec4) — unchanged from here on.

- [ ] **Step 1 (USER TYPES): tint slices by altitude**

Delete the fixed-altitude `sliceColor` line above the loop, and inside the loop replace the `slice` line with:

```tsx
        // Altitude in [0, 1] drives the user's color ramp — the physical
        // green-low → pink-high stratification.
        const altitude = stepIndex.div(stepCount);
        const sliceColor = colorRamp(altitude, rampStops, colorSpace, hueInterpolation);
        const slice = vec4(sliceColor.mul(fieldValue), fieldValue);
```

- [ ] **Step 2 (USER TYPES): wire falloff and intensity**

Replace the `extinction` line with (falloff scales how fast slices die with height — the band's vertical extent):

```tsx
        const extinction = exp2(stepIndex.mul(-0.065).mul(falloffUniform).sub(2.5));
```

Replace the `emission` line after the loop with:

```tsx
      const emission = accumulated.rgb.mul(horizonMask).mul(1.8).mul(intensityUniform);
```

- [ ] **Step 3: Verify**

Expected: the full aurora — green curtain bases, teal mid, blue veil, pink tips. Stop rows recolor live (material rebuild per change — acceptable, not 60Hz). `falloff` 0 → tall towering curtains, 2 → a thin band hugging the horizon. `colorSpace` toggle subtly changes the ramp blends. Transparency intact: `#0b0f1a` shows through between ribbons.

Compare side-by-side against the pre-rebuild look (`git stash` is not available across branches — open the production docs site or a screenshot of the old demo instead).

**GATE 5:** the vibrancy verdict — does this beat both the old aurora AND the Task-1-through-4 iterations? Tune the 1.8 emission gain, 1.5 coverage gain, and 0.55 field clamp here if needed.

- [ ] **Step 4: Commit**

```bash
git add registry/aurora/shader.tsx
git commit -m "feat(registry): altitude color ramp and output shaping"
```

---

### Task 6: Drift animation + direction support

**Files:**
- Modify: `registry/aurora/shader.tsx` (**USER TYPES**)

**Interfaces:**
- Consumes: everything prior.
- Produces: final shader; `direction` remaps which edge hosts the horizon.

- [ ] **Step 1 (USER TYPES): wire drift**

Inside the loop, replace the `groundCoords` line with:

```tsx
        // Drift slides the field across the band (world x = screen horizontal).
        const groundCoords = vec2(
          samplePoint.z,
          samplePoint.x.add(elapsedTime.mul(driftUniform).mul(0.2)),
        ).mul(densityUniform);
```

- [ ] **Step 2 (USER TYPES): direction remap**

Above the component, add:

```tsx
/**
 * Remap screen uv so the shader's internal "horizon at the bottom, altitude
 * increasing up" frame lands on the requested edge. Left/right also swap
 * which axis carries the aspect correction.
 */
const DIRECTION_REMAPS: Record<
  AuroraDirection,
  (screenUv: TSLValue) => { across: TSLValue; up: TSLValue; swapAspect: boolean }
> = {
  bottom: (screenUv) => ({ across: screenUv.x, up: screenUv.y, swapAspect: false }),
  top: (screenUv) => ({ across: screenUv.x, up: screenUv.y.oneMinus(), swapAspect: false }),
  left: (screenUv) => ({ across: screenUv.y, up: screenUv.x, swapAspect: true }),
  right: (screenUv) => ({ across: screenUv.y, up: screenUv.x.oneMinus(), swapAspect: true }),
};
```

Inside the `Fn`, replace the `ndcX`/`ndcY` lines with:

```tsx
      const { across, up, swapAspect } = DIRECTION_REMAPS[direction](uv());
      const aspectAcross = swapAspect ? aspectNode.reciprocal() : aspectNode;
      const ndcX = across.sub(0.5).mul(2).mul(aspectAcross);
      const ndcY = up.sub(0.5).mul(2);
```

Note `direction` is a baked structural choice (already in the effect deps from Task 1), so toggling it rebuilds the material — same class as stop changes, fine at non-interactive frequency.

- [ ] **Step 3: Verify**

Expected: `drift` slides ribbons horizontally (negative reverses); `direction` toggles relocate the horizon to each edge with correct aspect (no stretching in left/right). Everything else unchanged.

**GATE 6:** user sweeps every control. This is also the moment to judge the `drift` name against its now-visible effect (open question from the spec) — note the verdict for Task 7.

- [ ] **Step 4: Commit**

```bash
git add registry/aurora/shader.tsx
git commit -m "feat(registry): aurora drift animation and direction support"
```

---

### Task 7: Tune, decide open questions, ship prep

**Files:**
- Modify: `registry/aurora/aurora.tsx`, `registry/aurora/shader.tsx` (**USER TYPES** for shader.tsx), `apps/docs/src/app/components/aurora/params.ts`, `apps/docs/src/app/components/aurora/page.tsx`
- Regenerate: `apps/docs/public/posters/aurora.jpg`, Playwright visual baselines

**Interfaces:**
- Consumes: the finished shader.
- Produces: shippable branch.

- [ ] **Step 1: Tuning session (user drives)**

User settles final defaults in the pane; copy the agreed values into `DEFAULT_STOPS` + the `Aurora` defaults (`aurora.tsx`) and `INITIAL` (`params.ts`). If the FBM/extinction constants changed at gates 3–5, they're already committed.

- [ ] **Step 2: Decide `steps` prop (spec open question)**

- Keep: delete the "Provisional" comments in `aurora.tsx` and `shader.tsx`; keep the demo binding.
- Cut: remove `steps` from `AuroraProps`/`AuroraShaderProps`/`AuroraParams`/scene/page bindings; in `shader.tsx` use `const stepCount = DEFAULT_STEPS;` and drop `steps` from the effect deps.

- [ ] **Step 3: Decide `drift` name (spec open question)**

If the user renames (e.g. `flow`, `wind`): rename the prop across `aurora.tsx`, `shader.tsx`, `params.ts`, `scene.tsx`, `page.tsx` (formatJsx/formatParams included).

- [ ] **Step 4: Stale-reference sweep**

Run: `grep -rn "AuroraLayer\|DEFAULT_LAYERS\|densityX\|densityY\|driftX\|driftY" --include="*.ts" --include="*.tsx" --include="*.md" registry apps packages docs README.md 2>/dev/null | grep -v superpowers`
Expected: no hits outside historical specs/plans. Fix any (CLI wire-up snippets and docs prose are the likely stragglers).

- [ ] **Step 5: Changeset**

Registry work ships through changesets (the waves per-layer registry release did — `git show 37a8b9c --stat` shows which packages that release bumped; mirror it). Add `.changeset/aurora-raymarch-rebuild.md` with a minor bump (pre-1.0 breaking convention) noting: `layers` removed in favor of the altitude `stops` ramp, `colorSpace`/`hueInterpolation` added, `driftX`/`driftY` → `drift`, `densityX`/`densityY` → `density`. No dependency changes, so `pnpm-lock.yaml` stays untouched.

- [ ] **Step 6: Poster + visual baselines**

On pinned Node 22 (`fnm use 22`), Docker running:

```bash
pnpm posters   # regenerates apps/docs/public/posters/ including aurora.jpg
pnpm snap      # regenerates Playwright visual baselines
pnpm test:visual
```

Expected: test:visual green against the new baselines. Update the page `alt` text if the final look diverges from "green and teal light curtains with a blue veil and pink fringe".

- [ ] **Step 7: Full verify + docs touch-ups**

Run: `pnpm build && pnpm typecheck && pnpm lint && pnpm format:check && pnpm test`
Expected: all green.
Update `CLAUDE.md` milestone table (add MAT-46 row) and the spec's status line.

**GATE 7:** final sign-off on the branch.

- [ ] **Step 8: PR**

Use superpowers:finishing-a-development-branch. PR per the user's style memories: concise, lead with why, no Test-plan/Follow-ups sections, no planning-artifact links, no Claude attribution, humanizer pass on the prose. Note the stacked base: MAT-45's branch merges first.

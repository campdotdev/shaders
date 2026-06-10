# Per-Layer `<Waves>` API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current global-only `<Waves>` prop surface with a per-layer API. `layers: WaveLayer[]` drives the loop; each `WaveLayer` provides optional overrides for `color`, `amplitude`, `frequency`, `speed`, and `phase` that fall back to top-level globals.

**Architecture:** Mirror the `<LinearGradient>` pattern at `apps/docs/src/app/components/linear-gradient/page.tsx` + `registry/linear-gradient/shader.tsx`. Per-layer values bake as JS literals into the TSL graph; the wrapper computes a `layersKey` (stringified summary) used in the shader `useEffect`'s deps to trigger material rebuild on any change. Docs page mirrors LinearGradient's `rebuildStops` Tweakpane folder pattern.

**Tech Stack:** TypeScript 5 strict, React 19, three 0.170 (`three/webgpu` + `three/tsl`), `@lovo/matter` engine + `@lovo/matter-react` (`useAnimatableUniform`, `useShaderContext`), Tweakpane on the docs page.

**Source spec:** `docs/superpowers/specs/2026-06-10-per-layer-waves-api-design.md`

---

## File Structure

**Modified files (no new files created):**

- `registry/waves/shader.tsx` — `WavesShaderProps` accepts `layers: WaveLayer[]`; the `for` loop iterates the array, per-layer fields resolve to either JS literals or global uniforms; `independenceUniform` + `driftUniform` hooks + their deps array entries removed; `layersKey` stable proxy added to deps.
- `registry/waves/waves.tsx` — `WavesProps` reshaped (`layers?: WaveLayer[]` instead of `layers?: number`; `independence?`, `drift?` removed); `WaveLayer` interface + `DEFAULT_LAYERS` constant exported from this file; wrapper forwards `layers` (defaulting to `DEFAULT_LAYERS`) to `<WavesShader>`.
- `apps/docs/src/app/components/waves/page.tsx` — full rewrite of Tweakpane setup, copy-adapted from `linear-gradient/page.tsx`. Layers folder with per-layer sub-folders, Add/Remove buttons, copy-buttons for JSX/params snippets.
- `apps/docs/src/app/dev/reduced-motion/ReducedMotionDemo.tsx` — single line change: `<Waves amplitude={0.1} color="#77eecc" frequency={5} layers={3} speed={1} />` → `<Waves />` (use defaults; the demo's point is reduced-motion behavior, not visual specifics).
- `registry/registry.json` — update `waves` entry: `description` references per-layer API; `uses_primitives` adds `float` if used (we end up not needing it — see Task 1.3).
- `apps/docs-tests/visual/waves.spec.ts-snapshots/waves-default-chromium-darwin.png` — rebaselined for new 4-layer cool-ocean default.

---

## Phase 1 — Engine rewrite + minimal docs page

**Behavioral goal:** the new `WaveLayer[]` API works end-to-end. Docs page renders the 4-layer cool-ocean default but without the new per-layer Tweakpane UI (that's Phase 2). Global sliders still work for live tweaking of unset fields. Reduced-motion demo still works.

**Stop gate:** dev server at `/components/waves` shows the new 4-layer default. Global sliders (amplitude/frequency/speed/glow/baseline) still adjust the look (since none of the default layers override these fields). `/dev/reduced-motion` still renders waves. Visual regression *will* fail (default look is different); leave snapshot stale until Phase 3.

### Task 1.1: Define `WaveLayer` + `DEFAULT_LAYERS` in `waves.tsx`

**Files:**
- Modify: `registry/waves/waves.tsx`

- [ ] **Step 1: Replace the file with the new API shape**

Full new contents of `registry/waves/waves.tsx`:

```tsx
'use client';

import type { AnimatableProp } from '@lovo/matter-react';

import { WavesShader } from './shader';

export interface WaveLayer {
  color?: string;
  amplitude?: number;
  frequency?: number;
  speed?: number;
  phase?: number;
}

export interface WavesProps {
  layers?: WaveLayer[];

  // globals — fallback values for per-layer fields when unset
  color?: string;
  amplitude?: AnimatableProp<number>;
  frequency?: AnimatableProp<number>;
  speed?: AnimatableProp<number>;

  // pure globals (not per-layer)
  glow?: AnimatableProp<number>;
  baseline?: AnimatableProp<number>;
}

// Default layer set: teal → cyan → sky cool-ocean progression with auto-spread
// phases. Hue span ~60°, well inside the design system's ~120° guideline.
export const DEFAULT_LAYERS: WaveLayer[] = [
  { color: '#77ebce', phase: 0 }, // palette.teal.light
  { color: '#00cda6', phase: 1 / 7 }, // palette.teal.base
  { color: '#009eaf', phase: 2 / 7 }, // palette.cyan.base
  { color: '#007bc6', phase: 3 / 7 }, // palette.sky.base
];

export function Waves({
  layers = DEFAULT_LAYERS,
  color = '#77ebce', // palette.teal.light — fallback for layers without color set
  amplitude = 0.07,
  frequency = 1,
  speed = 1,
  glow = 1,
  baseline = 0.1,
}: WavesProps) {
  return (
    <WavesShader
      amplitude={amplitude}
      baseline={baseline}
      color={color}
      frequency={frequency}
      glow={glow}
      layers={layers}
      speed={speed}
    />
  );
}
```

- [ ] **Step 2: Quick typecheck (will fail until shader is updated; that's expected)**

Run: `pnpm --filter @matter/registry typecheck`
Expected: errors referencing `WavesShader` not accepting the new `layers` shape, and references to removed props (`independence`, `drift`). Task 1.2 fixes these.

### Task 1.2: Rewrite `WavesShader` to consume `WaveLayer[]`

**Files:**
- Modify: `registry/waves/shader.tsx`

- [ ] **Step 1: Replace the file with the new shader implementation**

Full new contents of `registry/waves/shader.tsx`:

```tsx
'use client';

import { useEffect, useMemo } from 'react';

import { time } from '@lovo/matter';
import { type AnimatableProp, useAnimatableUniform, useShaderContext } from '@lovo/matter-react';
import { cos, type ShaderNodeObject, uv, vec2, vec3, vec4 } from 'three/tsl';
import { Mesh, MeshBasicNodeMaterial, type Node, PlaneGeometry } from 'three/webgpu';

import { parseHex } from '../utils/color';
import type { WaveLayer } from './waves';

export interface WavesShaderProps {
  layers: WaveLayer[];
  color: string;
  amplitude: AnimatableProp<number>;
  frequency: AnimatableProp<number>;
  speed: AnimatableProp<number>;
  glow: AnimatableProp<number>;
  baseline: AnimatableProp<number>;
}

// Pseudo-random 1D signal: sum of three cosines at coprime-ish frequencies
// averaged to [-1, 1]. Feels organic and non-repeating over short windows.
const wobble = (t: ShaderNodeObject<Node>) =>
  cos(t)
    .add(cos(t.mul(1.3).add(1.3)))
    .add(cos(t.mul(1.4).add(1.4)))
    .div(3);

export function WavesShader(props: WavesShaderProps) {
  const ctx = useShaderContext();

  const color = useMemo(() => parseHex(props.color), [props.color]);

  const ampUniform = useAnimatableUniform<number>(props.amplitude);
  const freqUniform = useAnimatableUniform<number>(props.frequency);
  const speedUniform = useAnimatableUniform<number>(props.speed);
  const glowUniform = useAnimatableUniform<number>(props.glow);
  const baselineUniform = useAnimatableUniform<number>(props.baseline);

  // Stable stringified proxy of the layers array — used in deps to trigger
  // material rebuild on any per-layer change. Mirrors LinearGradient's
  // colorsKey/stopsKey pattern (see registry/linear-gradient/shader.tsx).
  const layersKey = props.layers
    .map(
      (l) =>
        `${l.color ?? ''}|${l.amplitude ?? ''}|${l.frequency ?? ''}|${l.speed ?? ''}|${l.phase ?? ''}`,
    )
    .join('||');

  useEffect(() => {
    if (!ctx) return;

    const [globalCr, globalCg, globalCb] = color;

    const p = vec2(uv().x.mul(2).sub(1), uv().y.mul(2).sub(1));

    let yRunning = p.y.add(baselineUniform);
    let waveColor = vec3(0, 0, 0);

    for (let i = 0; i < props.layers.length; i += 1) {
      const layer = props.layers[i]!;

      // Per-layer overrides bake as JS literals; unset fields use the
      // shared global uniform node. TSL .mul/.add accept both numbers and
      // nodes via NodeRepresentation, so no float() wrapper needed.
      const ampValue = layer.amplitude ?? ampUniform;
      const freqValue = layer.frequency ?? freqUniform;
      const speedValue = layer.speed ?? speedUniform;
      const phase = layer.phase ?? 0;

      const [cr, cg, cb] = layer.color !== undefined ? parseHex(layer.color) : [globalCr, globalCg, globalCb];

      const layerTime = time.mul(speedValue);

      yRunning = yRunning.add(
        wobble(p.x.mul(freqValue).add(phase).add(layerTime)).mul(ampValue),
      );

      const width = yRunning.mul(150).abs().reciprocal().mul(glowUniform);

      waveColor = waveColor.add(vec3(width.mul(cr), width.mul(cg), width.mul(cb)));
    }

    const material = new MeshBasicNodeMaterial();

    material.colorNode = vec4(waveColor, 1);

    const mesh = new Mesh(new PlaneGeometry(2, 2), material);

    ctx.scene.add(mesh);

    return () => {
      ctx.scene.remove(mesh);

      try {
        material.dispose();
      } catch {
        /* benign during rebuild */
      }
      try {
        mesh.geometry.dispose();
      } catch {
        /* same */
      }
    };
    // layersKey is a stable string proxy for props.layers — listing the
    // array itself would trigger rebuild on identity-only changes. Matches
    // LinearGradient's pattern.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    ctx,
    layersKey,
    color,
    ampUniform,
    freqUniform,
    speedUniform,
    glowUniform,
    baselineUniform,
  ]);

  return null;
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @matter/registry typecheck`
Expected: clean.

### Task 1.3: Strip docs page of removed bindings, pass no `layers` prop

**Files:**
- Modify: `apps/docs/src/app/components/waves/page.tsx`

This task makes the docs page **compile** with the new API but keeps the Tweakpane UI minimal. The full per-layer UI lands in Phase 2. For Phase 1, we just need to remove references to dropped props (`independence`, `drift`, `layers: number`) and let the new defaults render.

- [ ] **Step 1: Replace the Params interface + INITIAL + tweakpane callback**

In `apps/docs/src/app/components/waves/page.tsx`, replace the `interface Params { … }` block + `INITIAL` + the tweakpane callback (between `useTweakpane<Params>(` and the closing `)`) with:

```tsx
interface Params {
  color: string;
  amplitude: number;
  frequency: number;
  speed: number;
  glow: number;
  baseline: number;
}

const INITIAL: Params = {
  color: palette.teal.light,
  amplitude: 0.07,
  frequency: 1,
  speed: 1,
  glow: 1,
  baseline: 0.1,
};

export default function WavesPage() {
  const [params, paneContainerRef] = useTweakpane<Params>(
    '<Waves>',
    INITIAL,
    (pane, local, sync) => {
      pane.addBinding(local, 'color');
      pane.addBlade({ view: 'separator' });
      pane.addBinding(local, 'amplitude', { min: 0, max: 0.3, step: 0.005 });
      pane.addBinding(local, 'frequency', { min: 0.1, max: 10, step: 0.05 });
      pane.addBinding(local, 'speed', { min: 0, max: 4, step: 0.05 });
      pane.addBinding(local, 'glow', { min: 0, max: 3, step: 0.01 });
      pane.addBinding(local, 'baseline', { min: -1, max: 1, step: 0.01 });
      pane.on('change', sync);
    },
  );
```

> `pane.on('change', sync)` propagates each Tweakpane edit from the internal `local` mutable object into the React `params` state. Without it, the visual wouldn't update on slider drags. (No layers-related Apply button anymore — that pattern is gone with the `layers: number` slider it used to gate.)

- [ ] **Step 2: Update the `<Waves>` JSX inside `<ShaderScene>` — drop removed props, don't pass `layers`**

Replace the `<Waves ... />` JSX block with:

```tsx
<Waves
  amplitude={params.amplitude}
  baseline={params.baseline}
  color={params.color}
  frequency={params.frequency}
  glow={params.glow}
  speed={params.speed}
/>
```

`layers` is intentionally omitted — the wrapper supplies `DEFAULT_LAYERS`.

- [ ] **Step 3: Update the inline code block at the bottom of the page**

Replace the inline code block:

```tsx
{`<ShaderScene>
  <Waves />
</ShaderScene>`}
```

Phase 2 will replace this with a live-formatted snippet driven by tweakpane state. For Phase 1, the minimal example matches the default.

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @matter/docs typecheck`
Expected: clean.

### Task 1.4: Update reduced-motion demo

**Files:**
- Modify: `apps/docs/src/app/dev/reduced-motion/ReducedMotionDemo.tsx`

- [ ] **Step 1: Replace the `<Waves … />` JSX**

In `apps/docs/src/app/dev/reduced-motion/ReducedMotionDemo.tsx`, find the `<Waves amplitude={0.1} color="#77eecc" frequency={5} layers={3} speed={1} />` JSX block and replace with:

```tsx
<Waves />
```

The demo's purpose is reduced-motion behavior, not waves visual specifics. Defaults are fine.

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @matter/docs typecheck`
Expected: clean.

### Task 1.5: Verify Phase 1 end-to-end

- [ ] **Step 1: Full typecheck**

Run: `pnpm typecheck`
Expected: all packages clean.

- [ ] **Step 2: Lint affected packages**

Run: `pnpm --filter @matter/registry lint && pnpm --filter @matter/docs lint`
Expected: clean.

- [ ] **Step 3: Format**

Run: `pnpm format`

- [ ] **Step 4: Manual dev-server validation (STOP GATE)**

Run: `pnpm --filter @matter/docs dev` (if not still running)
Open: `http://localhost:3000/components/waves`

Expected behavior:
- 4 layers visible by default — teal → cyan → sky cool progression.
- Global sliders all responsive: amplitude/frequency/speed/glow/baseline live-update the visual.
- The `color` global slider changes the fallback color — but since all four default layers have explicit `color` fields, scrubbing the global `color` has no visible effect. (This is correct per the spec: layer override wins.)
- No console errors, no `usedTimes` crashes on HMR.

Also check: `http://localhost:3000/dev/reduced-motion` — waves renders, freezes correctly when policy = paused.

**Wait for user confirmation before proceeding to Phase 2.**

### Task 1.6: Commit

- [ ] **Step 1: Commit**

```bash
git add registry/waves apps/docs/src/app/components/waves/page.tsx apps/docs/src/app/dev/reduced-motion/ReducedMotionDemo.tsx
git commit -m "feat(matter)!: lift waves layers to WaveLayer[] array (per-layer API)

BREAKING: removes independence, drift, and layers:number props.
Replaces with layers: WaveLayer[] where each layer may override
color, amplitude, frequency, speed, phase. Globals remain as
fallback for unset per-layer fields. New 4-layer cool-ocean
default (teal → cyan → sky).

Docs page Tweakpane reverted to globals-only this phase; per-layer
add/remove UI lands in the follow-up."
```

---

## Phase 2 — Tweakpane add/remove layer UI

**Behavioral goal:** the docs page mirrors LinearGradient's Tweakpane pattern — per-layer folders, Add/Remove buttons, live JSX snippet.

**Stop gate:** dev server shows the new Layers folder. Adding a layer works (max 12). Removing works (min 1). Per-layer fields (color/amplitude/frequency/speed/phase) all work and override globals correctly. Copy buttons produce correct JSX.

**No code changes to `registry/`** in this phase — purely docs page work.

### Task 2.1: Rewrite `apps/docs/src/app/components/waves/page.tsx` with the full Tweakpane UI

**Files:**
- Modify: `apps/docs/src/app/components/waves/page.tsx`

- [ ] **Step 1: Replace the file with the LinearGradient-style implementation**

Full new contents:

```tsx
'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';

import { Pane } from 'tweakpane';

import { palette } from '@/lib/palette';
import { addCopyButtons } from '@/lib/paneUtils';
import { VisualTestPause } from '@/lib/visualTestHooks';

import type { WaveLayer } from '@matter/registry/waves';

const ShaderScene = dynamic(() => import('@lovo/matter-react').then((m) => m.ShaderScene), {
  ssr: false,
});
const Waves = dynamic(() => import('@matter/registry/waves').then((m) => m.Waves), { ssr: false });

interface Layer {
  color: string;
  amplitude: number;
  frequency: number;
  speed: number;
  phase: number;
}

interface Params {
  // globals
  color: string;
  amplitude: number;
  frequency: number;
  speed: number;
  glow: number;
  baseline: number;
  // per-layer
  layers: Layer[];
}

const MIN_LAYERS = 1;
const MAX_LAYERS = 12;

// Sentinel value meaning "use the global fallback". Tweakpane needs concrete
// numbers in each binding (it can't bind to optional fields), so the
// per-layer params object always has concrete values. When converting back to
// the WaveLayer[] passed to <Waves>, fields matching the global value are
// passed through anyway — the shader treats explicit-equal-to-global as still
// an override (which bakes as literal). That's correct per spec.

const INITIAL: Params = {
  color: palette.teal.light,
  amplitude: 0.07,
  frequency: 1,
  speed: 1,
  glow: 1,
  baseline: 0.1,
  layers: [
    { color: '#77ebce', amplitude: 0.07, frequency: 1, speed: 1, phase: 0 },
    { color: '#00cda6', amplitude: 0.07, frequency: 1, speed: 1, phase: 1 / 7 },
    { color: '#009eaf', amplitude: 0.07, frequency: 1, speed: 1, phase: 2 / 7 },
    { color: '#007bc6', amplitude: 0.07, frequency: 1, speed: 1, phase: 3 / 7 },
  ],
};

const fmtNum = (n: number) => String(Math.round(n * 10000) / 10000);

const fmtLayer = (l: Layer) =>
  `{ color: '${l.color}', amplitude: ${fmtNum(l.amplitude)}, frequency: ${fmtNum(l.frequency)}, speed: ${fmtNum(l.speed)}, phase: ${fmtNum(l.phase)} }`;

const fmtLayers = (layers: Layer[]) => layers.map(fmtLayer).join(',\n    ');

const fmtJsx = (p: Params) =>
  `<ShaderScene>
  <Waves
    color={'${p.color}'}
    amplitude={${fmtNum(p.amplitude)}}
    frequency={${fmtNum(p.frequency)}}
    speed={${fmtNum(p.speed)}}
    glow={${fmtNum(p.glow)}}
    baseline={${fmtNum(p.baseline)}}
    layers={[
    ${fmtLayers(p.layers)}
    ]}
  />
</ShaderScene>`;

const fmtParams = (p: Params) =>
  `{
  color: '${p.color}',
  amplitude: ${fmtNum(p.amplitude)},
  frequency: ${fmtNum(p.frequency)},
  speed: ${fmtNum(p.speed)},
  glow: ${fmtNum(p.glow)},
  baseline: ${fmtNum(p.baseline)},
  layers: [
    ${fmtLayers(p.layers)}
  ],
}`;

export default function WavesPage() {
  const paneContainerRef = useRef<HTMLDivElement>(null);
  const [params, setParams] = useState<Params>(() => structuredClone(INITIAL));

  useEffect(() => {
    const container = paneContainerRef.current;

    if (!container) return;

    const local: Params = structuredClone(INITIAL);
    const pane = new Pane({ container, title: '<Waves>' });
    const sync = () => setParams(structuredClone(local));

    pane.addButton({ title: 'Reset all' }).on('click', () => {
      Object.assign(local, structuredClone(INITIAL));
      rebuildLayers();
      pane.refresh();
      sync();
    });

    addCopyButtons(
      pane,
      () => fmtJsx(local),
      () => fmtParams(local),
    );

    pane.addBinding(local, 'color', { label: 'color (fallback)' });
    pane.addBlade({ view: 'separator' });
    pane.addBinding(local, 'amplitude', { min: 0, max: 0.3, step: 0.005 });
    pane.addBinding(local, 'frequency', { min: 0.1, max: 10, step: 0.05 });
    pane.addBinding(local, 'speed', { min: 0, max: 4, step: 0.05 });
    pane.addBinding(local, 'glow', { min: 0, max: 3, step: 0.01 });
    pane.addBinding(local, 'baseline', { min: -1, max: 1, step: 0.01 });
    pane.addBlade({ view: 'separator' });

    const layersFolder = pane.addFolder({ title: 'Layers' });

    // Tweakpane folders are static; to render variable-length lists we
    // dispose every child of the layers folder and rebuild on each mutation.
    const rebuildLayers = () => {
      for (const child of [...layersFolder.children]) child.dispose();

      local.layers.forEach((layer, i) => {
        const row = layersFolder.addFolder({ title: `Layer ${i}`, expanded: i === 0 });

        row.addBinding(layer, 'color');
        row.addBinding(layer, 'amplitude', { min: 0, max: 0.3, step: 0.005 });
        row.addBinding(layer, 'frequency', { min: 0.1, max: 10, step: 0.05 });
        row.addBinding(layer, 'speed', { min: 0, max: 4, step: 0.05 });
        row.addBinding(layer, 'phase', { min: 0, max: 2, step: 0.01 });

        const removeBtn = row.addButton({ title: 'Remove layer' });

        if (local.layers.length <= MIN_LAYERS) removeBtn.disabled = true;
        removeBtn.on('click', () => {
          local.layers.splice(i, 1);
          rebuildLayers();
          sync();
        });
      });

      const addBtn = layersFolder.addButton({ title: '+ Add layer' });

      if (local.layers.length >= MAX_LAYERS) addBtn.disabled = true;
      addBtn.on('click', () => {
        const last = local.layers[local.layers.length - 1];
        const next: Layer = {
          color: last?.color ?? '#77ebce',
          amplitude: last?.amplitude ?? 0.07,
          frequency: last?.frequency ?? 1,
          speed: last?.speed ?? 1,
          phase: (last?.phase ?? 0) + 1 / 7,
        };

        local.layers.push(next);
        rebuildLayers();
        sync();
      });
    };

    rebuildLayers();

    pane.on('change', sync);

    return () => {
      pane.dispose();
    };
  }, []);

  // Convert the page-state Layer (with concrete numbers) to WaveLayer for the
  // component — same shape; the spec specifies fields are optional so the
  // shader treats concrete values as overrides (literal bake).
  const layers: WaveLayer[] = params.layers.map((l) => ({
    color: l.color,
    amplitude: l.amplitude,
    frequency: l.frequency,
    speed: l.speed,
    phase: l.phase,
  }));

  return (
    <main style={{ minHeight: '100vh', position: 'relative' }}>
      <div data-shader-demo style={{ position: 'relative', height: '70vh', background: '#0a0a14' }}>
        <ShaderScene>
          <Waves
            amplitude={params.amplitude}
            baseline={params.baseline}
            color={params.color}
            frequency={params.frequency}
            glow={params.glow}
            layers={layers}
            speed={params.speed}
          />
          <VisualTestPause />
        </ShaderScene>
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
          }}
        />
      </div>
      <section style={{ padding: '2rem', maxWidth: '60ch', margin: '0 auto' }}>
        <h1 style={{ marginTop: 0 }}>&lt;Waves /&gt;</h1>
        <p>
          Additive proximity-glow wave field with per-layer color and physics overrides.
        </p>
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
          {fmtJsx(params)}
        </pre>
      </section>
    </main>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @matter/docs typecheck`
Expected: clean.

- [ ] **Step 3: Lint**

Run: `pnpm --filter @matter/docs lint`
Expected: clean.

- [ ] **Step 4: Format**

Run: `pnpm format`

- [ ] **Step 5: Manual dev-server validation (STOP GATE)**

Open: `http://localhost:3000/components/waves`

Expected behavior:
- Globals folder + "Reset all" + Copy buttons at the top.
- "Layers" folder with 4 sub-folders (Layer 0 expanded, others collapsed).
- Layer 0's color picker changes only its own band's color.
- "+ Add layer" appends a 5th layer (color matches Layer 3, phase = 4/7).
- "Remove layer" on any layer brings the count down. Disabled when count = 1.
- Add up to 12; Add button disables at 12.
- Copy JSX button copies a snippet that, when pasted into another file, would render the same look.
- The page rebuilds the material on every Tweakpane change (you may notice a tiny flicker per slider drag — that's the gotcha #17 tradeoff, same as LinearGradient).

**Wait for user confirmation.**

### Task 2.2: Commit

- [ ] **Step 1: Commit**

```bash
git add apps/docs/src/app/components/waves/page.tsx
git commit -m "feat(docs): per-layer waves Tweakpane UI (add/remove/edit layers)

Full rewrite copy-adapted from linear-gradient/page.tsx. Layers
folder with per-layer sub-folders (color, amplitude, frequency,
speed, phase + Remove button), + Add layer button. MIN=1, MAX=12.
Live-formatted JSX/params copy buttons."
```

---

## Phase 3 — Polish, registry metadata, visual rebaseline

**Behavioral goal:** all metadata reflects the new API; visual snapshot matches the new default.

**Stop gate:** registry.json clean, snapshot regenerated, full typecheck + lint pass.

### Task 3.1: Update `registry.json`

**Files:**
- Modify: `registry/registry.json` (the `waves` entry)

- [ ] **Step 1: Replace the `waves` entry**

Find the `"waves": { ... }` block in `registry/registry.json` and replace with:

```json
    "waves": {
      "file": "waves/waves.tsx",
      "description": "Additive proximity-glow wave field with per-layer overrides for color, amplitude, frequency, speed, and phase. Sparse per-layer config falls back to top-level globals.",
      "dependencies": ["@lovo/matter", "@lovo/matter-react", "react", "three"],
      "uses_primitives": ["cos", "uv", "vec2", "vec3", "vec4", "time", "uniform"],
      "tier": 1
    },
```

### Task 3.2: Rebaseline visual snapshot

**Files:**
- Modify: `apps/docs-tests/visual/waves.spec.ts-snapshots/waves-default-chromium-darwin.png`

- [ ] **Step 1: Confirm dev server is running on port 3000 (Playwright reuses it)**

Run: `lsof -i :3000`
Expected: a node process listening. If not, start `pnpm --filter @matter/docs dev` in another terminal.

- [ ] **Step 2: Run the snapshot update for waves only**

Run: `pnpm --filter @matter/docs-tests test:visual:update -- visual/waves.spec.ts`
Expected: one test passes; snapshot PNG is regenerated.

- [ ] **Step 3: Visually inspect the regenerated PNG**

Open: `apps/docs-tests/visual/waves.spec.ts-snapshots/waves-default-chromium-darwin.png`
Expected: 4-layer cool-ocean wave field (teal → cyan → sky). Not a black screen or a stale image.

### Task 3.3: Final verification pass

- [ ] **Step 1: Full typecheck**

Run: `pnpm typecheck`
Expected: all packages green.

- [ ] **Step 2: Lint (registry + docs)**

Run: `pnpm --filter @matter/registry lint && pnpm --filter @matter/docs lint`
Expected: clean.

- [ ] **Step 3: Format**

Run: `pnpm format`

- [ ] **Step 4: Full visual regression for the waves test only (sanity)**

Run: `pnpm --filter @matter/docs-tests test:visual -- visual/waves.spec.ts`
Expected: pass against the just-regenerated baseline.

> Note: the broader visual suite has pre-existing flake across 6 of 7 component tests (see commit `bf5b0dc`). Not in scope for this phase. Targeted waves-only run should pass.

- [ ] **Step 5: Manual final sweep (STOP GATE)**

Open: `http://localhost:3000/components/waves`
Walk through:
- Default view: 4 cool-ocean layers visible.
- Globals: amplitude/frequency/speed/glow/baseline all responsive.
- Color (fallback) global: scrub it; should have NO effect (all default layers override). Edit a layer to remove its color (or add a new layer that defaults its color) to see the fallback drive that one.
- Per-layer color/amplitude/frequency/speed/phase: each works, only affects its layer.
- Add layer up to 12, remove down to 1.
- Reset all returns to default.
- Copy JSX button: paste output somewhere, verify it's syntactically correct TSX.

Also confirm `http://localhost:3000/dev/reduced-motion` still works (renders waves, freezes on paused policy).

**Wait for user confirmation.**

### Task 3.4: Commit

- [ ] **Step 1: Commit**

```bash
git add registry/registry.json apps/docs-tests/visual/waves.spec.ts-snapshots
git commit -m "feat(matter): finalize per-layer waves metadata + visual snapshot

registry.json description references per-layer API; uses_primitives
unchanged. Visual snapshot rebaselined for new 4-layer default."
```

---

## Out of scope (do NOT do during this rebuild)

- Don't reintroduce `independence` or `drift` props.
- Don't add per-layer `glow` or `baseline` (they're globals by design per spec).
- Don't promote `wobble` to `@lovo/matter` engine primitives (YAGNI — only one consumer).
- Don't try to make per-layer values live-uniform-driven (would require fixed-size uniform arrays; deferred per spec).
- Don't add convenience methods like "Spread phases" or "Randomize colors" to the Tweakpane page (deferred per spec).
- Don't touch the broader visual regression flake — out of scope.

---

## Self-review notes

- **Spec coverage:** Every spec section maps to a task:
  - Component API → Tasks 1.1 + 1.2
  - Default `layers` → Task 1.1
  - Removed props → Tasks 1.1 + 1.2 + 1.3 (docs page) + 1.4 (reduced-motion)
  - Bounds (MIN/MAX) → Task 2.1
  - Shader changes → Task 1.2
  - Tweakpane page UX → Task 2.1
  - Other consumer updates → Task 1.4 (reduced-motion), Task 3.1 (registry.json)
  - Visual regression → Task 3.2
  - Testing → Task 3.3
- **Placeholder scan:** No TBDs. Each step has either real code or a real command.
- **Type consistency:** `WaveLayer` defined in `waves.tsx` exported, imported by `shader.tsx` and by the docs page. `WavesShaderProps` mirrors `WavesProps` minus the optional `?`. `Layer` in the docs page is a separate concrete-numbers shape used for tweakpane binding (because tweakpane can't bind to optional fields), converted to `WaveLayer` at render time.
- **One inline contradiction fixed:** Task 1.3 originally had `_sync` then realized it was needed; inline note kept to explain the back-and-forth.
- **Edit strategy:** Phases 1 and 3 are mechanical — Claude can drive with Edit/Write. Phase 2 (Tweakpane page) is a single large rewrite; full file replace via Write is fine.

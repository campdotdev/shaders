# Aurora Reference Rebuild (MAT-48) Implementation Plan

> **For agentic workers:** This plan does NOT use subagent-driven execution.
> It runs in **co-write mode** (standing user preference): the user types all
> `registry/aurora/*` code chunk-by-chunk; Claude dictates each chunk,
> explains the TSL/GPU concepts as they land, and does **not** call
> Edit/Write on shader files. Demo-page files (`apps/docs/…`) may be edited
> by Claude when the user asks, but default to co-write there too. Every
> phase ends at a **non-negotiable gate**: stop, let the user run the dev
> server, look, feel, and react before continuing. Steps use checkbox
> (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `registry/aurora` from scratch following the structure of the user-supplied ShaderToy aurora reference, then productize it: transparent overlay, depth-indexed color ramp, reduced prop set.

**Architecture:** Two stages. Stage 1 (Phases 1–2) rebuilds the reference's structure opaque with literal starting constants and A/Bs against ShaderToy. Stage 2 (Phases 3–6) productizes one gate at a time: transparency, color ramp, uniform dials, wrapper/demo/defaults.

**Tech Stack:** TypeScript 5 strict, three/webgpu + TSL, `@lovo/matter` engine (`elapsedTime`, `colorRamp`), `@lovo/matter-react` hooks (`useShaderContext`, `useResize`, `useAnimatableUniform`), Next.js docs site with Tweakpane demo.

**Spec:** `docs/superpowers/specs/2026-07-12-aurora-reference-rebuild-design.md`

**Dev server:** `pnpm --filter docs dev`, then `http://localhost:3000/components/aurora`. Registry sources are transpiled by the docs site — shader edits hot-reload, no rebuild needed.

## Global Constraints

- **License stance (spec §License constraint):** technique reference only. All TSL is original expression; every numeric constant below is a *starting value* re-tuned by eye at gates; inspiration credit comment in the shader header; no verbatim-port claim anywhere (not in code comments, not in commits).
- **Co-write:** Claude never Edits/Writes `registry/aurora/*`.
- **Phase gates:** stop after every phase; user runs and reacts. Non-negotiable.
- **Never rebuild a NodeMaterial on prop change** (CLAUDE.md gotcha #17) — dials go through stable `uniform(...)` nodes; only `stops`/`colorSpace`/`hueInterpolation`/structural changes rebuild.
- **Consume uniforms as arguments, not chain receivers** (gotcha #12).
- TypeScript strict, `verbatimModuleSyntax`, `import type` for type-only imports.
- Clear names over abbreviations. No emojis. Conventional Commits, scope `registry`.
- All work on `hunter/mat-48-rework-aurora`; PR to main at the end; never push main.
- `pnpm typecheck && pnpm lint` green at every commit; `pnpm format` before push.

## File Structure

- Rewrite: `registry/aurora/shader.tsx` — all TSL; helpers + field + march + `AuroraShader`.
- Rewrite: `registry/aurora/aurora.tsx` — thin wrapper, destructured defaults, `DEFAULT_STOPS`.
- Modify: `apps/docs/src/app/components/aurora/params.ts` — drop `drift`/`direction`; retune `INITIAL` at the final gate.
- Modify: `apps/docs/src/app/components/aurora/scene.tsx` — prop forwarding follows each phase.
- Modify: `apps/docs/src/app/components/aurora/page.tsx` — drop drift/direction Tweakpane rows + snippet lines; demo background becomes a dark sky gradient (Phase 3).

Only `scene.tsx` and `params.ts` import from `@matter/registry/aurora` outside the component — no other call sites to update.

---

### Phase 1: Triangle-noise field on a flat plane

**Files:**
- Rewrite: `registry/aurora/shader.tsx`
- Rewrite: `registry/aurora/aurora.tsx`
- Modify: `apps/docs/src/app/components/aurora/params.ts`, `scene.tsx`, `page.tsx` (strip dead props so typecheck stays green all rebuild long)

**Interfaces:**
- Produces: `AuroraShader()` (no props yet); helpers `triangleWave(value)`, `triangleWave2(point)`, `rotate2d(point, angle)`, `auroraField(coords, warpPhase, domainPhase)` — Phase 2 consumes all of these with these exact names.

**Concepts to explain while co-writing:** what an fbm octave ladder is (frequency up, amplitude down); domain warping (offsetting sample coordinates with another noise); why triangle waves (straight slopes + sharp creases = filaments, vs billowy simplex); ridge accumulation; why the per-octave time rotation reads as smooth evolution.

- [ ] **Step 1: Strip dead props from the demo layer** (small mechanical edits; Claude may do these if asked)

`params.ts`: delete `drift` and `direction` from `AuroraParams` and `INITIAL`, delete the `AuroraDirection` import.
`page.tsx`: delete lines using `params.drift` / `params.direction` (snippet template lines ~29/33/46/50 and the two `addBinding` rows ~94/98).
`scene.tsx`: replace body so it compiles against the propless component (params intentionally accepted-but-ignored until Phase 4):

```tsx
'use client';

import type { ReactNode } from 'react';

import { ShaderScene } from '@lovo/matter-react';
import { Aurora } from '@matter/registry/aurora';

import type { AuroraParams } from './params';

export default function AuroraScene({
  children,
}: {
  params?: AuroraParams;
  children?: ReactNode;
} = {}) {
  return (
    <ShaderScene>
      <Aurora />
      {children}
    </ShaderScene>
  );
}
```

- [ ] **Step 2: User rewrites `aurora.tsx` as the transitional propless wrapper**

```tsx
'use client';

import { AuroraShader } from './shader';

// Transitional during the MAT-48 rebuild: props return in Phases 4-6.
export function Aurora() {
  return <AuroraShader />;
}
```

- [ ] **Step 3: User rewrites `shader.tsx` — header, helpers, field, preview component**

```tsx
'use client';

import { useEffect } from 'react';

import { elapsedTime, type TSLNode } from '@lovo/matter';
import { useShaderContext } from '@lovo/matter-react';
import {
  cos,
  float,
  Fn,
  fract,
  type ShaderNodeObject,
  sin,
  uv,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import { Mesh, MeshBasicNodeMaterial, type Node, PlaneGeometry } from 'three/webgpu';

// Aurora technique inspired by nimitz's "Auroras" (shadertoy.com/view/XtGGRt):
// triangle-noise fbm, depth-sliced raymarch, average-then-accumulate
// compositing. Original TSL implementation, constants tuned at the MAT-48
// gates.

type TSLValue = ShaderNodeObject<Node>;

/**
 * Triangle wave of x in [0, 0.5]. Where simplex is billowy, the triangle wave
 * has straight slopes and sharp creases — the creases become the curtain
 * filaments.
 */
const triangleWave = (value: TSLNode): TSLValue => fract(value).sub(0.5).abs();

/** Cross-fed vec2 triangle wave; nesting x into y decorrelates the axes. */
const triangleWave2 = (point: TSLValue): TSLValue =>
  vec2(
    triangleWave(point.x).add(triangleWave(point.y)),
    triangleWave(point.y.add(triangleWave(point.x))),
  );

/** Rotate a vec2 by an angle without mat2 — keeps everything a plain chain. */
const rotate2d = (point: TSLValue, angle: TSLNode): TSLValue =>
  vec2(
    point.x.mul(cos(angle)).sub(point.y.mul(sin(angle))),
    point.x.mul(sin(angle)).add(point.y.mul(cos(angle))),
  );

/**
 * Five-octave triangle-noise fbm. Each octave warps the domain with a
 * time-rotated triangle-wave offset (the shimmer), climbs a lacunarity/gain
 * ladder, accumulates a ridge term, and rotates the whole domain a little
 * (`domainPhase` — slow continuous evolution). Reciprocal-power shaping
 * concentrates brightness into thin filaments.
 */
const auroraField = (coords: TSLValue, warpPhase: TSLNode, domainPhase: TSLNode): TSLValue => {
  let ridgeGain = 1.8;
  let warpGain = 2.5;
  let ridgeSum: TSLValue = float(0);
  let point = rotate2d(coords, coords.x.mul(0.06));
  let warpPoint = point;

  for (let octave = 0; octave < 5; octave++) {
    const warp = rotate2d(triangleWave2(warpPoint.mul(1.85)).mul(0.75), warpPhase);
    point = point.sub(warp.div(warpGain));

    warpPoint = warpPoint.mul(1.3);
    warpGain *= 0.45;
    ridgeGain *= 0.42;
    point = point.mul(ridgeSum.sub(1).mul(0.02).add(1.21));

    ridgeSum = ridgeSum.add(triangleWave(point.x.add(triangleWave(point.y))).mul(ridgeGain));
    point = rotate2d(point, domainPhase);
  }

  return float(1).div(ridgeSum.mul(20).pow(1.3)).clamp(0, 1);
};

export function AuroraShader() {
  const shaderContext = useShaderContext();

  useEffect(() => {
    const material = new MeshBasicNodeMaterial();

    // Phase 1 scaffolding: look straight at the field, grayscale, no march.
    // uv is stretched to roughly the coordinate range the raymarch will
    // sample so this gate judges the real pattern.
    const fieldPreview = Fn(() => {
      const coords = uv().sub(0.5).mul(vec2(10, 4));
      const warpPhase = elapsedTime.mul(0.02);
      const domainPhase = elapsedTime.mul(0.01);
      const fieldValue = auroraField(coords, warpPhase, domainPhase);

      return vec4(vec3(fieldValue), 1);
    })();

    material.colorNode = fieldPreview;

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
  }, [shaderContext]);

  return null;
}
```

Notes while typing: the JS `for` loop unrolls at graph-build time (5 fixed octaves, no GPU branch); the JS `let` rebinding builds a chain of nodes, it is not GPU mutation. The ridge ladder multiplies `ridgeGain`/`warpGain` *before* first use, so octave 0 effectively contributes `1.8 × 0.42`.

- [ ] **Step 4: Verify**

Run: `pnpm typecheck && pnpm lint`
Expected: green.
Run dev server, open `/components/aurora`.
Expected: grayscale filament field, slowly writhing; warp shimmer visible; no strobing or static frames.

- [ ] **Step 5: GATE — user plays.** Feel-decisions: does the filament pattern read as curtain material? Is the motion smooth (the per-octave `domainPhase` rotation is the new ingredient vs MAT-46 — verify it reads as drift-free evolution)? Preview scale (`vec2(10, 4)`) is disposable, don't over-tune.

- [ ] **Step 6: Commit**

```bash
git add registry/aurora apps/docs/src/app/components/aurora
git commit -m "feat(registry): rebuild aurora triangle-noise field"
```

---

### Phase 2: Raymarch — full reference-shaped picture (opaque)

**Files:**
- Modify: `registry/aurora/shader.tsx`

**Interfaces:**
- Consumes: `auroraField`, `triangleWave*`, `rotate2d` from Phase 1.
- Produces: `STEP_COUNT` (60), `hashNoise(point)`, the march graph with `stepIndex`, `runningAverage`, `accumulated`, `horizonMask`, `shaped` — Phases 3–5 edit these exact names.

**Concepts to explain:** raymarching as depth slicing (not sphere tracing); why slices are distributed `pow(i, 1.4)` (dense at the bright base, sparse in the fade); the bent divisor as fake atmospheric curvature; per-pixel jitter turning slice banding into grain; average-then-accumulate as a cheap volumetric blur; `exp2` extinction; `toVar`/`assign` because GPU loop state can't live in JS bindings.

- [ ] **Step 1: Add the hash helper and step count** (user types, below `rotate2d`)

New imports needed this phase: `clamp`, `dot`, `exp2`, `Loop`, `mix`, `normalize`, `screenCoordinate`, `smoothstep`, `uniform` from `three/tsl`; `useMemo` from `react`; `useResize` from `@lovo/matter-react`.

```tsx
/** Raymarch slice count. Banding re-judged at the Phase 2 gate. */
const STEP_COUNT = 60;

/** Per-pixel hash (fract-dot construction) — seeds the march jitter. */
const hashNoise = (point: TSLValue): TSLValue => {
  const spread = fract(vec3(point.x, point.y, point.x).mul(0.1031));
  const mixed = spread.add(dot(spread, vec3(spread.y, spread.z, spread.x).add(33.33)));
  return fract(mixed.x.add(mixed.y).mul(mixed.z));
};
```

- [ ] **Step 2: Aspect plumbing** (user types, inside `AuroraShader` before the effect — same pattern as every Matter component)

```tsx
const resize = useResize();

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
```

Add `aspectNode` to the material effect's dependency array.

- [ ] **Step 3: Replace `fieldPreview` with the march graph** (user types)

```tsx
const auroraNode = Fn(() => {
  // Screen uv → centered NDC; x carries the aspect so ribbons don't
  // stretch on wide canvases.
  const ndcX = uv().x.sub(0.5).mul(2).mul(aspectNode);
  const ndcY = uv().y.sub(0.5).mul(2);

  // Virtual camera looking toward the horizon (+z); z ≈ 1.064 sets the fov.
  const rayDirection = normalize(vec3(ndcX, ndcY, 1.064));

  const warpPhase = elapsedTime.mul(0.02);
  const domainPhase = elapsedTime.mul(0.01);

  // Per-pixel jitter seed: decorrelates slice offsets pixel-to-pixel so
  // the discrete march dissolves into grain instead of contour banding.
  const jitterSeed = hashNoise(screenCoordinate.xy);

  // Loop state must be GPU-side variables (`toVar`) — the loop runs on the
  // GPU, so a JS binding can't change per iteration there.
  const accumulated = vec4(0).toVar();
  const runningAverage = vec4(0).toVar();

  Loop(STEP_COUNT, ({ i }: { i: TSLValue }) => {
    const stepIndex = float(i);

    // Ramp jitter in over the first slices — the lowest slices draw the
    // curtain's sharp bottom edge and shouldn't be blurred.
    const jitter = jitterSeed.mul(0.006).mul(smoothstep(0, 15, stepIndex));

    // pow(i, 1.4) packs slices tight at the base and spreads them with
    // height; the bent divisor fakes atmospheric curvature so
    // horizon-grazing rays bend the sheet toward the horizon line.
    const marchDistance = stepIndex
      .pow(1.4)
      .mul(0.002)
      .add(0.8)
      .div(rayDirection.y.mul(2).add(0.4))
      .sub(jitter);

    const samplePoint = vec3(5.5).add(rayDirection.mul(marchDistance));

    // Sample the field on the horizontal plane: z runs toward the horizon,
    // x runs across the screen.
    const fieldValue = auroraField(vec2(samplePoint.z, samplePoint.x), warpPhase, domainPhase);

    // Depth-stratified hue cycling: each slice gets its own palette phase,
    // so near and far ribbons glow different colors. Replaced by the user
    // color ramp in Phase 4.
    const paletteColor = sin(vec3(-1.15, 1.5, -0.2).add(stepIndex.mul(0.043)))
      .mul(0.5)
      .add(0.5);

    const slice = vec4(paletteColor.mul(fieldValue), fieldValue);

    // Average-then-accumulate: blending each slice into a running average
    // before adding smears slice-to-slice noise into continuous wisps.
    runningAverage.assign(mix(runningAverage, slice, 0.5));

    // Atmospheric extinction: each successive slice contributes
    // exponentially less; the smoothstep suppresses the first few slices,
    // which otherwise read as a hard floor.
    const extinction = exp2(stepIndex.mul(-0.065).sub(2.5));

    accumulated.addAssign(runningAverage.mul(extinction).mul(smoothstep(0, 5, stepIndex)));
  });

  // Rays pointing below the horizon never hit sky — fade them out fast.
  const horizonMask = clamp(rayDirection.y.mul(15).add(0.4), 0, 1);

  // Soft-clip shaping: lifts the mids and rolls off the top instead of
  // clipping hot filaments.
  const shaped = smoothstep(0, 1.1, accumulated.mul(horizonMask).mul(1.5));

  // Stage-1 scaffolding: opaque composite over a dark sky gradient so the
  // browser can be A/B'd against ShaderToy. Deleted in Phase 3.
  const sky = mix(vec3(0.006, 0.026, 0.095), vec3(0.007, 0.011, 0.035), uv().y);

  return vec4(sky.add(shaped.rgb), 1);
})();

material.colorNode = auroraNode;
```

Note on gamma: the reference hand-applies `pow(1/2.2)` because ShaderToy outputs raw; in Matter the working→output transform belongs to the scene output pass (gotcha #20), so no hand gamma here. Expect the A/B to be close in structure and motion but not pixel-identical in tone.

- [ ] **Step 4: Verify**

Run: `pnpm typecheck && pnpm lint`
Expected: green.
Dev server: full aurora over dark sky. Open the ShaderToy reference beside it.

- [ ] **Step 5: GATE — side-by-side A/B.** Judge: ribbon shape, depth hue cycling (green near, teal/blue/pink deeper), motion smoothness, banding (should beat MAT-46 — new hash + 60 steps + jitter). Constants are ours to retune here if anything feels off (license stance: expected, not a failure).

- [ ] **Step 6: Commit**

```bash
git add registry/aurora/shader.tsx
git commit -m "feat(registry): raymarch the rebuilt aurora sky band"
```

---

### Phase 3: Transparent premultiplied output

**Files:**
- Modify: `registry/aurora/shader.tsx`
- Modify: `apps/docs/src/app/components/aurora/page.tsx` (demo background)

**Interfaces:**
- Produces: component output contract — `vec4(premultiplied rgb, coverage)` with `material.transparent = true; material.premultipliedAlpha = true`. All later phases keep it.

**Concepts to explain:** straight vs premultiplied alpha, and the MAT-45 double-multiply dimming bug; why the accumulated `.a` channel (field coverage run through the same average/extinction pipeline) is a natural coverage term.

- [ ] **Step 1: Material flags** (user types, right after `new MeshBasicNodeMaterial()`)

```tsx
material.transparent = true;
// rgb below is the accumulated curtain light itself (premultiplied); alpha
// is coverage. Without this flag NormalBlending scales rgb by alpha a
// second time and everything dims quadratically (MAT-45).
material.premultipliedAlpha = true;
```

- [ ] **Step 2: Swap the output** (user types — delete the `sky` line and the opaque return, replace with)

```tsx
return vec4(shaped.rgb, shaped.a.clamp(0, 1));
```

- [ ] **Step 3: Demo background becomes the sky** — in `page.tsx` line ~181, replace `background: '#0b0f1a'` with a gradient approximating the reference sky (sRGB conversions of its linear endpoints; eyeball at the gate):

```tsx
<div
  data-shader-demo
  style={{ position: 'relative', background: 'linear-gradient(to top, #193157, #1b2138)' }}
>
```

- [ ] **Step 4: Verify**

Run: `pnpm typecheck && pnpm lint`
Dev server: aurora over the page gradient should read the same as Phase 2's opaque composite.

- [ ] **Step 5: GATE — vibrancy check.** The MAT-45 trap: if the aurora went dim or milky versus Phase 2, the alpha pipeline is wrong — stop and fix before proceeding. Also drag a quick solid-color div behind it (devtools) to confirm it stacks over arbitrary backgrounds.

- [ ] **Step 6: Commit**

```bash
git add registry/aurora/shader.tsx apps/docs/src/app/components/aurora/page.tsx
git commit -m "feat(registry): transparent premultiplied aurora output"
```

---

### Phase 4: Depth-indexed color ramp (`stops` return)

**Files:**
- Modify: `registry/aurora/shader.tsx`, `registry/aurora/aurora.tsx`
- Modify: `apps/docs/src/app/components/aurora/scene.tsx`

**Interfaces:**
- Consumes: `colorRamp(progress, stops, colorSpace, hueInterpolation)` from `@lovo/matter`; `ColorStop`, `colorStopsKey`, `toColorRampStops` from `registry/utils/color`.
- Produces: `AuroraShaderProps { stops, colorSpace, hueInterpolation }`; wrapper `AuroraProps` (same three, optional) + `DEFAULT_STOPS`. Phase 5 extends both.

**Concepts to explain:** why the ramp is baked as literals (gotcha #17's exception — `stops` changes rebuild the material, dials must not); the extinction-weighting problem — most accumulated light comes from early slices, so a linear `sliceProgress` reads mostly as stop 0 (the same lesson as MAT-46's `pow(0.6)` altitude).

- [ ] **Step 1: Shader accepts the ramp props** (user types)

Imports: add `colorRamp`, `type ColorSpace`, `type HueInterpolation` to the `@lovo/matter` import; add `import { type ColorStop, colorStopsKey, toColorRampStops } from '../utils/color';`.

```tsx
export interface AuroraShaderProps {
  stops: ColorStop[];
  colorSpace: ColorSpace;
  hueInterpolation: HueInterpolation;
}

export function AuroraShader({ stops, colorSpace, hueInterpolation }: AuroraShaderProps) {
```

Inside the component, before the material effect:

```tsx
const stopsKey = colorStopsKey(stops);
```

Inside the effect, before the graph:

```tsx
const rampStops = toColorRampStops(stops);
```

Effect dependency array becomes (with the eslint-disable + comment pattern from the old file — `stopsKey` is a stable string proxy for `stops`, whose colors/positions are baked as literals):

```tsx
}, [shaderContext, stopsKey, colorSpace, hueInterpolation, aspectNode]);
```

- [ ] **Step 2: Replace the sin palette in the loop** (user types — delete `paletteColor`, replace `slice`)

```tsx
// Depth-stratified color: slice index drives the user ramp, so near and
// far ribbons glow different stops. pow keeps the upper stops visible —
// extinction weights early slices so a linear index reads as stop 0.
const sliceProgress = stepIndex.div(STEP_COUNT).pow(0.6);
const sliceColor = colorRamp(sliceProgress, rampStops, colorSpace, hueInterpolation);

const slice = vec4(sliceColor.mul(fieldValue), fieldValue);
```

- [ ] **Step 3: Wrapper forwards the three props** (user rewrites `aurora.tsx`)

```tsx
'use client';

import type { ColorSpace, HueInterpolation } from '@lovo/matter';

import type { ColorStop } from '../utils/color';
import { AuroraShader } from './shader';

export type { ColorStop } from '../utils/color';

// Depth ramp, near → far: oxygen green up close, teal mid, ionized blue and
// pink fringe in the distance. Starting point; retuned at the Phase 6 gate.
export const DEFAULT_STOPS: ColorStop[] = [
  { color: '#0ae24b', position: 0 },
  { color: '#00cda6', position: 0.35 },
  { color: '#1b9fda', position: 0.7 },
  { color: '#e765b8', position: 1 },
];

export interface AuroraProps {
  stops?: ColorStop[];
  colorSpace?: ColorSpace;
  hueInterpolation?: HueInterpolation;
}

export function Aurora({
  stops = DEFAULT_STOPS,
  colorSpace = 'oklab',
  hueInterpolation = 'shorter',
}: AuroraProps) {
  return <AuroraShader colorSpace={colorSpace} hueInterpolation={hueInterpolation} stops={stops} />;
}
```

- [ ] **Step 4: Scene re-wires the ramp params** (`scene.tsx`)

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
        hueInterpolation={params.hueInterpolation}
        stops={stops}
      />
      {children}
    </ShaderScene>
  );
}
```

- [ ] **Step 5: Verify**

Run: `pnpm typecheck && pnpm lint`
Dev server: aurora in brand colors, depth-stratified; stop color pickers in the Tweakpane panel now work again.

- [ ] **Step 6: GATE — wrap-vs-once decision + `pow` exponent.** Experiments to try live (one-line edits):
  - Once-through (as typed): `stepIndex.div(STEP_COUNT).pow(0.6)`.
  - Wrapped/cycling (closer to the reference's sin period, which only traverses ~40% of a full cycle over 60 slices): `fract(stepIndex.mul(0.007))`-style — tune the frequency by eye.
  - Exponent sweep 0.4–1.0 for how far up the ramp the bright base reaches.
  Decide, keep one, delete the other. Also pick the default stops here (candidates from `paletteOklch`, current greens/teal/sky/magenta as the baseline).

- [ ] **Step 7: Commit**

```bash
git add registry/aurora apps/docs/src/app/components/aurora/scene.tsx
git commit -m "feat(registry): depth-indexed aurora color ramp"
```

---

### Phase 5: Dials as uniforms — intensity, speed, turbulence, density, falloff

**Files:**
- Modify: `registry/aurora/shader.tsx`, `registry/aurora/aurora.tsx`
- Modify: `apps/docs/src/app/components/aurora/scene.tsx`

**Interfaces:**
- Consumes: `useAnimatableUniform<number>(prop)` from `@lovo/matter-react` (returns a stable uniform node; accepts number or MotionValue-shaped signal).
- Produces: full `AuroraShaderProps` / `AuroraProps` with `intensity`, `speed`, `turbulence`, `density`, `falloff` as `AnimatableProp<number>`; `auroraField` gains `(warpStrength, fieldGain)` parameters.

**Concepts to explain:** why dials are uniforms not rebuilds (gotcha #17 — compiling a NodeMaterial is tens of ms; uniforms update a GPU buffer); gotcha #12 — uniforms enter expressions as *arguments* (`chain.mul(uniformNode)`), never as chain receivers.

- [ ] **Step 1: Props + uniform hooks** (user types)

Imports: add `type AnimatableProp`, `useAnimatableUniform` to the `@lovo/matter-react` import.

```tsx
export interface AuroraShaderProps {
  stops: ColorStop[];
  intensity: AnimatableProp<number>;
  speed: AnimatableProp<number>;
  turbulence: AnimatableProp<number>;
  density: AnimatableProp<number>;
  falloff: AnimatableProp<number>;
  colorSpace: ColorSpace;
  hueInterpolation: HueInterpolation;
}

export function AuroraShader({
  stops,
  intensity,
  speed,
  turbulence,
  density,
  falloff,
  colorSpace,
  hueInterpolation,
}: AuroraShaderProps) {
  const shaderContext = useShaderContext();
  const resize = useResize();

  const intensityUniform = useAnimatableUniform<number>(intensity);
  const speedUniform = useAnimatableUniform<number>(speed);
  const turbulenceUniform = useAnimatableUniform<number>(turbulence);
  const densityUniform = useAnimatableUniform<number>(density);
  const falloffUniform = useAnimatableUniform<number>(falloff);
```

Effect dependency array grows to:

```tsx
}, [
  shaderContext,
  stopsKey,
  colorSpace,
  hueInterpolation,
  intensityUniform,
  speedUniform,
  turbulenceUniform,
  densityUniform,
  falloffUniform,
  aspectNode,
]);
```

- [ ] **Step 2: Wire each dial into the graph** (user types; every dial is a relative multiplier — default 1 reproduces the Phase 2 look)

`auroraField` gains two parameters:

```tsx
const auroraField = (
  coords: TSLValue,
  warpPhase: TSLNode,
  domainPhase: TSLNode,
  warpStrength: TSLNode,
  fieldGain: TSLNode,
): TSLValue => {
```

…with two body edits:

```tsx
const warp = rotate2d(triangleWave2(warpPoint.mul(1.85)).mul(0.75).mul(warpStrength), warpPhase);
```

```tsx
return float(1).div(ridgeSum.mul(fieldGain).pow(1.3)).clamp(0, 1);
```

In the graph:

```tsx
// speed scales both time phases together so shimmer and drift stay coupled.
const warpPhase = elapsedTime.mul(speedUniform).mul(0.02);
const domainPhase = elapsedTime.mul(speedUniform).mul(0.01);
```

```tsx
// density raises coverage by lowering the reciprocal shaping's gain —
// dividing (not multiplying) keeps the dial intuitive: 2 = fuller curtain.
const fieldValue = auroraField(
  vec2(samplePoint.z, samplePoint.x),
  warpPhase,
  domainPhase,
  turbulenceUniform,
  float(20).div(densityUniform),
);
```

```tsx
// falloff: 0 lifts the cut entirely (aurora fills the canvas), 1 is the
// tuned default, above 1 tightens the fade toward the horizon line.
const horizonMask = clamp(
  rayDirection.y
    .mul(float(15).mul(falloffUniform))
    .add(mix(float(1), float(0.4), clamp(falloffUniform, 0, 1))),
  0,
  1,
);
```

```tsx
// intensity feeds the soft-clip, so hot values saturate gracefully instead
// of clipping.
const shaped = smoothstep(0, 1.1, accumulated.mul(horizonMask).mul(1.5).mul(intensityUniform));
```

- [ ] **Step 3: Wrapper grows the dials** (`aurora.tsx` — add to `AuroraProps` and forward; defaults all 1 for now, retuned Phase 6)

```tsx
export interface AuroraProps {
  stops?: ColorStop[];
  intensity?: AnimatableProp<number>;
  speed?: AnimatableProp<number>;
  turbulence?: AnimatableProp<number>;
  density?: AnimatableProp<number>;
  falloff?: AnimatableProp<number>;
  colorSpace?: ColorSpace;
  hueInterpolation?: HueInterpolation;
}

export function Aurora({
  stops = DEFAULT_STOPS,
  intensity = 1,
  speed = 1,
  turbulence = 1,
  density = 1,
  falloff = 1,
  colorSpace = 'oklab',
  hueInterpolation = 'shorter',
}: AuroraProps) {
  return (
    <AuroraShader
      colorSpace={colorSpace}
      density={density}
      falloff={falloff}
      hueInterpolation={hueInterpolation}
      intensity={intensity}
      speed={speed}
      stops={stops}
      turbulence={turbulence}
    />
  );
}
```

(`import type { AnimatableProp } from '@lovo/matter-react';` joins the wrapper imports.)

- [ ] **Step 4: Scene forwards everything** (`scene.tsx` — add the five dial props from `params`, mirroring the Phase 4 shape).

- [ ] **Step 5: Verify**

Run: `pnpm typecheck && pnpm lint`
Dev server: drag every Tweakpane dial. **No stutter on drag** — if dragging stutters, a dial is rebuilding the material (check the dep array).

- [ ] **Step 6: GATE — dial feel at extremes.** Specifically falloff: sweep 0 → 2. The bottom edge must stay soft and organic — it should ride the ribbon shapes, never read as a straight screen-space line. If it reads hard, gate experiments: derive the mask from `accumulated.a` (coverage-shaped fade) or smoothstep the mask itself. Also sanity-check density direction (2 = fuller, 0.5 = wispier) and turbulence at 0 (calm sheets) vs 3 (chaos).

- [ ] **Step 7: Commit**

```bash
git add registry/aurora apps/docs/src/app/components/aurora/scene.tsx
git commit -m "feat(registry): aurora dials as uniforms"
```

---

### Phase 6: Defaults, demo polish, ship prep

**Files:**
- Modify: `registry/aurora/aurora.tsx` (final tuned defaults)
- Modify: `apps/docs/src/app/components/aurora/params.ts` (INITIAL mirrors defaults; falloff binding range)
- Modify: `apps/docs/src/app/components/aurora/page.tsx` (snippet template reflects final props)
- Create: `.changeset/<generated>.md`

**Interfaces:**
- Consumes: everything from Phases 1–5.
- Produces: the shippable component.

- [ ] **Step 1: GATE FIRST — tuning session.** User plays with all dials + stops on the demo page and lands final defaults by eye (MAT-46 precedent: shipped defaults were `intensity 1.7, turbulence 1.3, density 0.7, falloff 1.35` — expect non-round numbers again).

- [ ] **Step 2: Bake tuned values** — wrapper defaults and `params.ts` `INITIAL` updated to the gate's numbers, with the comment `// Tuned by eye at the MAT-48 gates; keep in sync with the Aurora defaults.` Check Tweakpane binding ranges still bracket the defaults (falloff wants `min: 0`).

- [ ] **Step 3: Demo snippet + copy** — `page.tsx` snippet template lists the final prop set (drift/direction lines died in Phase 1 — confirm nothing stale); `DemoPoster` alt text still describes the look accurately; adjust if the new default palette differs.

- [ ] **Step 4: Changeset** — `pnpm changeset`: minor bump, summary noting the breaking prop changes:

```
Aurora rebuilt as a reference-shaped raymarch: depth-indexed color stops, smoother motion, banding fixes. Breaking: `drift` and `direction` props removed; `falloff` semantics changed (horizon fade steepness, 0 fills the canvas).
```

- [ ] **Step 5: Full verification**

```bash
pnpm format && pnpm typecheck && pnpm lint && pnpm build
```

Expected: all green.

- [ ] **Step 6: Visual baselines + poster** — on Node 22 (fnm honors `.nvmrc`; docs build silently breaks on Node 23):

```bash
pnpm posters   # regenerate /posters/aurora.jpg
pnpm snap      # regenerate Playwright baselines (Docker)
```

Expected: new aurora baselines; other components' baselines unchanged (the demo-page background change touches only the aurora route).

- [ ] **Step 7: Commit + PR**

```bash
git add -A
git commit -m "feat(registry): ship rebuilt aurora defaults and demo"
git push -u origin hunter/mat-48-rework-aurora
```

PR per memory style: concise, lead with why (color depth-cycling, banding, prop cleanup), note breaking changes; no Test plan / Follow-ups sections; no Claude attribution; run prose through humanizer.

---

## Self-review notes

- Spec coverage: goal gaps 1–4 → Phases 2 (hue cycling, banding, motion) and 1/5 (prop cleanup); license stance → global constraints + header comment (Phase 1) + commit wording; transparency → Phase 3; ramp + wrap decision → Phase 4; falloff organic-edge requirement → Phase 5 gate; verification section → Phase 6 steps 5–6.
- Names used across phases are consistent: `auroraField`, `triangleWave`, `triangleWave2`, `rotate2d`, `hashNoise`, `STEP_COUNT`, `stepIndex`, `runningAverage`, `accumulated`, `horizonMask`, `shaped`, `AuroraShaderProps`, `AuroraProps`, `DEFAULT_STOPS`.
- Known deliberate roughness: gate steps direct live experiments (wrap frequency, falloff shaping) whose outcomes can't be pre-written — that's the point of co-write gates, not a placeholder.

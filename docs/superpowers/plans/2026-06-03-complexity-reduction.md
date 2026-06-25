# Complexity Reduction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce cyclomatic and cognitive complexity in the four flat registry components and two CLI modules identified by `fallow health`, making the code easier to read and change.

**Architecture:** Each registry component's large monolithic `useEffect` (which builds the TSL shader graph AND manages the Three.js mesh lifecycle) is split into a private `build<Name>Material(...)` helper that handles shader construction only, and a thin effect that calls it then manages scene add/remove. The CLI changes extract private protocol-specific helpers from `readUrl` and move config validation into its own module.

**Tech Stack:** TypeScript 5 strict, TSL (Three.js Shader Language) node builder API, React hooks, pnpm workspaces, Vitest 4.

---

## Background / Context for the implementor

### What TSL is and why it matters here

TSL (Three.js Shader Language) is a JavaScript API for writing GPU shaders without writing GLSL. Calls like `uv()`, `vec2(0.5)`, `smoothstep(a, b, x)` don't produce a number — they produce **shader node objects** that get compiled to GPU code later. Think of it as building an expression tree.

Each registry component constructs this tree inside a `useEffect`. The complexity fallow flagged comes from branching inside that tree construction (conditionals for cursor, variant types, layer counts, etc.). The fix is to move all that tree-building into a named helper function — the effect itself then just calls that helper and manages the Three.js mesh object.

### The single-file constraint

Registry components are distributed via the CLI as single files. `registry/registry.json` has one `file` field per component. Splitting into `component.tsx` + `shader.ts` would break the CLI for any user who runs `matter-cli add`. **Do not convert flat registry components to subdirectory format** in this plan. All changes stay within the existing single `.tsx` file.

### Verifying your work

There are no unit tests for the GPU shader logic (you can't mock the GPU). The verification steps are:
1. `pnpm typecheck` — TypeScript must pass
2. `pnpm build` — packages must compile
3. For CLI changes: `pnpm --filter @lovo/matter-cli test`

Visual regression is covered by Playwright tests in `apps/docs-tests/` — those run in CI and you don't need to run them locally unless you have the docs site running.

---

## File Map

| File | Change |
|---|---|
| `registry/dot-field.tsx` | Extract `buildDotFieldMaterial(...)` private helper |
| `registry/waves.tsx` | Extract `buildWavesMaterial(...)` private helper |
| `registry/noise-field.tsx` | Extract `buildNoiseFieldMaterial(...)` private helper |
| `registry/linear-gradient.tsx` | Extract `buildLinearGradientMaterial(...)` private helper |
| `packages/matter-cli/src/registry/readUrl.ts` | Extract `readFileUrl` + `readHttpUrl` private helpers |
| `packages/matter-cli/src/config/validate.ts` | **New file** — `validateMatterConfig` + `isRecord` moved here |
| `packages/matter-cli/src/config/matterConfig.ts` | Import validator from `./validate.js`; remove local `validateMatterConfig` + `isRecord` |

---

## Task 1: Extract DotField shader builder

**Files:**
- Modify: `registry/dot-field.tsx`

The `DotField` component function has CC=10 because the `useEffect` that builds the TSL graph mixes shader construction with Three.js mesh lifecycle. Extract the shader construction into a private `buildDotFieldMaterial` function.

- [ ] **Step 1: Read the current file**

Confirm the file at `registry/dot-field.tsx` matches the version you have in context before making any changes.

- [ ] **Step 2: Extract the shader builder and rewrite the file**

Replace `registry/dot-field.tsx` with:

```tsx
'use client';

import { displace, sdfCircle } from '@lovo/matter';
import {
  type AnimatableProp,
  type CursorSignal,
  useAnimatableUniform,
  useCursor,
  useResize,
  useShaderContext,
} from '@lovo/matter-react';
import { useEffect, useMemo } from 'react';
import {
  length,
  mix,
  mod,
  smoothstep,
  uniform,
  uv,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import {
  Mesh,
  MeshBasicNodeMaterial,
  PlaneGeometry,
  Vector2,
} from 'three/webgpu';

export interface DotFieldProps {
  spacing?: AnimatableProp<number>;
  dotSize?: AnimatableProp<number>;
  color?: string;
  reach?: AnimatableProp<number>;
  strength?: AnimatableProp<number>;
  interactive?: boolean;
  inputs?: { cursor?: CursorSignal };
}

const DEFAULTS = {
  spacing: 30,
  dotSize: 2,
  color: '#8B918C',
  reach: 100,
  strength: 1,
};

const hexToVec3 = (hex: string): readonly [number, number, number] => {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;

  return [r, g, b];
};

function buildDotFieldMaterial(
  spacingU: ReturnType<typeof uniform<number>>,
  dotSizeU: ReturnType<typeof uniform<number>>,
  reachU: ReturnType<typeof uniform<number>>,
  strengthU: ReturnType<typeof uniform<number>>,
  cursorU: ReturnType<typeof uniform>,
  resU: ReturnType<typeof uniform>,
  color: readonly [number, number, number],
): MeshBasicNodeMaterial {
  const [cr, cg, cb] = color;

  const pxUv = uv().mul(resU).div(spacingU);
  const cellLocal = mod(pxUv, 1).sub(vec2(0.5, 0.5));

  const cellIndex = pxUv.sub(mod(pxUv, 1));
  const cellCenterUv = cellIndex
    .add(vec2(0.5, 0.5))
    .mul(spacingU)
    .div(resU);

  const cellToCursorPx = cellCenterUv.sub(cursorU).mul(-1).mul(resU);
  const distToCursorPx = length(cellToCursorPx);
  const influence = smoothstep(reachU, 0, distToCursorPx);

  const dirToCursor = cellToCursorPx.div(distToCursorPx.add(0.001));
  const offset = dirToCursor.mul(influence).mul(strengthU).mul(0.4);
  const displacedLocal = displace(cellLocal, offset.mul(-1));

  const zeroScalar = vec2(0).x;
  const radius = zeroScalar
    .add(dotSizeU)
    .div(zeroScalar.add(spacingU).mul(2));
  const sdf = sdfCircle(displacedLocal, radius);

  const aa = 0.01;
  const dotMask = smoothstep(aa, -aa, sdf);
  const dotColor = mix(vec3(0, 0, 0), vec3(cr, cg, cb), dotMask);

  const material = new MeshBasicNodeMaterial();

  material.colorNode = vec4(dotColor, dotMask);

  return material;
}

export function DotField(props: DotFieldProps) {
  const ctx = useShaderContext();
  const cursorFromInputs = props.inputs?.cursor;
  const cursorAuto = useCursor();
  const cursor =
    cursorFromInputs ?? (props.interactive ?? true ? cursorAuto : null);
  const resize = useResize();

  const spacingUniform = useAnimatableUniform<number>(
    props.spacing ?? DEFAULTS.spacing,
  );
  const dotSizeUniform = useAnimatableUniform<number>(
    props.dotSize ?? DEFAULTS.dotSize,
  );
  const reachUniform = useAnimatableUniform<number>(
    props.reach ?? DEFAULTS.reach,
  );
  const strengthUniform = useAnimatableUniform<number>(
    props.strength ?? DEFAULTS.strength,
  );

  const color = hexToVec3(props.color ?? DEFAULTS.color);

  const cursorVec = useMemo(() => new Vector2(0.5, 0.5), []);
  const cursorUniform = useMemo(() => uniform(cursorVec), [cursorVec]);

  useEffect(() => {
    if (cursor) return cursor.on('change', ([x, y]) => cursorVec.set(x, 1 - y));
    cursorVec.set(0.5, 0.5);

    return undefined;
  }, [cursor, cursorVec]);

  const resVec = useMemo(() => new Vector2(1920, 1080), []);
  const resUniform = useMemo(() => uniform(resVec), [resVec]);

  useEffect(() => {
    const [w, h] = resize.get();

    if (w > 0 && h > 0) resVec.set(w, h);

    return resize.on('change', ([w2, h2]) => resVec.set(w2, h2));
  }, [resize, resVec]);

  useEffect(() => {
    if (!ctx) return;

    const material = buildDotFieldMaterial(
      spacingUniform,
      dotSizeUniform,
      reachUniform,
      strengthUniform,
      cursorUniform,
      resUniform,
      color,
    );
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
  }, [
    ctx,
    color,
    spacingUniform,
    dotSizeUniform,
    reachUniform,
    strengthUniform,
    cursorUniform,
    resUniform,
  ]);

  return null;
}
```

**Note:** `color` was previously destructured as `[cr, cg, cb]` at component scope, which meant the color tuple was part of the deps array as three separate primitives. Now it's the tuple itself. This is equivalent — React will re-run the effect when any color channel changes because `hexToVec3` always produces a new array reference when called with a new hex string.

- [ ] **Step 3: Typecheck**

```bash
pnpm typecheck
```

Expected: no new errors. If `ReturnType<typeof uniform<number>>` is rejected, fall back to `Parameters<typeof buildDotFieldMaterial>[0]` or accept `unknown` at the call-site and cast — but prefer the explicit ReturnType form first.

- [ ] **Step 4: Commit**

```bash
git add registry/dot-field.tsx
git commit -m "refactor(registry): extract buildDotFieldMaterial shader builder"
```

---

## Task 2: Extract Waves shader builder

**Files:**
- Modify: `registry/waves.tsx`

- [ ] **Step 1: Read the current file**

Confirm `registry/waves.tsx` matches your context before editing.

- [ ] **Step 2: Extract the shader builder and rewrite the file**

Replace `registry/waves.tsx` with:

```tsx
// registry/waves.tsx
'use client';

import { cursorRipple, time } from '@lovo/matter';
import {
  type AnimatableProp,
  type CursorSignal,
  useAnimatableUniform,
  useCursor,
  useShaderContext,
} from '@lovo/matter-react';
import { useEffect, useMemo } from 'react';
import type { ShaderNodeObject } from 'three/tsl';
import { mix, sin, smoothstep, uniform, uv, vec2, vec3, vec4 } from 'three/tsl';
import {
  Mesh,
  MeshBasicNodeMaterial,
  PlaneGeometry,
  Vector2,
} from 'three/webgpu';
import type { Node } from 'three/webgpu';

export interface WavesProps {
  amplitude?: AnimatableProp<number>;
  frequency?: AnimatableProp<number>;
  speed?: AnimatableProp<number>;
  color?: string;
  layers?: number;
  interactive?: boolean;
  inputs?: { cursor?: CursorSignal };
}

const DEFAULTS = {
  amplitude: 0.1,
  frequency: 5,
  speed: 1,
  color: '#00cda6',
  layers: 3,
};

const hexToVec3 = (hex: string): readonly [number, number, number] => {
  const clean = hex.replace('#', '');

  return [
    parseInt(clean.slice(0, 2), 16) / 255,
    parseInt(clean.slice(2, 4), 16) / 255,
    parseInt(clean.slice(4, 6), 16) / 255,
  ];
};

function buildWavesMaterial(
  ampU: ReturnType<typeof uniform<number>>,
  freqU: ReturnType<typeof uniform<number>>,
  speedU: ReturnType<typeof uniform<number>>,
  cursorU: ReturnType<typeof uniform>,
  layers: number,
  color: readonly [number, number, number],
  hasCursor: boolean,
): MeshBasicNodeMaterial {
  const [cr, cg, cb] = color;
  const zeroScalar = vec2(0).x;
  const uvX = uv().x;
  const tNode = time;

  let waveSum: ShaderNodeObject<Node> = sin(
    uvX.mul(freqU).add(tNode.mul(speedU)),
  );
  let totalAmp = 1;

  for (let i = 1; i < layers; i += 1) {
    const layerFreq = zeroScalar.add(freqU).mul(1 + i * 0.7);
    const layerSpeed = zeroScalar.add(speedU).mul(1 + i * 0.4);
    const layerAmp = 1 / (i + 1);
    const phase = i * 1.3;
    const layer = sin(
      uvX.mul(layerFreq).add(tNode.mul(layerSpeed).add(phase)),
    );

    waveSum = waveSum.add(layer.mul(layerAmp));
    totalAmp += layerAmp;
  }

  const baseWave = waveSum.div(totalAmp).mul(ampU);
  const fullWave: ShaderNodeObject<Node> = hasCursor
    ? baseWave.add(cursorRipple(uv(), cursorU))
    : baseWave;

  const distFromBand = uv().y.sub(0.5).sub(fullWave).abs();
  const mask = smoothstep(0.04, 0.0, distFromBand);

  const colorVec = vec3(cr, cg, cb);
  const waveColor = mix(vec3(0, 0, 0), colorVec, mask);

  const material = new MeshBasicNodeMaterial();

  material.colorNode = vec4(waveColor, mask);

  return material;
}

export function Waves(props: WavesProps) {
  const ctx = useShaderContext();
  const cursorFromInputs = props.inputs?.cursor;
  const cursorAuto = useCursor();
  const cursor =
    cursorFromInputs ?? (props.interactive === true ? cursorAuto : null);

  const layers = Math.max(1, props.layers ?? DEFAULTS.layers);
  const color = hexToVec3(props.color ?? DEFAULTS.color);

  const ampUniform = useAnimatableUniform<number>(
    props.amplitude ?? DEFAULTS.amplitude,
  );
  const freqUniform = useAnimatableUniform<number>(
    props.frequency ?? DEFAULTS.frequency,
  );
  const speedUniform = useAnimatableUniform<number>(
    props.speed ?? DEFAULTS.speed,
  );

  const cursorVec = useMemo(() => new Vector2(0.5, 0.5), []);
  const cursorUniform = useMemo(() => uniform(cursorVec), [cursorVec]);

  useEffect(() => {
    if (cursor) return cursor.on('change', ([x, y]) => cursorVec.set(x, 1 - y));
    cursorVec.set(0.5, 0.5);

    return undefined;
  }, [cursor, cursorVec]);

  useEffect(() => {
    if (!ctx) return;

    const material = buildWavesMaterial(
      ampUniform,
      freqUniform,
      speedUniform,
      cursorUniform,
      layers,
      color,
      cursor !== null,
    );
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
  }, [
    ctx,
    layers,
    color,
    ampUniform,
    freqUniform,
    speedUniform,
    cursor,
    cursorUniform,
  ]);

  return null;
}
```

**Note on `hasCursor`:** The original code used `cursor` directly inside the effect to branch `baseWave.add(cursorRipple(...))`. Since `cursor` is a signal object (or null), and the effect already depends on `cursor` in its deps array, passing `cursor !== null` as a boolean `hasCursor` to the builder is equivalent and avoids capturing the cursor signal in the builder (which is a pure TSL function, not a React hook).

- [ ] **Step 3: Typecheck**

```bash
pnpm typecheck
```

Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add registry/waves.tsx
git commit -m "refactor(registry): extract buildWavesMaterial shader builder"
```

---

## Task 3: Extract NoiseField shader builder

**Files:**
- Modify: `registry/noise-field.tsx`

- [ ] **Step 1: Read the current file**

Confirm `registry/noise-field.tsx` matches your context before editing.

- [ ] **Step 2: Extract the shader builder and rewrite the file**

Replace `registry/noise-field.tsx` with:

```tsx
'use client';

import {
  colorRamp,
  type ColorRampStop,
  fbm,
  quantize,
  time,
  voronoi,
} from '@lovo/matter';
import {
  type AnimatableProp,
  type CursorSignal,
  useAnimatableUniform,
  useCursor,
  useShaderContext,
} from '@lovo/matter-react';
import { useEffect, useMemo } from 'react';
import { uniform, uv, vec2, vec3 } from 'three/tsl';
import {
  Mesh,
  MeshBasicNodeMaterial,
  PlaneGeometry,
  Vector2,
} from 'three/webgpu';

export interface NoiseFieldProps {
  scale?: AnimatableProp<number>;
  speed?: AnimatableProp<number>;
  colors?: AnimatableProp<string[]>;
  octaves?: number;
  variant?: 'organic' | 'cellular' | 'grid';
  interactive?: boolean;
  inputs?: { cursor?: CursorSignal };
}

const DEFAULT_COLORS = ['#131614', '#E7E9E7'];
const GRID_STEPS = 6;

const hexToVec3 = (hex: string): readonly [number, number, number] => {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;

  return [r, g, b];
};

const isSignalLike = (v: unknown): v is { get(): unknown } =>
  typeof v === 'object' &&
  v !== null &&
  'get' in v &&
  typeof v.get === 'function';

const resolveColors = (
  prop: AnimatableProp<string[]> | undefined,
): string[] => {
  if (prop === undefined) return DEFAULT_COLORS;
  if (isSignalLike(prop)) return prop.get();

  return prop;
};

function buildNoiseFieldMaterial(
  scaleU: ReturnType<typeof uniform<number>>,
  speedU: ReturnType<typeof uniform<number>>,
  stops: ColorRampStop[],
  variant: 'organic' | 'cellular' | 'grid',
  octaves: number,
): MeshBasicNodeMaterial {
  const baseUv = uv().mul(scaleU);
  const tOff = time.mul(speedU);
  const animatedUv = baseUv.add(vec2(tOff, tOff));

  let t;

  if (variant === 'cellular') {
    t = voronoi(animatedUv);
  } else if (variant === 'grid') {
    const raw = fbm(animatedUv, { octaves });
    const norm = raw.add(1).mul(0.5);

    t = quantize(norm, GRID_STEPS);
  } else {
    const raw = fbm(animatedUv, { octaves });

    t = raw.add(1).mul(0.5);
  }

  const material = new MeshBasicNodeMaterial();

  material.colorNode = colorRamp(t, stops);

  return material;
}

export function NoiseField(props: NoiseFieldProps) {
  const ctx = useShaderContext();
  const colors = resolveColors(props.colors);
  const colorsKey = colors.join('|');
  const octaves = props.octaves ?? 4;
  const variant = props.variant ?? 'organic';

  const cursorFromInputs = props.inputs?.cursor;
  const cursorAuto = useCursor();
  const cursor =
    cursorFromInputs ?? (props.interactive === true ? cursorAuto : null);

  const scaleUniform = useAnimatableUniform<number>(props.scale ?? 1);
  const speedUniform = useAnimatableUniform<number>(props.speed ?? 0.5);

  const cursorVec = useMemo(() => new Vector2(0.5, 0.5), []);
  const _cursorUniform = useMemo(() => uniform(cursorVec), [cursorVec]);

  useEffect(() => {
    if (cursor) {
      return cursor.on('change', ([x, y]) => cursorVec.set(x, 1 - y));
    }
    cursorVec.set(0.5, 0.5);

    return undefined;
  }, [cursor, cursorVec]);

  useEffect(() => {
    if (!ctx) return;

    const stops: ColorRampStop[] = colors.map((hex, i) => {
      const [r, g, b] = hexToVec3(hex);

      return {
        color: vec3(r, g, b),
        position: i / Math.max(colors.length - 1, 1),
      };
    });

    const material = buildNoiseFieldMaterial(
      scaleUniform,
      speedUniform,
      stops,
      variant,
      octaves,
    );
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, colorsKey, octaves, variant, scaleUniform, speedUniform]);

  return null;
}
```

**Note on `stops` construction:** The `stops` array is built inside the effect (not in the builder) because it uses `vec3` TSL calls alongside the color data, and this keeps the builder's signature simple — it receives already-built stops.

- [ ] **Step 3: Typecheck**

```bash
pnpm typecheck
```

Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add registry/noise-field.tsx
git commit -m "refactor(registry): extract buildNoiseFieldMaterial shader builder"
```

---

## Task 4: Extract LinearGradient shader builder

**Files:**
- Modify: `registry/linear-gradient.tsx`

This one is slightly more involved: the builder needs to read `angleUniform.value` and `speedUniform.value` at call time (not as TSL reactive nodes) to compute the angle direction and decide whether to apply animation. Pass the uniform nodes in and read `.value` inside the builder.

- [ ] **Step 1: Read the current file**

Confirm `registry/linear-gradient.tsx` matches your context before editing.

- [ ] **Step 2: Extract the shader builder and rewrite the file**

Replace `registry/linear-gradient.tsx` with:

```tsx
'use client';

import { colorRamp, type ColorRampStop, time } from '@lovo/matter';
import {
  type AnimatableProp,
  type CursorSignal,
  useAnimatableUniform,
  useCursor,
  useShaderContext,
  useStaticHint,
} from '@lovo/matter-react';
import { useEffect, useMemo } from 'react';
import { length, mod, uniform, uv, vec2, vec3 } from 'three/tsl';
import {
  Mesh,
  MeshBasicNodeMaterial,
  PlaneGeometry,
  Vector2,
} from 'three/webgpu';

export interface LinearGradientProps {
  colors?: AnimatableProp<string[]>;
  angle?: AnimatableProp<number>;
  variant?: 'linear' | 'radial';
  focalPoint?: AnimatableProp<readonly [number, number]>;
  speed?: AnimatableProp<number>;
  interactive?: boolean;
  inputs?: { cursor?: CursorSignal };
}

const DEFAULT_COLORS = ['#d9f384', '#00ab34'];

const hexToVec3 = (hex: string): readonly [number, number, number] => {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;

  return [r, g, b];
};

const isSignalLike = (v: unknown): v is { get(): unknown } =>
  typeof v === 'object' &&
  v !== null &&
  'get' in v &&
  typeof v.get === 'function';

const isPoint = (v: unknown): v is readonly [number, number] =>
  Array.isArray(v) &&
  v.length === 2 &&
  typeof v[0] === 'number' &&
  typeof v[1] === 'number';

const resolveColors = (
  prop: AnimatableProp<string[]> | undefined,
): string[] => {
  if (prop === undefined) return DEFAULT_COLORS;
  if (isSignalLike(prop)) return (prop as { get(): string[] }).get();

  return prop;
};

function buildLinearGradientMaterial(
  angleU: ReturnType<typeof uniform<number>>,
  speedU: ReturnType<typeof uniform<number>>,
  cursorU: ReturnType<typeof uniform>,
  colors: string[],
  variant: 'linear' | 'radial' | undefined,
): MeshBasicNodeMaterial {
  const stops: ColorRampStop[] = colors.map((hex, i) => {
    const [r, g, b] = hexToVec3(hex);

    return {
      color: vec3(r, g, b),
      position: i / Math.max(colors.length - 1, 1),
    };
  });

  let tNode;

  if (variant === 'radial') {
    tNode = length(uv().sub(cursorU));
  } else {
    const angleRad = angleU.value * (Math.PI / 180);
    const dirX = Math.cos(angleRad);
    const dirY = Math.sin(angleRad);

    tNode = uv().sub(cursorU).dot(vec2(dirX, dirY)).add(0.5);
  }

  const speedScalar = speedU.value;
  const tAnimated =
    speedScalar === 0
      ? tNode
      : mod(tNode.add(time.mul(speedScalar)), 2)
          .sub(1)
          .abs()
          .oneMinus();

  const material = new MeshBasicNodeMaterial();

  material.colorNode = colorRamp(tAnimated, stops);

  return material;
}

export function LinearGradient(props: LinearGradientProps) {
  const ctx = useShaderContext();
  const cursorFromInputs = props.inputs?.cursor;
  const cursorAuto = useCursor();
  const cursor =
    cursorFromInputs ?? (props.interactive === true ? cursorAuto : null);

  const isStatic = typeof props.speed === 'number' && props.speed === 0;

  useStaticHint(isStatic);

  const colors = resolveColors(props.colors);
  const colorsKey = colors.join('|');

  const angleUniform = useAnimatableUniform<number>(props.angle ?? 0);
  const speedUniform = useAnimatableUniform<number>(props.speed ?? 0);
  const focalUniform = useAnimatableUniform<readonly [number, number]>(
    props.focalPoint ?? [0.5, 0.5],
  );

  const cursorVec = useMemo(() => new Vector2(0.5, 0.5), []);
  const cursorUniform = useMemo(() => uniform(cursorVec), [cursorVec]);

  useEffect(() => {
    if (cursor) {
      return cursor.on('change', ([x, y]) => cursorVec.set(x, 1 - y));
    }
    const fp = props.focalPoint;

    if (isPoint(fp)) {
      cursorVec.set(fp[0], 1 - fp[1]);
    } else {
      cursorVec.set(0.5, 0.5);
    }

    return undefined;
  }, [cursor, cursorVec, props.focalPoint]);

  useEffect(() => {
    if (!ctx) return;

    const material = buildLinearGradientMaterial(
      angleUniform,
      speedUniform,
      cursorUniform,
      colors,
      props.variant,
    );
    const mesh = new Mesh(new PlaneGeometry(2, 2), material);

    ctx.scene.add(mesh);

    return () => {
      ctx.scene.remove(mesh);

      try {
        material.dispose();
      } catch (err) {
        console.debug('[LinearGradient] material.dispose ignored:', err);
      }
      try {
        mesh.geometry.dispose();
      } catch (err) {
        console.debug('[LinearGradient] geometry.dispose ignored:', err);
      }
    };
  }, [
    ctx,
    props.variant,
    colorsKey,
    cursor,
    angleUniform,
    speedUniform,
    focalUniform,
    cursorUniform,
  ]);

  return null;
}
```

- [ ] **Step 3: Typecheck**

```bash
pnpm typecheck
```

Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add registry/linear-gradient.tsx
git commit -m "refactor(registry): extract buildLinearGradientMaterial shader builder"
```

---

## Task 5: Flatten readUrl protocol handlers

**Files:**
- Modify: `packages/matter-cli/src/registry/readUrl.ts`

`readUrl` has the highest cognitive complexity in the codebase (16) despite being only 44 lines. The issue is 4+ levels of nesting from `if (protocol) → try → if (err.code)`. Extract private helpers for each protocol branch to flatten the nesting.

- [ ] **Step 1: Read the current file**

Confirm `packages/matter-cli/src/registry/readUrl.ts` matches your context before editing.

- [ ] **Step 2: Run the existing tests to establish a baseline**

```bash
pnpm --filter @lovo/matter-cli test
```

Expected: all tests pass. Note the exact count so you can verify nothing regressed after your change.

- [ ] **Step 3: Rewrite the file**

Replace `packages/matter-cli/src/registry/readUrl.ts` with:

```ts
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

async function readFileUrl(filePath: string): Promise<string> {
  try {
    return await readFile(filePath, 'utf-8');
  } catch (err) {
    if (err instanceof Error && 'code' in err && err.code === 'ENOENT') {
      throw new Error(`File not found: ${filePath}`);
    }
    throw err;
  }
}

async function readHttpUrl(url: string): Promise<string> {
  let res: Response;

  try {
    res = await fetch(url);
  } catch (err) {
    throw new Error(
      `Failed to fetch ${url}: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }

  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  }

  return res.text();
}

export async function readUrl(url: string): Promise<string> {
  const parsed = new URL(url);

  if (parsed.protocol === 'file:') {
    return readFileUrl(fileURLToPath(parsed));
  }

  if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
    return readHttpUrl(url);
  }

  throw new Error(
    `Unsupported protocol: ${parsed.protocol} (only file://, http://, https:// are supported)`,
  );
}
```

- [ ] **Step 4: Run tests again**

```bash
pnpm --filter @lovo/matter-cli test
```

Expected: same pass count as before Step 2. All tests pass.

- [ ] **Step 5: Typecheck**

```bash
pnpm typecheck
```

Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add packages/matter-cli/src/registry/readUrl.ts
git commit -m "refactor(matter-cli): extract readFileUrl + readHttpUrl helpers in readUrl"
```

---

## Task 6: Extract validateMatterConfig to validate.ts

**Files:**
- Create: `packages/matter-cli/src/config/validate.ts`
- Modify: `packages/matter-cli/src/config/matterConfig.ts`

`matterConfig.ts` does two things: config I/O (read, write, exists, path) and config schema validation. The `validateMatterConfig` function (CC=10, cog=10) handles all field checks. Move it to its own focused module so `matterConfig.ts` becomes purely about file I/O.

- [ ] **Step 1: Run tests to establish baseline**

```bash
pnpm --filter @lovo/matter-cli test
```

Expected: all tests pass.

- [ ] **Step 2: Create validate.ts**

Create `packages/matter-cli/src/config/validate.ts`:

```ts
import type { MatterConfig } from './matterConfig.js';

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null;
}

export function validateMatterConfig(
  parsed: unknown,
  path: string,
): MatterConfig {
  if (!isRecord(parsed)) {
    throw new Error(`${path}: expected an object`);
  }
  const obj = parsed;

  if (typeof obj.componentsDir !== 'string' || obj.componentsDir === '') {
    throw new Error(`${path}: missing or empty "componentsDir" string`);
  }
  if (typeof obj.registryUrl !== 'string' || obj.registryUrl === '') {
    throw new Error(`${path}: missing or empty "registryUrl" string`);
  }
  if (!isRecord(obj.aliases)) {
    throw new Error(`${path}: missing "aliases" object`);
  }
  if (typeof obj.tsx !== 'boolean') {
    throw new Error(`${path}: missing "tsx" boolean`);
  }
  const aliases: Record<string, string> = {};

  for (const [k, v] of Object.entries(obj.aliases)) {
    if (typeof v !== 'string') {
      throw new Error(`${path}: aliases.${k} must be a string`);
    }
    aliases[k] = v;
  }

  return {
    componentsDir: obj.componentsDir,
    registryUrl: obj.registryUrl,
    aliases,
    tsx: obj.tsx,
  };
}
```

**Note on the circular import:** `validate.ts` imports the `MatterConfig` type from `matterConfig.ts`, and `matterConfig.ts` will import `validateMatterConfig` from `validate.ts`. This is a type-only import in one direction (`import type { MatterConfig }`), so there is no runtime circular dependency.

- [ ] **Step 3: Rewrite matterConfig.ts**

Replace `packages/matter-cli/src/config/matterConfig.ts` with:

```ts
import { access, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { validateMatterConfig } from './validate.js';

export interface MatterConfig {
  componentsDir: string;
  registryUrl: string;
  aliases: Record<string, string>;
  tsx: boolean;
}

export const DEFAULT_MATTER_CONFIG: MatterConfig = {
  componentsDir: 'src/components/matter',
  registryUrl:
    'https://raw.githubusercontent.com/lovo-hq/matter/${ref}/registry',
  aliases: { '@/': 'src/' },
  tsx: true,
};

const CONFIG_FILENAME = 'matter.config.json';

export function configPath(projectRoot: string): string {
  return join(projectRoot, CONFIG_FILENAME);
}

export async function configExists(projectRoot: string): Promise<boolean> {
  try {
    await access(configPath(projectRoot));

    return true;
  } catch {
    return false;
  }
}

export async function readMatterConfig(
  projectRoot: string,
): Promise<MatterConfig> {
  const path = configPath(projectRoot);
  let raw: string;

  try {
    raw = await readFile(path, 'utf-8');
  } catch (err) {
    if (err instanceof Error && 'code' in err && err.code === 'ENOENT') {
      throw new Error(
        `matter.config.json not found in ${projectRoot}. Run \`matter-cli init\` first.`,
      );
    }
    throw err;
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `${path} is not valid JSON: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }

  return validateMatterConfig(parsed, path);
}

export function resolveRegistryUrl(
  cfg: MatterConfig,
  opts: { registry?: string; ref: string },
): string {
  const baseUrl = opts.registry ?? cfg.registryUrl;

  return baseUrl.replace('${ref}', opts.ref);
}

export async function writeMatterConfig(
  projectRoot: string,
  cfg: MatterConfig,
): Promise<void> {
  const path = configPath(projectRoot);
  const json = `${JSON.stringify(cfg, null, 2)}\n`;

  await writeFile(path, json, 'utf-8');
}
```

- [ ] **Step 4: Run tests**

```bash
pnpm --filter @lovo/matter-cli test
```

Expected: same pass count as Step 1. All tests pass.

- [ ] **Step 5: Typecheck**

```bash
pnpm typecheck
```

Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add packages/matter-cli/src/config/validate.ts packages/matter-cli/src/config/matterConfig.ts
git commit -m "refactor(matter-cli): extract validateMatterConfig to validate.ts"
```

---

## Final Verification

After all tasks are complete, run the full suite to confirm nothing is broken:

- [ ] **Run all tests**

```bash
pnpm test
```

Expected: all tests pass across all packages.

- [ ] **Full typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Build all packages**

```bash
pnpm build
```

Expected: all packages build cleanly.

- [ ] **Confirm complexity improvements with fallow**

```bash
npx fallow health --format json --quiet 2>/dev/null | python3 -c "
import json, sys
data = json.load(sys.stdin)
s = data['summary']
print(f'Functions above threshold: {s[\"functions_above_threshold\"]} (was 32)')
print(f'Critical: {s[\"severity_critical_count\"]} (was 5)')
print(f'High: {s[\"severity_high_count\"]} (was 7)')
" || true
```

Expected: functions above threshold drops significantly (registry component functions and readUrl should be out of the critical/high buckets).

---

## Appendix: Pre-existing issues not in scope

These were observed during planning but are separate from complexity reduction:

1. **Multi-file CLI distribution bug:** `registry/aurora/aurora.tsx` imports from `./shader` but `registry.json` only lists `aurora/aurora.tsx` as the CLI-distributed file. A user running `matter-cli add aurora` would receive a broken component. Same for `grain`, `mesh-gradient`, `vignette`. Fix requires adding a `files: string[]` field to `RegistryEntry` and updating the `add` command to fetch all listed files. Track separately.

2. **`registrySources.ts` path bug:** `apps/docs/src/lib/registrySources.ts` constructs paths as `${slug}.tsx` for all slugs including `mesh-gradient` and `aurora`, which would resolve to non-existent flat files. These docs pages must be reading their source differently. Investigate separately if the docs source viewer is broken for multi-file components.

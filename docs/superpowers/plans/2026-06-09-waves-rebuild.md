# Waves Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **CRITICAL — co-write process applies to Phases 2–4.** The user writes the shader code (in `registry/waves/shader.tsx`) chunk by chunk. Do NOT call Edit or Write on shader code in those phases; describe the chunk, paste the target snippet, wait for the user to apply it, then proceed. Phases 1 and 5 are mechanical plumbing — Edit/Write is fine there. See `feedback_shader_co_write.md` and `feedback_shader_phase_gates.md`.

**Goal:** Refactor `<Waves>` to (1) drop the cursor-ripple interaction entirely, (2) adopt the Aurora-style `registry/waves/{waves,shader}.tsx` split, and (3) re-author the TSL graph from a ShaderToy reference (additive `1/(150*y)` proximity-glow waves) with a richer prop surface.

**Architecture:** Match Aurora's two-file pattern: a thin `waves.tsx` wrapper that sets defaults and forwards props to a `<WavesShader>` component in `shader.tsx`, where uniforms + mesh lifecycle + TSL graph live. Live-tunable scalars (`amplitude`, `frequency`, `speed`, `intensity`, `thickness`, `baseline`, `phaseSpread`) and the `color` vec3 flow through stable `uniform(...)` nodes; `count` is a build-time JS loop and triggers material rebuild on change (per gotcha #17, same pattern as Aurora's 4-layer unroll and LinearGradient's stops).

**Tech Stack:** TypeScript 5 strict, React 19, three 0.170 (`three/webgpu` + `three/tsl`), `@lovo/matter` engine + `@lovo/matter-react` (`useAnimatableUniform`, `useShaderContext`), Tweakpane on the docs page, Playwright visual regression.

**Reference shader (ShaderToy, with the background-grid section already stripped):**

```glsl
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord.xy / iResolution.xy;
  vec3 wave_color = vec3(0.0);

  float wave_width = 0.01;
  uv  = -1.0 + 2.0 * uv;     // centered space
  uv.y += 0.1;               // baseline shift
  for(float i = 0.0; i < 10.0; i++) {
    uv.y += (0.07 * sin(uv.x + i/7.0 + iTime));   // mutate y per layer
    wave_width = abs(1.0 / (150.0 * uv.y));        // proximity glow
    wave_color += vec3(wave_width * 1.9, wave_width, wave_width * 1.5);
  }
  fragColor = vec4(wave_color, 1.0);
}
```

**Prop surface (final, post-rebuild):**

| Prop | Type | Default | Maps to | Tunability |
| --- | --- | --- | --- | --- |
| `amplitude` | `AnimatableProp<number>` | `0.07` | the `0.07` in the y-mutation | live uniform |
| `frequency` | `AnimatableProp<number>` | `1` | multiplier on `uv.x` inside `sin` | live uniform |
| `speed` | `AnimatableProp<number>` | `1` | multiplier on `time` inside `sin` | live uniform |
| `intensity` | `AnimatableProp<number>` | `1` | post-accumulation brightness multiplier | live uniform |
| `thickness` | `AnimatableProp<number>` | `150` | divisor in the `1/(thickness*y)` glow | live uniform |
| `baseline` | `AnimatableProp<number>` | `0.1` | initial `uv.y` shift before the loop | live uniform |
| `phaseSpread` | `AnimatableProp<number>` | `1` | multiplier on the `i/7` per-layer phase offset | live uniform |
| `color` | `string` (hex) | `'#77eecc'` | replaces the `(1.9, 1.0, 1.5)` channel weighting | live uniform (vec3) |
| `count` | `number` | `10` | JS-side loop iterations | structural — rebuilds material |

The previous props `layers`, `interactive`, and `inputs.cursor` are removed. `layers` becomes `count` (renamed for clarity — it's the loop count, not the multi-layer color/speed structure that Aurora's `layers` is).

---

## File Structure

**New files (created in Phase 1):**

- `registry/waves/waves.tsx` — thin wrapper. Sets defaults, forwards everything to `<WavesShader>`. ~50 lines.
- `registry/waves/shader.tsx` — `<WavesShader>` (the real work): uniforms, color uniform, mesh lifecycle, the TSL graph. ~130 lines once Phase 4 is done.

**Files deleted:**

- `registry/waves.tsx` (replaced by the two files above).

**Files modified:**

- `registry/registry.json` — update `waves.file`, `waves.description`, `waves.uses_primitives`.
- `registry/package.json` — update the `./waves` export path.
- `apps/docs/src/app/components/waves/page.tsx` — drop `interactive` from `Params` + tweakpane bindings + inline code block; add the new props in Phase 5.
- `apps/docs/src/app/dev/reduced-motion/ReducedMotionDemo.tsx` — remove the `interactive` prop on `<Waves>` and the cursor copy in the surrounding `<p>`.
- `apps/docs-tests/visual/waves.spec.ts-snapshots/*.png` — re-baselined in Phase 5 (the visual will have changed; that's expected).

---

## Phase 1 — Demolition + Aurora-style split

**Behavioral goal:** identical to today's render minus cursor ripple. No new shader math yet; just move the existing waves TSL into the new file structure with the cursor branch removed.

**Stop gate:** dev server, `/components/waves` renders the same animated bands as before, no cursor reactivity. Lint + typecheck clean. Visual regression *will* fail (cursor ripple is gone from steady-state too) — leave the snapshot stale until Phase 5.

### Task 1.1: Create `registry/waves/waves.tsx` wrapper

**Files:**
- Create: `registry/waves/waves.tsx`

- [ ] **Step 1: Write the wrapper file**

```tsx
'use client';

import type { AnimatableProp } from '@lovo/matter-react';

import { WavesShader } from './shader';

export interface WavesProps {
  amplitude?: AnimatableProp<number>;
  frequency?: AnimatableProp<number>;
  speed?: AnimatableProp<number>;
  color?: string;
  layers?: number;
}

export function Waves({
  amplitude = 0.1,
  frequency = 5,
  speed = 1,
  color = '#00cda6',
  layers = 3,
}: WavesProps) {
  return (
    <WavesShader
      amplitude={amplitude}
      color={color}
      frequency={frequency}
      layers={layers}
      speed={speed}
    />
  );
}
```

> **Note:** Defaults in Phase 1 mirror the *current* component (amplitude=0.1, frequency=5, layers=3, color teal). The new prop surface (amplitude=0.07, frequency=1, count=10, etc., plus `intensity`/`thickness`/`baseline`/`phaseSpread`) lands incrementally in Phase 4 — don't add those props yet. Keep `layers` for now; it's renamed to `count` in Phase 4.

- [ ] **Step 2: Verify (no commit yet — Task 1.2 commits together)**

### Task 1.2: Create `registry/waves/shader.tsx` with cursor logic stripped

**Files:**
- Create: `registry/waves/shader.tsx`

This is the existing `registry/waves.tsx` TSL — verbatim — minus everything cursor-related. Specifically removed: `useCursor`, `CursorSignal` type, the `cursorFromInputs`/`cursorAuto`/`cursor` chain, the `cursorVec`/`cursorUniform`, the `cursor.on('change', …)` effect, the `hasCursor` parameter to `buildWavesMaterial`, and the `cursorRipple(uv(), cursorU)` branch in the TSL graph. The `inputs` prop is also dropped.

- [ ] **Step 1: Write the shader file**

```tsx
'use client';

import { useEffect, useMemo } from 'react';

import { time } from '@lovo/matter';
import { type AnimatableProp, useAnimatableUniform, useShaderContext } from '@lovo/matter-react';
import type { ShaderNodeObject } from 'three/tsl';
import { mix, sin, smoothstep, uv, vec2, vec3, vec4 } from 'three/tsl';
import { Mesh, MeshBasicNodeMaterial, type Node, PlaneGeometry } from 'three/webgpu';

export interface WavesShaderProps {
  amplitude: AnimatableProp<number>;
  frequency: AnimatableProp<number>;
  speed: AnimatableProp<number>;
  color: string;
  layers: number;
}

const hexToVec3 = (hex: string): readonly [number, number, number] => {
  const clean = hex.replace('#', '');

  return [
    parseInt(clean.slice(0, 2), 16) / 255,
    parseInt(clean.slice(2, 4), 16) / 255,
    parseInt(clean.slice(4, 6), 16) / 255,
  ];
};

function buildWavesMaterial(
  ampU: ShaderNodeObject<Node>,
  freqU: ShaderNodeObject<Node>,
  speedU: ShaderNodeObject<Node>,
  layers: number,
  color: readonly [number, number, number],
): MeshBasicNodeMaterial {
  const [cr, cg, cb] = color;
  const zeroScalar = vec2(0).x;
  const uvX = uv().x;
  const tNode = time;

  let waveSum: ShaderNodeObject<Node> = sin(uvX.mul(freqU).add(tNode.mul(speedU)));
  let totalAmp = 1;

  for (let i = 1; i < layers; i += 1) {
    const layerFreq = zeroScalar.add(freqU).mul(1 + i * 0.7);
    const layerSpeed = zeroScalar.add(speedU).mul(1 + i * 0.4);
    const layerAmp = 1 / (i + 1);
    const phase = i * 1.3;
    const layer = sin(uvX.mul(layerFreq).add(tNode.mul(layerSpeed).add(phase)));

    waveSum = waveSum.add(layer.mul(layerAmp));
    totalAmp += layerAmp;
  }

  const baseWave = waveSum.div(totalAmp).mul(ampU);
  const distFromBand = uv().y.sub(0.5).sub(baseWave).abs();
  const mask = smoothstep(0.04, 0.0, distFromBand);

  const colorVec = vec3(cr, cg, cb);
  const waveColor = mix(vec3(0, 0, 0), colorVec, mask);

  const material = new MeshBasicNodeMaterial();

  material.colorNode = vec4(waveColor, mask);

  return material;
}

export function WavesShader(props: WavesShaderProps) {
  const ctx = useShaderContext();
  const layers = Math.max(1, props.layers);

  const color = useMemo(() => hexToVec3(props.color), [props.color]);

  const ampUniform = useAnimatableUniform<number>(props.amplitude);
  const freqUniform = useAnimatableUniform<number>(props.frequency);
  const speedUniform = useAnimatableUniform<number>(props.speed);

  useEffect(() => {
    if (!ctx) return;

    const material = buildWavesMaterial(
      ampUniform,
      freqUniform,
      speedUniform,
      layers,
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
  }, [ctx, layers, color, ampUniform, freqUniform, speedUniform]);

  return null;
}
```

- [ ] **Step 2: Verify the file structure**

Run: `ls registry/waves/`
Expected: `shader.tsx  waves.tsx`

### Task 1.3: Delete the old single-file component

**Files:**
- Delete: `registry/waves.tsx`

- [ ] **Step 1: Remove the file**

Run: `rm registry/waves.tsx`

- [ ] **Step 2: Confirm removal**

Run: `ls registry/waves.tsx 2>/dev/null; echo "exit=$?"`
Expected: `exit=2` (file no longer exists).

### Task 1.4: Update the registry exports

**Files:**
- Modify: `registry/package.json:12`
- Modify: `registry/registry.json:55-72`

- [ ] **Step 1: Update `package.json` exports**

Change line 12 from:
```json
    "./waves": "./waves.tsx",
```
To:
```json
    "./waves": "./waves/waves.tsx",
```

- [ ] **Step 2: Update `registry.json`**

Change the `"waves"` entry (lines 55–72) `file` and `description` fields, and drop `cursorRipple` from `uses_primitives`:

```json
    "waves": {
      "file": "waves/waves.tsx",
      "description": "Layered sine waves on a black background — animated bands with adjustable amplitude, frequency, and speed.",
      "dependencies": ["@lovo/matter", "@lovo/matter-react", "react", "three"],
      "uses_primitives": [
        "sin",
        "mix",
        "smoothstep",
        "uv",
        "vec2",
        "vec3",
        "vec4",
        "time",
        "uniform"
      ],
      "tier": 1
    },
```

> The `description` and `uses_primitives` will be refined again in Phase 5 to reflect the rebuilt shader; this interim update just gets cursorRipple out.

### Task 1.5: Remove cursor usage from downstream consumers

**Files:**
- Modify: `apps/docs/src/app/components/waves/page.tsx`
- Modify: `apps/docs/src/app/dev/reduced-motion/ReducedMotionDemo.tsx`

- [ ] **Step 1: Update the docs page**

In `apps/docs/src/app/components/waves/page.tsx`:
- Remove `interactive: boolean` from `Params` (line 20) and from `INITIAL` (line 29).
- Remove the `pane.addBinding(local, 'interactive', …)` block and the surrounding separator and "Apply layers / interactive" button (lines 43–48), plus the `key === 'interactive'` check in the `pane.on('change', …)` handler.
- Remove the `interactive={params.interactive}` prop on `<Waves>` (line 66).
- Remove `interactive` from the inline code block string (line 97).

The pane callback after edit should still keep `layers` in the "rebuilds-material" skip-list:

```ts
pane.on('change', (ev) => {
  if ('key' in ev.target && ev.target.key === 'layers') {
    return;
  }
  sync();
});
```

And keep an "Apply layers" button (since `layers` still rebuilds the material):

```ts
pane.addButton({ title: 'Apply layers' }).on('click', sync);
```

- [ ] **Step 2: Update the reduced-motion dev page**

In `apps/docs/src/app/dev/reduced-motion/ReducedMotionDemo.tsx`:
- Remove the `interactive` prop on `<Waves>` (line 79).
- Replace the cursor-ripple copy in the surrounding `<p>` (lines 69–72) with something neutral like:
  ```tsx
  <p style={{ margin: '0 0 0.5rem', fontSize: '0.8rem', color: '#666' }}>
    The waves should freeze when policy is paused.
  </p>
  ```

### Task 1.6: Verify build + lint + dev

**Files:** none modified.

- [ ] **Step 1: Typecheck**

Run: `pnpm typecheck`
Expected: no errors. (If the waves package isn't in the workspace's typecheck graph, also run `pnpm --filter @matter/registry typecheck` and `pnpm --filter @matter/docs typecheck`.)

- [ ] **Step 2: Lint**

Run: `pnpm lint`
Expected: no errors.

- [ ] **Step 3: Format**

Run: `pnpm format`

- [ ] **Step 4: Manual dev-server validation (STOP GATE)**

Run: `pnpm --filter @matter/docs dev`
Open: `http://localhost:3000/components/waves`
Expected behavior:
- Same animated waves render as before this phase.
- No cursor-ripple effect when mousing over the canvas.
- No console errors. No `usedTimes` crash on hot reload.
- Tweakpane sliders for `color`, `amplitude`, `frequency`, `speed`, and `layers` still work.

**Also check `/dev/reduced-motion`:** Waves still renders, cursor copy is gone.

**Wait for the user to confirm before proceeding to Phase 2.**

### Task 1.7: Commit

- [ ] **Step 1: Commit**

```bash
git add registry/waves registry/package.json registry/registry.json \
        apps/docs/src/app/components/waves/page.tsx \
        apps/docs/src/app/dev/reduced-motion/ReducedMotionDemo.tsx
git rm registry/waves.tsx
git commit -m "refactor(matter): split waves into waves/{waves,shader}.tsx and drop cursor ripple"
```

---

## Phase 2 — Translate the ShaderToy core (single unrolled iteration)

**Behavioral goal:** one bright glowing horizontal band with the characteristic `1/(150*y)` proximity glow, animated by `iTime`. Color is hardcoded `vec3(1.9, 1.0, 1.5)`. This is a from-scratch port of the ShaderToy with **just one iteration of the loop unrolled** — no JS loop yet.

**Stop gate:** band visible, smoothly animated, white-pink-ish tint matching the channel weights. STOP after the chunk lands so the proximity-glow math can be discussed.

**Co-write process active.** I describe each chunk; user pastes/types into `registry/waves/shader.tsx`. I do not call Edit/Write on the shader file.

**TSL concepts to explain in this phase:**
- **Centered UV remap:** `uv = -1 + 2*uv` shifts the [0,1] sampler-space rectangle into [-1, 1], so `y = 0` is the vertical middle and the wave centerline can sit naturally at zero.
- **Proximity glow (`1/(150*y)`):** dividing by distance gives an asymptote — brightness explodes near `y = 0` and falls off rapidly farther away. `abs()` makes it symmetric (above and below the centerline). The `150` controls how sharp the falloff is.
- **Additive accumulation vs masked compositing:** the old waves did `mix(black, color, mask)` (a hard-ish band). The new approach adds bright contributions on top of black — the result is HDR-feeling glow that brightens with more layers.
- **Why the TSL graph mutates JS-scope variables, not GLSL-style `uv.y +=`:** TSL nodes are immutable expression nodes. We rebind a JS `let` to a new node each step; the GPU sees one final compiled expression.

### Task 2.1: Replace the TSL graph with a single-iteration ShaderToy port

**Files:**
- Modify: `registry/waves/shader.tsx` (the `buildWavesMaterial` function body)

- [ ] **Step 1 (co-write — describe chunk to user):** Replace the `buildWavesMaterial` function body with a single-iteration port.

Target code for the function body (callee signature stays the same for now — the props plumbing changes in Phase 4):

```ts
function buildWavesMaterial(
  ampU: ShaderNodeObject<Node>,
  freqU: ShaderNodeObject<Node>,
  speedU: ShaderNodeObject<Node>,
  layers: number,
  color: readonly [number, number, number],
): MeshBasicNodeMaterial {
  void layers; // not used in Phase 2; restored in Phase 3
  void color;  // hardcoded in Phase 2; wired in Phase 4

  // 1. Remap UV from [0, 1] to [-1, 1] (centered space).
  const p = vec2(uv().x.mul(2).sub(1), uv().y.mul(2).sub(1));

  // 2. Initial baseline shift (matches the ShaderToy's `uv.y += 0.1`).
  //    `yRunning` mimics GLSL's mutated uv.y but lives in JS scope.
  let yRunning = p.y.add(0.1);

  // 3. One unrolled iteration of the wave loop, with i = 0.
  //    GLSL:   uv.y += 0.07 * sin(uv.x + 0/7 + iTime)
  const i = 0;
  yRunning = yRunning.add(
    sin(p.x.mul(freqU).add(i / 7).add(time.mul(speedU))).mul(ampU),
  );

  // 4. Proximity glow: width = abs(1 / (150 * yRunning))
  const width = yRunning.mul(150).abs().reciprocal();

  // 5. Additive color with hardcoded channel weights matching the ShaderToy.
  const waveColor = vec3(width.mul(1.9), width, width.mul(1.5));

  const material = new MeshBasicNodeMaterial();

  material.colorNode = vec4(waveColor, 1);

  return material;
}
```

Imports that need to be present at the top of the file (some are new — make sure these are added if not already there):
- From `'three/tsl'`: `sin`, `uv`, `vec2`, `vec3`, `vec4` (already imported), plus you may drop `mix` and `smoothstep` since they're no longer used.
- From `'@lovo/matter'`: `time` (already imported).

> The `ampU`/`freqU`/`speedU` arguments are still consumed (so the existing `amplitude`/`frequency`/`speed` props keep working through the sin term). That's intentional — by reusing these uniforms in the new graph, we keep the props live before we expand the prop surface in Phase 4.

- [ ] **Step 2 (co-write — wait for user):** wait for user to apply the change in their editor.

- [ ] **Step 3: Typecheck (claude can run)**

Run: `pnpm typecheck`
Expected: no errors. Common pitfalls if there's an error:
- TSL's `reciprocal()` returning a wider type — if so, wrap with `as ShaderNodeObject<Node>`.
- `mix`/`smoothstep` left imported but unused → `verbatimModuleSyntax` lint error → remove the import.

- [ ] **Step 4: Manual dev-server validation (STOP GATE)**

Open: `http://localhost:3000/components/waves`
Expected:
- A single soft-glowing horizontal band, hovering near the visible center but slightly shifted by the `+0.1` baseline.
- Band animates left/right slightly as the sin wave evolves with `iTime`.
- Frequency / speed / amplitude tweakpane sliders should still respond (the per-band sin uses them).
- Color slider has no effect this phase (hardcoded channel weights). That's expected — flag it as a "we'll wire color in Phase 4" note when surfacing the diff.

**Wait for the user to confirm the band looks right before proceeding.**

### Task 2.2: Commit

- [ ] **Step 1: Commit**

```bash
git add registry/waves/shader.tsx
git commit -m "feat(matter): port waves to single-iteration shadertoy reference"
```

---

## Phase 3 — Add the build-time loop (hardcoded count = 10)

**Behavioral goal:** match the ShaderToy's full layered output. Ten stacked sin contributions producing the dense, blooming wave field.

**Stop gate:** wave field should look qualitatively identical to the ShaderToy URL — multiple curving bands with bright glow at their centerlines, softer everywhere else.

**Co-write process active.**

**TSL concepts to explain:**
- **Build-time loop vs. GPU-side loop:** `for (let i = 0; …)` runs in JS at material-construction time. Each iteration builds new TSL nodes that get baked into the final compiled shader. The GPU sees an *unrolled* loop — there's no runtime branching cost, but changing the loop count requires rebuilding the material (which is why `count` in Phase 4 triggers a rebuild rather than going through a uniform).
- **Why accumulate in JS-scope `let`:** TSL nodes are immutable. To do the GLSL `uv.y +=` pattern, we rebind a JS variable to a *new* node each step — the final compiled expression chains them all together.

### Task 3.1: Wrap the proximity-glow math in a JS loop

**Files:**
- Modify: `registry/waves/shader.tsx`

- [ ] **Step 1 (co-write — describe chunk to user):** wrap the existing single-iteration code in a `for` loop, hardcoded to 10 iterations, accumulating into a `waveColor` running node.

Target code for the `buildWavesMaterial` body:

```ts
function buildWavesMaterial(
  ampU: ShaderNodeObject<Node>,
  freqU: ShaderNodeObject<Node>,
  speedU: ShaderNodeObject<Node>,
  layers: number,
  color: readonly [number, number, number],
): MeshBasicNodeMaterial {
  void layers; // Phase 4 renames this to `count` and uses it.
  void color;  // wired in Phase 4.

  const p = vec2(uv().x.mul(2).sub(1), uv().y.mul(2).sub(1));

  let yRunning = p.y.add(0.1);
  let waveColor: ShaderNodeObject<Node> = vec3(0, 0, 0);

  for (let i = 0; i < 10; i += 1) {
    yRunning = yRunning.add(
      sin(p.x.mul(freqU).add(i / 7).add(time.mul(speedU))).mul(ampU),
    );

    const width = yRunning.mul(150).abs().reciprocal();

    waveColor = waveColor.add(vec3(width.mul(1.9), width, width.mul(1.5)));
  }

  const material = new MeshBasicNodeMaterial();

  material.colorNode = vec4(waveColor, 1);

  return material;
}
```

- [ ] **Step 2 (co-write — wait for user).**

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 4: Manual dev-server validation (STOP GATE)**

Open: `http://localhost:3000/components/waves`
Expected:
- Several curving glowing bands, denser near the center and fanning vertically.
- Smooth, continuous animation.
- Should look like a recognizable port of the ShaderToy reference.

**Wait for the user to confirm before proceeding.**

### Task 3.2: Commit

- [ ] **Step 1: Commit**

```bash
git add registry/waves/shader.tsx
git commit -m "feat(matter): add 10-layer build-time loop to waves shader"
```

---

## Phase 4 — Expand the prop surface (live uniforms + structural `count`)

**Behavioral goal:** every prop from the final table at the top of this plan is wired through. Live scalars flow through `useAnimatableUniform`. The color uniform follows the canonical mutable-Vector3 + stable-uniform-node pattern (matches Aurora's `useColorUniform`). `count` is a JS number and triggers material rebuild on change.

**Stop gate after EACH sub-task (4.1–4.9).** Each adds one prop and ends at a working slider. The user feels each parameter before the next is added.

**Co-write process active for each chunk inside `shader.tsx` and `waves.tsx`.**

**TSL concepts to explain:**
- **Stable uniform pattern:** `useMemo([])` holds a `Vector2/Vector3`, `useMemo([vec])` wraps it in `uniform(...)`, and a separate `useEffect` pushes prop→vec via `.set()`. The uniform node identity stays stable across renders, so the heavy material-construction effect doesn't re-run (gotcha #17).
- **Why pass uniforms as args, not chained:** `sin(p.x.mul(freqU).add(time.mul(speedU)))` works; `freqU.mul(p.x).add(speedU.mul(time))` silently produces wrong values (gotcha #12).
- **Structural vs. live:** changing `count` rebuilds the material (the TSL graph's shape changes — number of unrolled iterations). Changing `amplitude` does not.

### Task 4.1: Wire `intensity` as a live uniform

**Files:**
- Modify: `registry/waves/shader.tsx`
- Modify: `registry/waves/waves.tsx`

- [ ] **Step 1 (co-write — `shader.tsx`):** add `intensity` to props, create the uniform, multiply the final `waveColor` by it.

In `WavesShaderProps`:
```ts
  intensity: AnimatableProp<number>;
```

In `WavesShader`, alongside the other uniform hooks:
```ts
  const intensityUniform = useAnimatableUniform<number>(props.intensity);
```

Pass it into `buildWavesMaterial`:
```ts
const material = buildWavesMaterial(
  ampUniform,
  freqUniform,
  speedUniform,
  intensityUniform,
  layers,
  color,
);
```

Add `intensityUniform` to the effect's deps array.

Update `buildWavesMaterial`'s signature and body:
```ts
function buildWavesMaterial(
  ampU: ShaderNodeObject<Node>,
  freqU: ShaderNodeObject<Node>,
  speedU: ShaderNodeObject<Node>,
  intensityU: ShaderNodeObject<Node>,
  layers: number,
  color: readonly [number, number, number],
): MeshBasicNodeMaterial {
  // ... existing setup ...

  // After the loop:
  const finalColor = waveColor.mul(intensityU);

  const material = new MeshBasicNodeMaterial();

  material.colorNode = vec4(finalColor, 1);

  return material;
}
```

- [ ] **Step 2 (co-write — `waves.tsx`):** add `intensity` prop with default `1` and forward to `<WavesShader>`.

```ts
export interface WavesProps {
  amplitude?: AnimatableProp<number>;
  frequency?: AnimatableProp<number>;
  speed?: AnimatableProp<number>;
  intensity?: AnimatableProp<number>;  // NEW
  color?: string;
  layers?: number;
}

export function Waves({
  amplitude = 0.07,
  frequency = 1,
  speed = 1,
  intensity = 1,                       // NEW
  color = '#77eecc',                   // also update defaults to the new design
  layers = 10,                         // also update default — renamed to `count` in Task 4.9
}: WavesProps) {
  return (
    <WavesShader
      amplitude={amplitude}
      color={color}
      frequency={frequency}
      intensity={intensity}            // NEW
      layers={layers}
      speed={speed}
    />
  );
}
```

> **Note:** This task is also where the *default values* shift to the new design (amplitude 0.1→0.07, frequency 5→1, layers 3→10, color teal→`#77eecc`). The visual jumps to its final feel here.

- [ ] **Step 3 (co-write — wait for user, then docs page):** add `intensity` to the Tweakpane page so it's tunable for the stop gate.

In `apps/docs/src/app/components/waves/page.tsx`, add to `Params`, `INITIAL`, and the tweakpane callback:
```ts
interface Params {
  color: string;
  amplitude: number;
  frequency: number;
  speed: number;
  intensity: number;   // NEW
  layers: number;
}

const INITIAL: Params = {
  color: '#77eecc',
  amplitude: 0.07,
  frequency: 1,
  speed: 1,
  intensity: 1,        // NEW
  layers: 10,
};

// Inside the tweakpane callback, between the speed and layers bindings:
pane.addBinding(local, 'intensity', { min: 0, max: 3, step: 0.01 });
```

Also update the inline code snippet at the bottom of the file to match the new defaults.

- [ ] **Step 4: Typecheck + dev validation (STOP GATE)**

Run: `pnpm typecheck`
Open: `http://localhost:3000/components/waves` — `intensity` slider should brighten/dim the whole field.

**Wait for user confirmation.**

- [ ] **Step 5: Commit**

```bash
git add registry/waves apps/docs/src/app/components/waves/page.tsx
git commit -m "feat(matter): add intensity prop to waves"
```

### Task 4.2: Wire `thickness` as a live uniform

Replaces the hardcoded `150` in the proximity-glow divisor.

**Files:**
- Modify: `registry/waves/shader.tsx`
- Modify: `registry/waves/waves.tsx`
- Modify: `apps/docs/src/app/components/waves/page.tsx`

- [ ] **Step 1 (co-write — `shader.tsx`):**

Add to `WavesShaderProps`:
```ts
  thickness: AnimatableProp<number>;
```

Add the uniform hook and pass it through:
```ts
const thicknessUniform = useAnimatableUniform<number>(props.thickness);
// ... pass to buildWavesMaterial, add to deps array ...
```

In `buildWavesMaterial`, replace `.mul(150)` with `.mul(thicknessU)`:
```ts
const width = yRunning.mul(thicknessU).abs().reciprocal();
```

- [ ] **Step 2 (co-write — `waves.tsx`):**

```ts
  thickness?: AnimatableProp<number>;
// ...
  thickness = 150,
// ...
      thickness={thickness}
```

- [ ] **Step 3 (co-write — docs page):**

```ts
interface Params { /* ... */ thickness: number; }
const INITIAL: Params = { /* ... */ thickness: 150 };
pane.addBinding(local, 'thickness', { min: 20, max: 500, step: 1 });
```

- [ ] **Step 4: Typecheck + dev validation (STOP GATE)**

Higher thickness = sharper, thinner lines. Lower = thicker, blurrier bloom.

**Wait for user.**

- [ ] **Step 5: Commit**

```bash
git add registry/waves apps/docs/src/app/components/waves/page.tsx
git commit -m "feat(matter): add thickness prop to waves"
```

### Task 4.3: Wire `baseline` as a live uniform

Replaces the hardcoded `0.1` y-shift.

**Files:** same as Task 4.2.

- [ ] **Step 1 (co-write — `shader.tsx`):**

Add to `WavesShaderProps`:
```ts
  baseline: AnimatableProp<number>;
```

Uniform hook:
```ts
const baselineUniform = useAnimatableUniform<number>(props.baseline);
```

In `buildWavesMaterial`, change the initial `yRunning`:
```ts
let yRunning = p.y.add(baselineU);
```

(Update signature and deps accordingly.)

- [ ] **Step 2 (co-write — `waves.tsx`):**

```ts
  baseline?: AnimatableProp<number>;
// ...
  baseline = 0.1,
// ...
      baseline={baseline}
```

- [ ] **Step 3 (co-write — docs page):**

```ts
interface Params { /* ... */ baseline: number; }
const INITIAL: Params = { /* ... */ baseline: 0.1 };
pane.addBinding(local, 'baseline', { min: -1, max: 1, step: 0.01 });
```

- [ ] **Step 4: Typecheck + dev validation (STOP GATE)**

Moving baseline shifts the whole wave family vertically. Range allows wave centerline to walk off-screen.

**Wait for user.**

- [ ] **Step 5: Commit**

```bash
git add registry/waves apps/docs/src/app/components/waves/page.tsx
git commit -m "feat(matter): add baseline prop to waves"
```

### Task 4.4: Wire `phaseSpread` as a live uniform

Replaces the per-layer `i / 7` constant.

**Files:** same.

- [ ] **Step 1 (co-write — `shader.tsx`):**

Add to `WavesShaderProps`:
```ts
  phaseSpread: AnimatableProp<number>;
```

Uniform hook. Inside the loop, change:
```ts
sin(p.x.mul(freqU).add(i / 7).add(time.mul(speedU)))
```
to:
```ts
sin(p.x.mul(freqU).add(phaseSpreadU.mul(i / 7)).add(time.mul(speedU)))
```

> Multiplier semantics: `phaseSpread = 1` → original behavior; `0` → all layers in phase (collapsed); `2` → double the spread (more chaotic).

- [ ] **Step 2 (co-write — `waves.tsx`):**

```ts
  phaseSpread?: AnimatableProp<number>;
// ...
  phaseSpread = 1,
// ...
      phaseSpread={phaseSpread}
```

- [ ] **Step 3 (co-write — docs page):**

```ts
interface Params { /* ... */ phaseSpread: number; }
const INITIAL: Params = { /* ... */ phaseSpread: 1 };
pane.addBinding(local, 'phaseSpread', { min: 0, max: 3, step: 0.01 });
```

- [ ] **Step 4: Typecheck + dev validation (STOP GATE)**

At `0`, layers collapse onto each other → a thick, less varied band. At `1`, original. At `3`, much more chaos and divergence.

**Wait for user.**

- [ ] **Step 5: Commit**

```bash
git add registry/waves apps/docs/src/app/components/waves/page.tsx
git commit -m "feat(matter): add phaseSpread prop to waves"
```

### Task 4.5: Wire `color` as a vec3 uniform (replacing channel weights)

The hardcoded `vec3(width * 1.9, width, width * 1.5)` becomes `colorU.mul(width)`. This means the channel-weighting flavor is baked into the *default color* — pick one whose `(r, g, b)` ratio matches `(1.9, 1.0, 1.5)`. Normalizing `(1.9, 1.0, 1.5)` to max-channel-1 gives `(1.0, 0.526, 0.789)`, hex `#ff87c9` (a pink-magenta). However, the previous default and `ReducedMotionDemo` use `#77eecc` (cool teal). The design call is the user's — Phase 4 keeps `#77eecc` as the default for visual continuity with the rest of the catalog.

**Files:** same as Task 4.2, but the color uniform follows the Vector3 + stable-uniform-node pattern.

- [ ] **Step 1 (co-write — `shader.tsx`):**

Remove the existing `hexToVec3` + `useMemo(hexToVec3(...))` chain and the `color: readonly [...]` argument to `buildWavesMaterial`. Replace with the canonical `useColorUniform` pattern (from Aurora's `shader.tsx` lines 100–120). Add a helper at module scope or inline:

```ts
import { Mesh, MeshBasicNodeMaterial, type Node, PlaneGeometry, Vector3 } from 'three/webgpu';
import { uniform, /* ... existing imports */ } from 'three/tsl';

function parseHex(hex: string): readonly [number, number, number] {
  const clean = hex.replace('#', '');

  return [
    parseInt(clean.slice(0, 2), 16) / 255,
    parseInt(clean.slice(2, 4), 16) / 255,
    parseInt(clean.slice(4, 6), 16) / 255,
  ];
}

function useColorUniform(hex: string): ReturnType<typeof uniform<Vector3>> {
  const vec = useMemo(
    () => {
      const [r, g, b] = parseHex(hex);

      return new Vector3(r, g, b);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const node = useMemo(() => uniform(vec), [vec]);

  useEffect(() => {
    const [r, g, b] = parseHex(hex);

    vec.set(r, g, b);
  }, [hex, vec]);

  return node;
}
```

In `WavesShader`, replace the old `color = useMemo(() => hexToVec3(...), …)` with:
```ts
const colorUniform = useColorUniform(props.color);
```

Update `buildWavesMaterial`'s signature: drop the `color: readonly [...]` parameter, add `colorU: ReturnType<typeof uniform<Vector3>>`. Drop the `void color` and the `vec3(cr, cg, cb)` reference. Replace the channel-weighted accumulator line with:

```ts
waveColor = waveColor.add(colorU.mul(width));
```

Update the effect deps: drop the old `color` memo, add `colorUniform`.

> The `parseHex` helper duplicates `registry/utils/color.ts`'s `parseHex` if it exists. Phase 5 cleanup can deduplicate by importing from `../utils/color`. (Aurora does `import { parseHex } from '../utils/color';` — match that.)

- [ ] **Step 2 (co-write — `waves.tsx`):** no change needed; `color` was already a prop.

- [ ] **Step 3 (co-write — docs page):** no change needed; the `color` binding already exists.

- [ ] **Step 4: Typecheck + dev validation (STOP GATE)**

The color picker now actually drives the band color (was a no-op since Phase 2). Switching color should be instant — no rebuild.

**Wait for user.**

- [ ] **Step 5: Commit**

```bash
git add registry/waves
git commit -m "feat(matter): wire color uniform to waves"
```

### Task 4.6: Switch `amplitude` default to `0.07` (alignment with reference)

Done in Task 4.1's `waves.tsx` defaults update. No code change here — just a checkpoint.

- [ ] **Step 1:** Confirm `amplitude = 0.07` in `waves.tsx` and `apps/docs/src/app/components/waves/page.tsx`'s `INITIAL`. Tweak slider range in tweakpane to `{ min: 0, max: 0.3, step: 0.005 }` (lowered max since the new defaults are an order of magnitude smaller than before).

- [ ] **Step 2:** Commit if anything changed.

```bash
git add apps/docs/src/app/components/waves/page.tsx
git commit -m "chore(docs): tighten waves tweakpane ranges to new defaults"
```

### Task 4.7: Switch `frequency` default to `1` (alignment with reference)

Done in Task 4.1. Tweak tweakpane range to `{ min: 0.1, max: 10, step: 0.05 }`.

- [ ] **Step 1:** Confirm and adjust range.

- [ ] **Step 2:** Commit if changed.

### Task 4.8: Rename `layers` → `count`

The current name is misleading (it's a loop count, not the multi-layer color/speed structure Aurora uses).

**Files:**
- Modify: `registry/waves/shader.tsx`
- Modify: `registry/waves/waves.tsx`
- Modify: `apps/docs/src/app/components/waves/page.tsx`
- Modify: `apps/docs/src/app/dev/reduced-motion/ReducedMotionDemo.tsx`

- [ ] **Step 1 (Claude can use Edit — this is a pure rename, no shader logic):**

Find/replace `layers` → `count` (case-sensitive) in:
- `registry/waves/shader.tsx`: `WavesShaderProps`, `WavesShader` body, `buildWavesMaterial` signature + body, deps array.
- `registry/waves/waves.tsx`: `WavesProps`, destructured params, forwarded prop.
- `apps/docs/src/app/components/waves/page.tsx`: `Params`, `INITIAL`, the `key === 'layers'` rebuild check, the "Apply layers" button label, the inline code block, the prop on `<Waves>`.
- `apps/docs/src/app/dev/reduced-motion/ReducedMotionDemo.tsx`: the prop on `<Waves>`.

(Be careful: `Math.max(1, props.layers ?? DEFAULTS.layers)` becomes `Math.max(1, props.count)`. Don't replace any unrelated occurrences of the word "layers" in comments or palette code — search restricted to the four files above.)

- [ ] **Step 2: Typecheck + dev validation (STOP GATE)**

Pane "Apply count" button still triggers a material rebuild on count change; nothing else broken.

**Wait for user.**

- [ ] **Step 3: Commit**

```bash
git add registry/waves apps/docs/src/app/components/waves/page.tsx \
        apps/docs/src/app/dev/reduced-motion/ReducedMotionDemo.tsx
git commit -m "refactor(matter): rename waves layers prop to count"
```

### Task 4.9: Deduplicate `parseHex` by importing from `registry/utils/color`

**Files:**
- Modify: `registry/waves/shader.tsx`

- [ ] **Step 1:** Verify `registry/utils/color.ts` exports `parseHex` with the same `(hex: string) => readonly [number, number, number]` shape that Aurora uses.

Run: `grep -n "parseHex" registry/utils/color.ts`
Expected: an exported `parseHex` function.

If the export exists with the same shape: replace the local `parseHex` in `waves/shader.tsx` with:
```ts
import { parseHex } from '../utils/color';
```
and delete the inline helper.

If the export does NOT exist or has a different shape: skip this dedup — leave the helper inline and add a `// TODO(M9): align utils/color.parseHex signature so registry components can share`. (Don't unilaterally refactor `utils/color.ts` here — out of scope.)

- [ ] **Step 2: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`

- [ ] **Step 3: Commit**

```bash
git add registry/waves/shader.tsx
git commit -m "refactor(matter): use shared parseHex in waves shader"
```

---

## Phase 5 — Docs page polish, registry metadata, visual snapshot rebaseline

**Behavioral goal:** the demo page, registry metadata, and visual regression snapshot all reflect the new component.

**Stop gate:** every tweakpane slider feels responsive; the inline code snippet shows real props the user would use; `pnpm test` and visual regression pass against new snapshots.

**Claude can use Edit/Write throughout Phase 5 — no shader code changes here.**

### Task 5.1: Finalize the tweakpane page

**Files:**
- Modify: `apps/docs/src/app/components/waves/page.tsx`

- [ ] **Step 1: Final state of the page**

The final `Params`, `INITIAL`, and tweakpane callback should look like:

```tsx
interface Params {
  color: string;
  amplitude: number;
  frequency: number;
  speed: number;
  intensity: number;
  thickness: number;
  baseline: number;
  phaseSpread: number;
  count: number;
}

const INITIAL: Params = {
  color: '#77eecc',
  amplitude: 0.07,
  frequency: 1,
  speed: 1,
  intensity: 1,
  thickness: 150,
  baseline: 0.1,
  phaseSpread: 1,
  count: 10,
};

// in useTweakpane callback:
pane.addBinding(local, 'color');
pane.addBlade({ view: 'separator' });
pane.addBinding(local, 'amplitude', { min: 0, max: 0.3, step: 0.005 });
pane.addBinding(local, 'frequency', { min: 0.1, max: 10, step: 0.05 });
pane.addBinding(local, 'speed', { min: 0, max: 4, step: 0.05 });
pane.addBinding(local, 'intensity', { min: 0, max: 3, step: 0.01 });
pane.addBinding(local, 'thickness', { min: 20, max: 500, step: 1 });
pane.addBinding(local, 'baseline', { min: -1, max: 1, step: 0.01 });
pane.addBinding(local, 'phaseSpread', { min: 0, max: 3, step: 0.01 });
pane.addBlade({ view: 'separator' });
pane.addBinding(local, 'count', { min: 1, max: 20, step: 1 });
pane.addButton({ title: 'Apply count' }).on('click', sync);
pane.on('change', (ev) => {
  if ('key' in ev.target && ev.target.key === 'count') {
    return;
  }
  sync();
});
```

And the inline code block:

```tsx
<pre /* ... */>
  {`<ShaderScene>
  <Waves
    amplitude={0.07}
    frequency={1}
    speed={1}
    intensity={1}
    thickness={150}
    baseline={0.1}
    phaseSpread={1}
    color="#77eecc"
    count={10}
  />
</ShaderScene>`}
</pre>
```

And the `<Waves>` JSX inside `<ShaderScene>` passes all the new params:

```tsx
<Waves
  amplitude={params.amplitude}
  baseline={params.baseline}
  color={params.color}
  count={params.count}
  frequency={params.frequency}
  intensity={params.intensity}
  phaseSpread={params.phaseSpread}
  speed={params.speed}
  thickness={params.thickness}
/>
```

### Task 5.2: Update `registry.json` final metadata

**Files:**
- Modify: `registry/registry.json` (lines 55–72)

- [ ] **Step 1: Final waves entry**

```json
    "waves": {
      "file": "waves/waves.tsx",
      "description": "Additive sine-wave glow: a band of stacked sin waves with proximity-glow brightness, fully tunable (count, amplitude, frequency, speed, thickness, intensity, baseline, phaseSpread, color).",
      "dependencies": ["@lovo/matter", "@lovo/matter-react", "react", "three"],
      "uses_primitives": [
        "sin",
        "abs",
        "reciprocal",
        "uv",
        "vec2",
        "vec3",
        "vec4",
        "time",
        "uniform"
      ],
      "tier": 1
    },
```

### Task 5.3: Re-baseline visual regression

**Files:**
- Modify: `apps/docs-tests/visual/waves.spec.ts-snapshots/waves-default-chromium-darwin.png` (and `-linux.png`)

- [ ] **Step 1: Build the docs site if the test config expects a built site**

Check `apps/docs-tests/playwright.config.ts` to see whether it expects `pnpm dev` or `pnpm build && pnpm start`. Run accordingly:

Run (in one terminal): `pnpm --filter @matter/docs dev`
And (in another): `pnpm --filter @matter/docs-tests test --update-snapshots`

Expected: `waves.spec.ts` runs green and refreshes the snapshot PNGs.

- [ ] **Step 2: Manually inspect both PNGs**

Confirm the new snapshots show the expected glowing wave field (not a black screen or stale image).

### Task 5.4: Full verification pass

- [ ] **Step 1: Typecheck**

Run: `pnpm typecheck`
Expected: no errors across all packages.

- [ ] **Step 2: Lint**

Run: `pnpm lint`
Expected: no errors.

- [ ] **Step 3: Format**

Run: `pnpm format`

- [ ] **Step 4: Build**

Run: `pnpm build`
Expected: all packages build clean. `@lovo/matter` and `@matter/registry` and `@matter/docs` all succeed.

- [ ] **Step 5: Visual regression**

Run: `pnpm --filter @matter/docs-tests test`
Expected: all tests pass, including `waves.spec.ts`.

- [ ] **Step 6: Final manual sweep (STOP GATE)**

Open: `http://localhost:3000/components/waves`
Walk through every slider one at a time:
- color: instant change, no rebuild flicker
- amplitude: changes wave curvature smoothly
- frequency: more/fewer wave crests across the x axis
- speed: faster/slower wave motion
- intensity: dim ↔ bright
- thickness: thin sharp lines ↔ wide blurry bloom
- baseline: shifts wave family up/down
- phaseSpread: 0 = collapsed thick band; 3 = chaotic divergence
- count: 1 = single band; 20 = dense field. Pressing "Apply count" should rebuild (a tiny flicker is OK; nothing should crash).

Also open `http://localhost:3000/dev/reduced-motion` and confirm waves still freezes correctly when policy = paused.

**Wait for user confirmation.**

### Task 5.5: Final commit

- [ ] **Step 1: Commit**

```bash
git add apps/docs/src/app/components/waves/page.tsx \
        registry/registry.json \
        apps/docs-tests/visual/waves.spec.ts-snapshots
git commit -m "feat(matter): finalize waves prop surface + rebaseline visual snapshot"
```

---

## Out of scope (do NOT do during this rebuild)

- Don't reintroduce any cursor interaction — even as an opt-in. The whole point of the rebuild is removing it.
- Don't add particle/foam/highlight overlays. Stick to the additive sin-glow approach.
- Don't change `registry/utils/color.ts` other than confirming it exports `parseHex` (Task 4.9). If it doesn't, leave a TODO and move on.
- Don't touch the engine package (`packages/matter`). All work is in the registry + docs.
- Don't add new public TSL primitives. If anything new is needed, build it inline in `shader.tsx` for now.

---

## Self-review notes

- **Spec coverage:** every prop in the table at the top maps to a task (4.1–4.5 + the renamed 4.8). Cursor removal is Phase 1 across 5 files. Aurora-style split is Phase 1 Tasks 1.1–1.3. Visual regression rebaseline is Task 5.3.
- **Placeholder scan:** no TBDs. Each step has either real code or a real command.
- **Type consistency:** `WavesShaderProps` accumulates props across Phase 4 — make sure each sub-task's added prop is also added to the destructured `useAnimatableUniform` hook AND the effect's deps. The `WavesProps` (public) interface in `waves.tsx` mirrors `WavesShaderProps` minus optionality.
- **Co-write boundary:** Phase 1 and Phase 5 are Claude-driven (mechanical plumbing). Phase 2, 3, and the per-prop chunks in Phase 4 are co-write — Claude describes, user pastes, Claude verifies via Read + typecheck + lint + dev-server.
- **Concept timing:** centered UV + proximity glow concepts are introduced in Phase 2; build-time loop in Phase 3; uniform-vs-structural in Phase 4. No concept is taught before it appears.

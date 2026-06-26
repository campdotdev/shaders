# MAT-41 Deterministic Shader Start Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every shader's first visible frame deterministic at t=0 so the static poster placeholder no longer "pops" when the live WebGPU canvas paints over it.

**Architecture:** The animation clock `elapsedTime` reads three's per-renderer `nodeFrame.time` accumulator, which includes a nondeterministic WebGPU warmup. Phase 1 adds an engine util that zeroes that per-renderer clock and calls it in `ShaderScene` at first paint (before the fallback drops), so live shaders start at t=0. Phase 2 pins the poster harness to `setReducedMotionPolicy('paused')` so captured posters land on the same deterministic t=0 frame, then regenerates the committed poster images.

**Tech Stack:** TypeScript 5 (strict, `verbatimModuleSyntax`), three.js 0.170 WebGPU + TSL, React 19, pnpm 9 workspaces, Vitest 4, esbuild (CLI poster harness bundling), Playwright (poster capture).

## Global Constraints

- TypeScript strict mode, `verbatimModuleSyntax`, `noUncheckedIndexedAccess`. Use `import type` for type-only imports.
- Clear, descriptive names over abbreviations (no `u`, `cfg`, `cb`). Conventional loop counters and shader math locals are the only exceptions.
- Commit messages: Conventional Commits. Scope = package name without `@lovo/` (`feat(matter):`, `fix(matter-react):`, `fix(matter-cli):`, `docs:`). No emojis. No Claude attribution trailers.
- Never push to `main`; all work stays on this branch (`hunter/mat-41-...`).
- Don't mock the GPU. Shader/binding visuals are validated via the docs dev server + `pnpm snap` (Playwright), not unit tests (per CLAUDE.md).
- The docs site imports `@lovo/matter`/`@lovo/matter-react` from built `dist`, not `src` — after engine/binding edits, rebuild the changed package(s) before testing in docs or restarting the dev server.
- No offset-uniform on `elapsedTime` (it is a shared module-level node; an offset would be global and break multiple `ShaderScene`s). Reset the per-renderer `nodeFrame` clock instead.

---

## Phase 1 — Live shaders start at t=0

### Task 1: `resetRendererClock` engine util

**Files:**
- Create: `packages/matter/src/runtime/clock/reset-clock.ts`
- Test: `packages/matter/src/runtime/clock/reset-clock.test.ts`
- Modify: `packages/matter/src/index.ts` (add export)

**Interfaces:**
- Consumes: nothing (leaf util).
- Produces: `resetRendererClock(renderer: WebGPURenderer): void` — zeroes the renderer's per-frame animation clock (`time`, `deltaTime`) and clears `lastTime`, so the next rendered frame is t=0. No-ops safely if three's internal `_nodes.nodeFrame` shape is absent. Consumed by Task 2 (`ShaderScene`) and Task 3 (`VisualTestPause`).

- [ ] **Step 1: Write the failing test**

Create `packages/matter/src/runtime/clock/reset-clock.test.ts`:

```ts
import type { WebGPURenderer } from 'three/webgpu';
import { describe, expect, it } from 'vitest';

import { resetRendererClock } from './reset-clock.js';

// Build a minimal object shaped like the internal slice of WebGPURenderer the
// util reaches into. Cast through unknown because the real `_nodes`/`nodeFrame`
// fields are not part of three's public type.
function makeRenderer(nodeFrame: unknown): WebGPURenderer {
  return { _nodes: { nodeFrame } } as unknown as WebGPURenderer;
}

describe('resetRendererClock', () => {
  it('zeroes time and deltaTime and clears lastTime', () => {
    const nodeFrame = { time: 12.5, deltaTime: 0.016, lastTime: 12.484 };

    resetRendererClock(makeRenderer(nodeFrame));

    expect(nodeFrame.time).toBe(0);
    expect(nodeFrame.deltaTime).toBe(0);
    expect(nodeFrame.lastTime).toBeUndefined();
  });

  it('no-ops when _nodes is missing', () => {
    const renderer = {} as unknown as WebGPURenderer;

    expect(() => resetRendererClock(renderer)).not.toThrow();
  });

  it('no-ops when nodeFrame is missing', () => {
    expect(() => resetRendererClock(makeRenderer(undefined))).not.toThrow();
  });

  it('no-ops when nodeFrame is not an object', () => {
    expect(() => resetRendererClock(makeRenderer(42))).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @lovo/matter test reset-clock`
Expected: FAIL — `Cannot find module './reset-clock.js'` (file not created yet).

- [ ] **Step 3: Write minimal implementation**

Create `packages/matter/src/runtime/clock/reset-clock.ts`:

```ts
import type { WebGPURenderer } from 'three/webgpu';

/**
 * Internal shape of three's per-renderer frame clock. `nodeFrame` is not part
 * of three's public types — it lives at `renderer._nodes.nodeFrame` — so we
 * reach it through guarded `unknown` traversal rather than a typed access.
 */
interface NodeFrameClock {
  time?: number;
  deltaTime?: number;
  lastTime?: number;
}

function getNodeFrame(renderer: WebGPURenderer): NodeFrameClock | undefined {
  const candidate: unknown = renderer;

  if (!(typeof candidate === 'object' && candidate !== null && '_nodes' in candidate)) {
    return undefined;
  }
  const nodes = (candidate as { _nodes: unknown })._nodes;

  if (!(typeof nodes === 'object' && nodes !== null && 'nodeFrame' in nodes)) {
    return undefined;
  }
  const frame = (nodes as { nodeFrame: unknown }).nodeFrame;

  if (typeof frame !== 'object' || frame === null) return undefined;

  return frame as NodeFrameClock;
}

/**
 * Zero the renderer's animation clock so the next rendered frame is t=0.
 *
 * `elapsedTime` (and three's built-in `time`) accumulate real frame deltas from
 * the moment the renderer starts, which includes a nondeterministic WebGPU
 * init + shader-compile warmup. Resetting the per-renderer `nodeFrame` clock
 * makes every shader start from a fixed phase, so the first visible frame
 * matches the deterministic poster/snapshot frame.
 *
 * Per-renderer by construction: each ShaderScene owns one renderer, so resetting
 * here isolates scenes from one another. No-ops safely if three's internal
 * shape ever changes.
 */
export function resetRendererClock(renderer: WebGPURenderer): void {
  const nodeFrame = getNodeFrame(renderer);

  if (!nodeFrame) return;
  nodeFrame.time = 0;
  nodeFrame.deltaTime = 0;
  nodeFrame.lastTime = undefined;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @lovo/matter test reset-clock`
Expected: PASS (4 tests).

- [ ] **Step 5: Add the public export**

In `packages/matter/src/index.ts`, after the `elapsedTime` export block (line ~42), add:

```ts
export { resetRendererClock } from './runtime/clock/reset-clock.js';
```

- [ ] **Step 6: Typecheck and build the engine**

Run: `pnpm --filter @lovo/matter typecheck && pnpm --filter @lovo/matter build`
Expected: both succeed (build emits `dist/`; required so `@lovo/matter-react` and the docs site pick up the new export).

- [ ] **Step 7: Commit**

```bash
git add packages/matter/src/runtime/clock/reset-clock.ts packages/matter/src/runtime/clock/reset-clock.test.ts packages/matter/src/index.ts
git commit -m "feat(matter): add resetRendererClock to zero the per-renderer animation clock"
```

---

### Task 2: Reset the clock at first paint in `ShaderScene`

**Files:**
- Modify: `packages/matter-react/src/components/shader-scene/shader-scene.tsx` (imports + `renderFrame`, ~lines 5–11 and 126–136)

**Interfaces:**
- Consumes: `resetRendererClock(renderer.three)` from `@lovo/matter` (Task 1). `renderer` here is the `GpuRenderer` returned by `createRenderer`; its `.three` is the `WebGPURenderer`.
- Produces: behavioral change only — the first composited frame (the one revealed when the fallback drops) renders at t=0.

> No unit test: `ShaderScene`'s render loop drives `PostProcessing.render()` against a real WebGPU renderer, which CLAUDE.md says not to mock. The reset *logic* is unit-tested in Task 1; this task's correctness is validated by the stop-and-play gate (Task 3's gate) and by `pnpm snap` staying unchanged.

- [ ] **Step 1: Add the import**

In `packages/matter-react/src/components/shader-scene/shader-scene.tsx`, add `resetRendererClock` to the existing `@lovo/matter` import (currently lines 5–11):

```ts
import {
  createIntersectionWatcher,
  createRenderer,
  createVisibilityWatcher,
  dither,
  FrameScheduler,
  resetRendererClock,
} from '@lovo/matter';
```

- [ ] **Step 2: Reset before the first composited render**

Replace the `renderFrame` function (currently lines 126–136):

```ts
        const renderFrame = () => {
          postProcessing.render();

          if (!firstPaintSignaled && (scene.children.length > 0 || overlays.size > 0)) {
            firstPaintSignaled = true;
            firstPaintRaf = requestAnimationFrame(() => {
              firstPaintRaf = null;
              if (!cancelled) setFirstFramePainted(true);
            });
          }
        };
```

with:

```ts
        const renderFrame = () => {
          const hasContent = scene.children.length > 0 || overlays.size > 0;

          // On the frame that first has something to draw, zero the clock BEFORE
          // rendering so the frame the user first sees (once the fallback drops)
          // is t=0 — matching the deterministic poster. Resetting after the
          // fallback is already gone would pop the animation backwards from
          // warmup-time to 0, a new visible glitch.
          if (!firstPaintSignaled && hasContent) {
            resetRendererClock(renderer.three);
          }
          postProcessing.render();

          if (!firstPaintSignaled && hasContent) {
            firstPaintSignaled = true;
            firstPaintRaf = requestAnimationFrame(() => {
              firstPaintRaf = null;
              if (!cancelled) setFirstFramePainted(true);
            });
          }
        };
```

- [ ] **Step 3: Typecheck and run the binding's existing tests**

Run: `pnpm --filter @lovo/matter-react typecheck && pnpm --filter @lovo/matter-react test`
Expected: typecheck passes; existing `shader-scene.test.tsx` and all other suites pass (they stub `requestAnimationFrame`, so `renderFrame` never fires — no behavioral break).

- [ ] **Step 4: Build the binding**

Run: `pnpm --filter @lovo/matter-react build`
Expected: succeeds (docs site consumes `dist`).

- [ ] **Step 5: Commit**

```bash
git add packages/matter-react/src/components/shader-scene/shader-scene.tsx
git commit -m "fix(matter-react): start shaders at t=0 by resetting the clock at first paint"
```

---

### Task 3: Route `VisualTestPause` through the shared util

**Files:**
- Modify: `apps/docs/src/lib/VisualTestPause.tsx` (lines ~5–6 imports, remove ~42–59 accessor, simplify ~65–72)

**Interfaces:**
- Consumes: `resetRendererClock(ctx.renderer.three)` from `@lovo/matter` (Task 1).
- Produces: no behavioral change — single source of truth for the `nodeFrame` private-field reach.

> Cleanup task. Validation is `pnpm snap` baselines staying unchanged, which proves the refactor is behavior-preserving AND that Task 2's live reset didn't move the deterministic test frame.

- [ ] **Step 1: Add the import**

In `apps/docs/src/lib/VisualTestPause.tsx`, add to the `@lovo/matter` import (currently line 5):

```ts
import { resetRendererClock, setReducedMotionPolicy } from '@lovo/matter';
```

- [ ] **Step 2: Delete the inline accessor**

Remove the `NodeFrameInternal` interface and the `getNodeFrame` closure (currently lines 42–59).

- [ ] **Step 3: Call the util on frame 1**

Replace the `if (frame === 1) { ... }` block (currently lines 65–75):

```ts
      if (frame === 1) {
        const nodeFrame = getNodeFrame();

        if (nodeFrame) {
          nodeFrame.time = 0;
          nodeFrame.deltaTime = 0;
          nodeFrame.lastTime = undefined;
        }

        return;
      }
```

with:

```ts
      if (frame === 1) {
        resetRendererClock(ctx.renderer.three);

        return;
      }
```

- [ ] **Step 4: Typecheck the docs app**

Run: `pnpm --filter docs typecheck`
Expected: passes (no unused-symbol or missing-import errors).

- [ ] **Step 5: Commit**

```bash
git add apps/docs/src/lib/VisualTestPause.tsx
git commit -m "refactor(docs): use resetRendererClock in VisualTestPause"
```

---

### Phase 1 validation gate (stop and play)

- [ ] **Rebuild and run the docs dev server**

```bash
pnpm --filter @lovo/matter build && pnpm --filter @lovo/matter-react build
pnpm --filter docs dev
```

Open a shader demo page (e.g. Aurora or Mesh Gradient). Confirm:
- The fallback hands off to a still **t=0** frame that then animates **forward** — no flash, no backwards jump, no pop.
- Reload several times: the handoff frame looks the same every time (deterministic), no longer varying with warmup.

- [ ] **Confirm snap baselines are unchanged**

Run (on pinned Node 22 — see CLAUDE.md gotcha #21): `pnpm snap`
Expected: no baseline diffs. Snap already renders t=0, so Phase 1 must not move any baseline. If a baseline moved, investigate before continuing — it means the test frame and the live frame disagree.

**STOP. Show the diff and the dev-server behavior to the user. Do not start Phase 2 until the user confirms the live handoff feels right.**

---

## Phase 2 — Pixel-deterministic posters

### Task 4: Pin the poster harness to a paused clock

**Files:**
- Modify: `packages/matter-cli/src/harness/index.tsx` (add import + call before `root.render`)
- Modify: `packages/matter-cli/src/poster/e2e.test.ts` (add a determinism case + `readFile` import)

**Interfaces:**
- Consumes: `setReducedMotionPolicy('paused')` from `@lovo/matter`. esbuild bundles the harness and the user component against the user's `node_modules`, so both share the same `@lovo/matter` reduced-motion singleton; setting the policy pins `elapsedTime` (`= _builtinTime.mul(scale)`) to 0 for the captured component.
- Produces: deterministic t=0 poster captures.

- [ ] **Step 1: Write the failing determinism test**

In `packages/matter-cli/src/poster/e2e.test.ts`, add `readFile` to the `node:fs/promises` import (currently line 1):

```ts
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
```

Then add this test inside the `describe.skipIf(!E2E_ENABLED)` block, after the `for (const c of cases)` loop:

```ts
  it('captures a deterministic t=0 frame across runs', async () => {
    const outA = join(outDir, 'determinism-a.png');
    const outB = join(outDir, 'determinism-b.png');
    const base = {
      from: join(FIXTURES, 'gradient-plus-grain.tsx'),
      type: 'png' as const,
      exportName: 'default',
      timeSeconds: 0,
      width: 320,
      height: 240,
      deviceScaleFactor: 1,
    };

    await runPoster({ ...base, out: outA }, { cwd: process.cwd(), log: vi.fn() });
    await runPoster({ ...base, out: outB }, { cwd: process.cwd(), log: vi.fn() });

    const [bytesA, bytesB] = await Promise.all([readFile(outA), readFile(outB)]);

    // The grain overlay animates with elapsedTime, so two runs that each rode a
    // different nondeterministic warmup would differ. Pinning the harness to a
    // paused (t=0) clock makes both runs identical.
    expect(Buffer.compare(bytesA, bytesB)).toBe(0);
  }, 60_000);
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `MATTER_E2E=1 pnpm --filter @lovo/matter-cli test e2e`
Expected: FAIL on the new case — `Buffer.compare` ≠ 0 (the two captures land on different warmup frames). The other cases still pass.

> If the two captures happen to match before the fix (warmup variance was too small to shift the grain), this test is a weak signal; the real proof is the manual two-run check in the gate below. Proceed either way.

- [ ] **Step 3: Pin the harness clock**

In `packages/matter-cli/src/harness/index.tsx`, add the import near the top with the other imports:

```ts
import { setReducedMotionPolicy } from '@lovo/matter';
```

Then, immediately before `root.render(<Component />);`, add:

```ts
// Pin the animation clock so the poster captures a deterministic t=0 frame,
// matching what users see at mount (ShaderScene also resets to t=0 at first
// paint). 'paused' sets the reduced-motion time scale to 0, so elapsedTime
// stays 0 regardless of how many settle frames elapse before the screenshot.
setReducedMotionPolicy('paused');

root.render(<Component />);
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `MATTER_E2E=1 pnpm --filter @lovo/matter-cli test e2e`
Expected: all cases PASS, including the determinism case (`Buffer.compare` === 0).

- [ ] **Step 5: Run the full CLI unit suite (no E2E) to confirm nothing regressed**

Run: `pnpm --filter @lovo/matter-cli test`
Expected: PASS (E2E cases skipped without `MATTER_E2E=1`).

- [ ] **Step 6: Build the CLI**

Run: `pnpm --filter @lovo/matter-cli build`
Expected: succeeds (the harness is bundled from `dist/harness` at poster time).

- [ ] **Step 7: Commit**

```bash
git add packages/matter-cli/src/harness/index.tsx packages/matter-cli/src/poster/e2e.test.ts
git commit -m "fix(matter-cli): pin poster harness to a paused t=0 clock for deterministic capture"
```

---

### Task 5: Regenerate the committed poster images

**Files:**
- Modify (regenerate binary assets): `apps/docs/public/posters/{aurora.jpg,grain.jpg,mesh-gradient.jpg,linear-gradient.png,simplex-noise.png}`
- Sources (unchanged): `packages/matter-cli/posters/{aurora,grain,mesh-gradient,linear-gradient,simplex-noise}.tsx`

**Interfaces:**
- Consumes: the built CLI from Task 4 (`packages/matter-cli/dist/index.js`) and Playwright chromium.
- Produces: poster images captured at t=0, matching the live first frame.

> The committed PNGs are 2560×1440 = the CLI default `--width 1280 --height 720` at DPR2. The JPEGs use the default `--format jpg`. These were warmup-t captures; regenerate them at t=0.

- [ ] **Step 1: Ensure Playwright chromium is installed**

Run: `pnpm --filter @lovo/matter-cli exec playwright install chromium`
Expected: chromium present (no-op if already installed).

- [ ] **Step 2: Regenerate each poster from repo root (pinned Node 22)**

Run each (the CLI defaults to 1280×720 @ DPR2 → 2560×1440, matching the originals):

```bash
node packages/matter-cli/dist/index.js poster --source packages/matter-cli/posters/linear-gradient.tsx --output apps/docs/public/posters/linear-gradient.png --format png
node packages/matter-cli/dist/index.js poster --source packages/matter-cli/posters/simplex-noise.tsx  --output apps/docs/public/posters/simplex-noise.png  --format png
node packages/matter-cli/dist/index.js poster --source packages/matter-cli/posters/aurora.tsx        --output apps/docs/public/posters/aurora.jpg        --format jpg
node packages/matter-cli/dist/index.js poster --source packages/matter-cli/posters/grain.tsx         --output apps/docs/public/posters/grain.jpg         --format jpg
node packages/matter-cli/dist/index.js poster --source packages/matter-cli/posters/mesh-gradient.tsx --output apps/docs/public/posters/mesh-gradient.jpg  --format jpg
```

Expected: each command writes its file and logs a size summary. No `--capture-delay` — every poster is t=0.

- [ ] **Step 3: Verify dimensions are unchanged**

Run: `for f in apps/docs/public/posters/*; do sips -g pixelWidth -g pixelHeight "$f"; done`
Expected: PNGs 2560×1440. JPEGs match their prior dimensions (also 2560×1440 unless the original used a different size — if `git diff --stat` shows an unexpectedly large change, re-run that poster with explicit `--width/--height` matching the prior asset).

- [ ] **Step 4: Visually sanity-check the regenerated posters**

Open each file. Confirm each looks like the t=0 frame of its component (it should match what the docs page shows at mount after Phase 1). A poster that looks blank/dead means that component is uninteresting at t=0 — note it for the user but don't block (t=0 is the intended, consistent behavior).

- [ ] **Step 5: Commit**

```bash
git add apps/docs/public/posters
git commit -m "chore(docs): regenerate poster images at deterministic t=0"
```

---

### Phase 2 validation gate (stop and play)

- [ ] **Manual two-run determinism check**

```bash
node packages/matter-cli/dist/index.js poster --source packages/matter-cli/posters/aurora.tsx --output /tmp/aurora-1.jpg --format jpg
node packages/matter-cli/dist/index.js poster --source packages/matter-cli/posters/aurora.tsx --output /tmp/aurora-2.jpg --format jpg
cmp /tmp/aurora-1.jpg /tmp/aurora-2.jpg && echo "IDENTICAL"
```

Expected: `IDENTICAL` — two independent captures of an animated shader are now byte-for-byte equal.

- [ ] **Confirm poster ↔ live alignment**

With the docs dev server running, compare each component's poster (shown as the fallback `<img>`) against its live t=0 frame at mount. They should match modulo the documented SwiftShader-vs-real-GPU sub-pixel delta (out of scope) — crucially, no phase pop.

**STOP. Show the regenerated posters and the two-run determinism result to the user.**

---

## Self-Review

**Spec coverage:**
- Root cause (per-renderer clock) → Tasks 1–2. ✅
- Phase 1 live reset + ordering (reset before fallback drop) → Task 2 Step 2. ✅
- Engine util encapsulating the private-field reach → Task 1. ✅
- VisualTestPause cleanup → Task 3. ✅
- Phase 2 paused-policy poster harness → Task 4. ✅
- `timeSeconds` escape hatch left intact → not modified (playwright.ts/poster.ts untouched). ✅
- Poster asset regeneration → Task 5. ✅
- Snap baselines must not move → Phase 1 gate. ✅
- Non-goal: no offset-uniform → Global Constraints + Task 1 approach. ✅
- Non-goal: SwiftShader/GPU sub-pixel delta → Phase 2 gate notes it as out of scope. ✅

**Placeholder scan:** No TBD/TODO; every code step shows complete code; every run step has an expected result. ✅

**Type consistency:** `resetRendererClock(renderer: WebGPURenderer)` defined in Task 1; called as `resetRendererClock(renderer.three)` (Task 2) and `resetRendererClock(ctx.renderer.three)` (Task 3) — both pass the `WebGPURenderer` from `GpuRenderer.three`. `setReducedMotionPolicy('paused')` matches the existing exported signature. `runPoster(opts, io)` call shape in Task 4 mirrors the existing e2e cases exactly. ✅

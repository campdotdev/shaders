# Wide-gamut (Display P3) Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render Matter scenes in Display P3 where the display supports it (auto-detected, sRGB fallback), let oklab/oklch mixing and high-chroma color inputs carry colors beyond sRGB to the framebuffer, and let users author colors as `oklch()`/`oklab()` strings.

**Architecture:** Three coordinated changes on top of the existing linear-sRGB working-space pipeline: (1) an output path — a resolved `gamut` flows into `createRenderer` and sets `renderer.outputColorSpace`, with auto-detection living in a React hook; (2) remove the `[0,1]` clamp in `mixColor` so extended values survive to the renderer's output encode; (3) extend color parsing to accept `oklch()`/`oklab()` strings that decode to extended linear-sRGB. On sRGB displays the framebuffer clamps per-channel exactly as today (graceful, pixel-identical); only P3 displays show the wider colors.

**Tech Stack:** TypeScript 5 strict, three `^0.170.0` (`DisplayP3ColorSpace`/`SRGBColorSpace` from `three`, `WebGPURenderer` from `three/webgpu`), TSL primitives, React 19, Vitest 4 (happy-dom for matter-react), Playwright (docs visual regression), Tweakpane (docs controls).

## Global Constraints

- TypeScript strict mode, `verbatimModuleSyntax`, `noUncheckedIndexedAccess`. Use `import type` for type-only imports.
- Clear, descriptive identifiers — no terse abbreviations (no `u`, `cfg`, `ctx` as new names). Math/shader single letters mirroring the math are the only exception.
- Conventional Commits, scope = package without `@lovo/` prefix (`feat(matter):`, `feat(matter-react):`, `feat(registry):`, `docs:`, `test(docs-tests):`).
- No emojis in code or commit messages.
- No Claude attribution in commits.
- Branch only — never commit to `main`. Work happens on `hunter/mat-36-add-wide-gamut-p3-etc-support`.
- YAGNI: only `hex`, `oklch`, `oklab` input; P3 only (no HDR, no Rec2020); per-channel framebuffer clip only (no perceptual gamut mapping); no per-stop alpha.
- Don't rebuild `NodeMaterial` on prop change; push values through stable uniforms. (Not directly exercised here, but respect it if touching shader wrappers.)
- "Tests" for GPU/shader visuals are docs-page demos + Playwright, not mocked-GPU unit tests. Pure numeric/logic helpers DO get Vitest unit tests.

## File Structure

**Create:**
- `packages/matter/src/primitives/color-space/cpu-convert.ts` — pure-JS (non-TSL) color conversions: `oklabToLinearSrgb`, `oklchToLinearSrgb`, and the string parser `parseColorString`. Returns **extended** linear-sRGB (channels may exceed `[0,1]` / go negative). This is the CPU mirror of the existing TSL math in `oklab.ts`/`oklch.ts`.
- `packages/matter/src/primitives/color-space/cpu-convert.test.ts` — Vitest unit tests for the conversions and parser.
- `packages/matter/src/runtime/create-renderer/gamut.ts` — pure `OutputGamut` type + `gamutToColorSpace()` mapping (kept separate so it's unit-testable without a GPU).
- `packages/matter/src/runtime/create-renderer/gamut.test.ts` — unit test for the mapping.
- `packages/matter-react/src/hooks/use-display-gamut/use-display-gamut.ts` — `useDisplayGamut(gamut)` hook resolving `'auto'` via `matchMedia`.
- `packages/matter-react/src/hooks/use-display-gamut/use-display-gamut.test.ts` — Vitest (happy-dom) test mocking `matchMedia`.
- `apps/docs/src/app/dev/gamut-probe/page.tsx` + `apps/docs/src/app/dev/gamut-probe/ProbeGrid.tsx` — P3 probe dev route.
- `apps/docs-tests/visual/gamut.spec.ts` — probe + determinism specs.

**Modify:**
- `packages/matter/src/runtime/create-renderer/create-renderer.ts` — accept resolved `gamut`, set `outputColorSpace`.
- `packages/matter/src/primitives/color-space/mix-color.ts` — drop the `clamp(..., 0, 1)`.
- `packages/matter/src/primitives/color-space/mix-color.test.ts` — update the doc-comment-driven expectation.
- `packages/matter/src/primitives/color-space/index.ts` + `packages/matter/src/index.ts` — export new helpers/types.
- `packages/matter-react/src/components/shader-scene/shader-scene.tsx` — add `gamut` prop, resolve via hook, push to renderer, update live on change.
- `packages/matter-react/src/hooks/index.ts` — export `useDisplayGamut`.
- `registry/utils/color.ts` — `parseColor` (dispatch hex/oklch/oklab via `parseColorString`); `parseHex` delegates; `toColorRampStops` uses `parseColor`.
- `registry/aurora/shader.tsx`, `registry/waves/shader.tsx`, `registry/vignette/shader.tsx`, `registry/mesh-gradient/shader.tsx` — swap `parseHex` → `parseColor`.
- `apps/docs-tests/visual/helpers.ts` — add `pinSrgbGamut(page)` init-script helper.
- `apps/docs/src/app/components/linear-gradient/page.tsx` — add a `gamut` Tweakpane control + pass to `ShaderScene` (the "feel it" demo surface).

---

## Phase 1 — Output path plumbing

End state: `<ShaderScene gamut="auto|srgb|p3">` resolves the display gamut and configures the renderer's output color space; live re-resolution when the window changes monitors.

### Task 1: `gamutToColorSpace` mapping helper

**Files:**
- Create: `packages/matter/src/runtime/create-renderer/gamut.ts`
- Test: `packages/matter/src/runtime/create-renderer/gamut.test.ts`

**Interfaces:**
- Produces: `type OutputGamut = 'srgb' | 'p3'`; `function gamutToColorSpace(gamut: OutputGamut): string` returning three's `SRGBColorSpace` for `'srgb'` and `DisplayP3ColorSpace` for `'p3'`.

- [ ] **Step 1: Write the failing test**

```ts
// packages/matter/src/runtime/create-renderer/gamut.test.ts
import { DisplayP3ColorSpace, SRGBColorSpace } from 'three';
import { describe, expect, it } from 'vitest';

import { gamutToColorSpace } from './gamut.js';

describe('gamutToColorSpace', () => {
  it('maps srgb to three SRGBColorSpace', () => {
    expect(gamutToColorSpace('srgb')).toBe(SRGBColorSpace);
  });

  it('maps p3 to three DisplayP3ColorSpace', () => {
    expect(gamutToColorSpace('p3')).toBe(DisplayP3ColorSpace);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @lovo/matter exec vitest run src/runtime/create-renderer/gamut.test.ts`
Expected: FAIL — cannot resolve `./gamut.js`.

- [ ] **Step 3: Write minimal implementation**

```ts
// packages/matter/src/runtime/create-renderer/gamut.ts
import { DisplayP3ColorSpace, SRGBColorSpace } from 'three';

/** The output color gamut the renderer encodes its framebuffer for. */
export type OutputGamut = 'srgb' | 'p3';

/**
 * Map a resolved output gamut to the three color-space constant for
 * `renderer.outputColorSpace`. `'p3'` selects Display P3; `'srgb'` the default.
 */
export function gamutToColorSpace(gamut: OutputGamut): string {
  return gamut === 'p3' ? DisplayP3ColorSpace : SRGBColorSpace;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @lovo/matter exec vitest run src/runtime/create-renderer/gamut.test.ts`
Expected: PASS (2 passed).

- [ ] **Step 5: Commit**

```bash
git add packages/matter/src/runtime/create-renderer/gamut.ts packages/matter/src/runtime/create-renderer/gamut.test.ts
git commit -m "feat(matter): add gamutToColorSpace output-gamut mapping"
```

### Task 2: Wire `gamut` into `createRenderer`

> **Plan revision (2026-06-18, during execution):** Verified against three 0.170 source that `outputColorSpace` alone does NOT produce P3 on either backend. Findings: (a) three 0.170 core registers only sRGB/linear-sRGB in `ColorManagement` — Display P3 ships in the addon `three/examples/jsm/math/ColorSpaces.js` and does NOT self-register, so we must call `ColorManagement.define(...)`; (b) the WebGPU backend's `context.configure({...})` has no `colorSpace` field (defaults sRGB) and the WebGL-fallback backend has no `drawingBufferColorSpace` handling, so P3-encoded pixels would land in an sRGB surface; (c) the context is configured once at init (resize does not re-configure), so a manual `context.configure({ ..., colorSpace: 'display-p3' })` after init persists. Decision (user-approved): hand-roll on 0.170 — register P3, set `outputColorSpace`, and manually re-configure the WebGPU canvas context. WebGL-fallback machines stay sRGB in v1 (graceful, documented). `gamut.ts` (Task 1) absorbs the registration + a `applyCanvasGamut` helper; Task 1's test is corrected to import `DisplayP3ColorSpace` from the addon.

**Files:**
- Modify: `packages/matter/src/runtime/create-renderer/gamut.ts` (add P3 registration + `applyCanvasGamut`)
- Modify: `packages/matter/src/runtime/create-renderer/gamut.test.ts` (import `DisplayP3ColorSpace` from the addon, not `three`)
- Modify: `packages/matter/src/runtime/create-renderer/create-renderer.ts`
- Modify: `packages/matter/src/index.ts`

**Interfaces:**
- Consumes: `OutputGamut`, `gamutToColorSpace`, `applyCanvasGamut` from `gamut.ts`.
- Produces: `CreateRendererOptions.gamut?: OutputGamut` (default `'srgb'`); `createRenderer` sets `three.outputColorSpace` after init and calls `applyCanvasGamut(three, backend, gamut)` after backend detection.

No GPU unit test (we don't mock the GPU). The pure `gamutToColorSpace` mapping IS unit-tested (Task 1). The context reconfigure is validated by the Phase 1 gate on a P3 display.

- [ ] **Step 1: Add the import and option**

In `create-renderer.ts`, add to the imports at top:

```ts
import { type OutputGamut, gamutToColorSpace } from './gamut.js';
```

Add to `CreateRendererOptions` (after `maxDPR`):

```ts
  /** Output color gamut the framebuffer is encoded for. Default: 'srgb'. */
  gamut?: OutputGamut;
```

- [ ] **Step 2: Destructure and apply it**

Add `gamut = 'srgb'` to the destructure block:

```ts
  const {
    antialias = true,
    forceWebGL = false,
    clearColor = 0x000000,
    clearAlpha = 0,
    maxDPR = 2,
    gamut = 'srgb',
  } = opts;
```

After `await three.init();` (and before `setPixelRatio`), set the output color space:

```ts
  three.outputColorSpace = gamutToColorSpace(gamut);
```

- [ ] **Step 3: Re-export the type**

In `packages/matter/src/index.ts`, extend the create-renderer type export block:

```ts
export type {
  GpuRenderer,
  GpuBackend,
  CreateRendererOptions,
  OutputGamut,
} from './runtime/create-renderer/create-renderer.js';
```

And add to `create-renderer.ts` a re-export so the type is reachable from that module path:

```ts
export type { OutputGamut } from './gamut.js';
```

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @lovo/matter typecheck`
Expected: PASS (no errors).

- [ ] **Step 5: Commit**

```bash
git add packages/matter/src/runtime/create-renderer/create-renderer.ts packages/matter/src/index.ts
git commit -m "feat(matter): accept gamut option in createRenderer (default srgb)"
```

### Task 3: `useDisplayGamut` detection hook

**Files:**
- Create: `packages/matter-react/src/hooks/use-display-gamut/use-display-gamut.ts`
- Test: `packages/matter-react/src/hooks/use-display-gamut/use-display-gamut.test.ts`
- Modify: `packages/matter-react/src/hooks/index.ts`

**Interfaces:**
- Consumes: `OutputGamut` from `@lovo/matter`.
- Produces: `type GamutPreference = 'auto' | OutputGamut`; `function useDisplayGamut(preference: GamutPreference): OutputGamut`. For `'srgb'`/`'p3'` returns it verbatim. For `'auto'` returns `'p3'` when `matchMedia('(color-gamut: p3)').matches`, else `'srgb'`, and re-renders on the media query's `change` event.

- [ ] **Step 1: Write the failing test**

```tsx
// packages/matter-react/src/hooks/use-display-gamut/use-display-gamut.test.ts
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useDisplayGamut } from './use-display-gamut.js';

type Listener = (event: { matches: boolean }) => void;

function mockMatchMedia(matches: boolean) {
  const listeners = new Set<Listener>();
  const mql = {
    matches,
    media: '(color-gamut: p3)',
    addEventListener: (_type: string, listener: Listener) => listeners.add(listener),
    removeEventListener: (_type: string, listener: Listener) => listeners.delete(listener),
  };

  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => mql),
  );

  return {
    emit(next: boolean) {
      mql.matches = next;
      for (const listener of listeners) listener({ matches: next });
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useDisplayGamut', () => {
  it('returns explicit preference verbatim without querying', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => {
        throw new Error('should not be called for explicit preference');
      }),
    );
    expect(renderHook(() => useDisplayGamut('srgb')).result.current).toBe('srgb');
    expect(renderHook(() => useDisplayGamut('p3')).result.current).toBe('p3');
  });

  it('resolves auto to p3 when the display supports it', () => {
    mockMatchMedia(true);
    expect(renderHook(() => useDisplayGamut('auto')).result.current).toBe('p3');
  });

  it('resolves auto to srgb when the display does not support p3', () => {
    mockMatchMedia(false);
    expect(renderHook(() => useDisplayGamut('auto')).result.current).toBe('srgb');
  });

  it('updates when the display gamut changes', () => {
    const media = mockMatchMedia(false);
    const { result } = renderHook(() => useDisplayGamut('auto'));

    expect(result.current).toBe('srgb');
    act(() => media.emit(true));
    expect(result.current).toBe('p3');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @lovo/matter-react exec vitest run src/hooks/use-display-gamut/use-display-gamut.test.ts`
Expected: FAIL — cannot resolve `./use-display-gamut.js`.

- [ ] **Step 3: Write minimal implementation**

```ts
// packages/matter-react/src/hooks/use-display-gamut/use-display-gamut.ts
import { useEffect, useState } from 'react';

import type { OutputGamut } from '@lovo/matter';

/** What the consumer asks for: a fixed gamut, or 'auto' to detect the display. */
export type GamutPreference = 'auto' | OutputGamut;

const P3_QUERY = '(color-gamut: p3)';

function detectGamut(): OutputGamut {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'srgb';
  }

  return window.matchMedia(P3_QUERY).matches ? 'p3' : 'srgb';
}

/**
 * Resolve a gamut preference to a concrete output gamut. Explicit 'srgb'/'p3'
 * pass through untouched; 'auto' queries `(color-gamut: p3)` and re-resolves
 * when the display capability changes (e.g. window dragged to another monitor).
 */
export function useDisplayGamut(preference: GamutPreference): OutputGamut {
  const [resolved, setResolved] = useState<OutputGamut>(() =>
    preference === 'auto' ? detectGamut() : preference,
  );

  useEffect(() => {
    if (preference !== 'auto') {
      setResolved(preference);

      return;
    }

    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      setResolved('srgb');

      return;
    }

    const mediaQuery = window.matchMedia(P3_QUERY);
    const update = () => setResolved(mediaQuery.matches ? 'p3' : 'srgb');

    update();
    mediaQuery.addEventListener('change', update);

    return () => mediaQuery.removeEventListener('change', update);
  }, [preference]);

  return resolved;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @lovo/matter-react exec vitest run src/hooks/use-display-gamut/use-display-gamut.test.ts`
Expected: PASS (4 passed).

- [ ] **Step 5: Export the hook**

In `packages/matter-react/src/hooks/index.ts`, add:

```ts
export { useDisplayGamut } from './use-display-gamut/use-display-gamut.js';
export type { GamutPreference } from './use-display-gamut/use-display-gamut.js';
```

- [ ] **Step 6: Commit**

```bash
git add packages/matter-react/src/hooks/use-display-gamut packages/matter-react/src/hooks/index.ts
git commit -m "feat(matter-react): add useDisplayGamut display-gamut detection hook"
```

### Task 4: `gamut` prop on `ShaderScene`

**Files:**
- Modify: `packages/matter-react/src/components/shader-scene/shader-scene.tsx`

**Interfaces:**
- Consumes: `useDisplayGamut`, `GamutPreference` (Task 3); `gamutToColorSpace` is internal to the engine — the React layer passes the resolved `gamut` string into `createRenderer`.
- Produces: `ShaderSceneProps.gamut?: GamutPreference` (default `'auto'`).

No unit test (GPU). Validated by the Phase 1 gate. The existing `shader-scene.test.tsx` must still pass.

- [ ] **Step 1: Update imports and props**

Add to the `@lovo/matter-react`-local imports (the hook is in the same package, import via relative path from the hooks barrel):

```ts
import { type GamutPreference, useDisplayGamut } from '../../hooks/use-display-gamut/use-display-gamut.js';
```

Add to `ShaderSceneProps`:

```ts
  /** Output color gamut. 'auto' (default) uses the widest the display supports. */
  gamut?: GamutPreference;
```

- [ ] **Step 2: Resolve and thread the gamut**

In the component body, destructure `gamut = 'auto'` and resolve it:

```ts
  const { children, fallback, className, style, maxDPR, gamut = 'auto' } = props;
  const resolvedGamut = useDisplayGamut(gamut);
```

Pass it into renderer creation:

```ts
        const renderer = await createRenderer(canvas, { maxDPR, gamut: resolvedGamut });
```

Add `resolvedGamut` to the setup `useEffect` dependency array (currently `[maxDPR]`):

```ts
  }, [maxDPR, resolvedGamut]);
```

This re-creates the renderer when the resolved gamut changes — simplest correct behavior. (A future optimization could mutate `outputColorSpace` in place without a rebuild; not needed for v1, and a rebuild on the rare monitor-switch event is acceptable.)

- [ ] **Step 3: Run the existing ShaderScene tests**

Run: `pnpm --filter @lovo/matter-react exec vitest run src/components/shader-scene/shader-scene.test.tsx`
Expected: PASS (unchanged — the new prop defaults to `'auto'`, and happy-dom `matchMedia` reports no P3 → `'srgb'`).

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @lovo/matter-react typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/matter-react/src/components/shader-scene/shader-scene.tsx
git commit -m "feat(matter-react): add gamut prop to ShaderScene (default auto)"
```

### PHASE 1 GATE (stop and feel it)

**Checkpoint to verify before continuing — this is a manual validation beat.**

1. **Implementation checkpoint (critical):** Confirm the WebGPU backend actually re-configures the `GPUCanvasContext` for P3 from `outputColorSpace`. In `apps/docs`, temporarily set `<ShaderScene gamut="p3">` on the LinearGradient page and run `pnpm --filter @matter/docs dev`. Open it on a P3 display (your Mac). Inspect the canvas in devtools — its backing context should report a `display-p3` color space. If the colors do NOT widen and the context stays `srgb`, the backend isn't honoring `outputColorSpace` alone: configure the context explicitly in `create-renderer.ts` (`context.configure({ ..., colorSpace: 'display-p3' })` via the renderer's backend context) before proceeding. Record the finding.
2. **Feel it:** With a saturated stop (e.g. a pure-ish green), toggle `gamut` `srgb` → `p3` → `auto`. On a P3 display, `p3`/`auto` should look at least as vivid as `srgb`; `srgb` is the floor. (Existing sRGB-hex colors may look identical until Phase 2/3 — that's expected; this gate only proves the output path switches and falls back.)
3. Revert the temporary `gamut="p3"` edit on the demo page.

---

## Phase 2 — Unclamp the mix math

End state: `mixColor` no longer clamps to `[0,1]`, so oklab/oklch intermediates can carry extended linear-sRGB values to the output encode.

### Task 5: Remove the sRGB clamp in `mixColor`

**Files:**
- Modify: `packages/matter/src/primitives/color-space/mix-color.ts`
- Modify: `packages/matter/src/primitives/color-space/mix-color.test.ts`

**Interfaces:**
- `mixColor` signature is unchanged; only the clamp is removed and the doc comment updated.

- [ ] **Step 1: Update the test to assert the new contract**

The existing tests only assert "builds without throwing"; keep them and add one documenting that the result is the unclamped round-trip (structural — we assert it builds and that the doc no longer promises clamping). Replace the file body's `describe` with:

```ts
describe('mixColor', () => {
  it('builds a node for every color space without throwing', () => {
    const red = vec3(1, 0, 0);
    const blue = vec3(0, 0, 1);

    for (const space of SPACES) {
      expect(mixColor(red, blue, uv().x, space)).toBeDefined();
    }
  });

  it('defaults to oklab', () => {
    expect(mixColor(vec3(1, 0, 0), vec3(0, 0, 1), uv().x)).toBeDefined();
  });

  // Extended (out-of-sRGB) endpoints must still build — the result is no longer
  // clamped to [0,1], so wide-gamut values survive to the renderer's output encode.
  it('builds for extended (out-of-sRGB) endpoints', () => {
    const extendedRed = vec3(1.2, -0.04, -0.02);
    const extendedGreen = vec3(-0.1, 1.1, -0.05);

    expect(mixColor(extendedRed, extendedGreen, uv().x, 'oklab')).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it passes against current (clamped) code**

Run: `pnpm --filter @lovo/matter exec vitest run src/primitives/color-space/mix-color.test.ts`
Expected: PASS (the new test builds fine even with the clamp — the behavioral change is verified visually, not numerically, since `mixColor` returns a GPU node).

- [ ] **Step 3: Remove the clamp**

In `mix-color.ts`, update the import and the return, and fix the doc comment.

Change the import line:

```ts
import { vec3 } from 'three/tsl';
```

(remove `clamp` from the `three/tsl` import).

Change the final return:

```ts
  return space.toLinear(space.lerp(a, b, t, hue));
```

Update the JSDoc final sentence from the clamp note to:

```ts
 * rectangular spaces). The result is NOT clamped — extended (out-of-sRGB)
 * values are preserved so a wide-gamut (P3) output can display them; an sRGB
 * output clamps per-channel at the framebuffer, identical to the prior behavior.
```

- [ ] **Step 4: Run tests + typecheck**

Run: `pnpm --filter @lovo/matter exec vitest run src/primitives/color-space/mix-color.test.ts && pnpm --filter @lovo/matter typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/matter/src/primitives/color-space/mix-color.ts packages/matter/src/primitives/color-space/mix-color.test.ts
git commit -m "feat(matter): stop clamping mixColor to sRGB so wide-gamut values survive"
```

### PHASE 2 GATE (stop and feel it)

1. **Confirm sRGB is unchanged:** run the full visual suite and confirm baselines still pass (the suite runs in sRGB, where unclamping is a no-op): `pnpm --filter @matter/docs-tests test`. Expected: green, zero baseline changes. If any baseline diffs, STOP — the clamp removal should be pixel-neutral in sRGB; investigate before regenerating anything.
2. **Feel it (P3):** on the LinearGradient demo, temporarily force `gamut="p3"`, pick two saturated oklch-friendly stops, set `colorSpace="oklch"`, and compare midtones against `gamut="srgb"`. On a P3 display the midtones should read richer. Revert the temporary edit.

---

## Phase 3 — Wide-gamut color input

End state: components accept `oklch(...)` / `oklab(...)` color strings (in addition to hex), decoded to extended linear-sRGB.

### Task 6: CPU color conversions + `parseColorString`

**Files:**
- Create: `packages/matter/src/primitives/color-space/cpu-convert.ts`
- Test: `packages/matter/src/primitives/color-space/cpu-convert.test.ts`
- Modify: `packages/matter/src/primitives/color-space/index.ts`
- Modify: `packages/matter/src/index.ts`

**Interfaces:**
- Consumes: `srgbChannelToLinear` from `./transfer.js`.
- Produces:
  - `oklabToLinearSrgb(lightness: number, greenRed: number, blueYellow: number): [number, number, number]`
  - `oklchToLinearSrgb(lightness: number, chroma: number, hueDegrees: number): [number, number, number]`
  - `parseColorString(input: string): [number, number, number]` — dispatches `#rrggbb` (hex → linear via `srgbChannelToLinear`), `oklab(L a b)`, `oklch(L C H)`. Returns **extended** linear-sRGB (no clamping). Throws `Error` on unrecognized syntax.

- [ ] **Step 1: Write the failing test**

```ts
// packages/matter/src/primitives/color-space/cpu-convert.test.ts
import { describe, expect, it } from 'vitest';

import { oklabToLinearSrgb, oklchToLinearSrgb, parseColorString } from './cpu-convert.js';
import { srgbChannelToLinear } from './transfer.js';

const closeTo = (value: number, target: number, tolerance = 1e-3) =>
  Math.abs(value - target) <= tolerance;

describe('oklabToLinearSrgb', () => {
  it('maps the OKLab white point to linear-sRGB white', () => {
    const [r, g, b] = oklabToLinearSrgb(1, 0, 0);

    expect(closeTo(r, 1)).toBe(true);
    expect(closeTo(g, 1)).toBe(true);
    expect(closeTo(b, 1)).toBe(true);
  });
});

describe('oklchToLinearSrgb', () => {
  it('a high-chroma green lands outside sRGB (a channel goes negative or >1)', () => {
    // P3-ish vivid green: high chroma at hue ~142deg.
    const [r, g, b] = oklchToLinearSrgb(0.86, 0.28, 142);
    const outOfGamut = r < -1e-4 || g > 1 + 1e-4 || b < -1e-4 || r > 1 + 1e-4;

    expect(outOfGamut).toBe(true);
  });

  it('an in-gamut color stays within [0,1]', () => {
    // Mid grey-ish: low chroma.
    const channels = oklchToLinearSrgb(0.6, 0.02, 120);

    for (const channel of channels) {
      expect(channel).toBeGreaterThanOrEqual(-1e-3);
      expect(channel).toBeLessThanOrEqual(1 + 1e-3);
    }
  });
});

describe('parseColorString', () => {
  it('parses hex identical to the per-channel sRGB decode', () => {
    const [r, g, b] = parseColorString('#8c0067');

    expect(closeTo(r, srgbChannelToLinear(0x8c / 255))).toBe(true);
    expect(closeTo(g, srgbChannelToLinear(0x00 / 255))).toBe(true);
    expect(closeTo(b, srgbChannelToLinear(0x67 / 255))).toBe(true);
  });

  it('parses oklch() with degrees', () => {
    const fromString = parseColorString('oklch(0.86 0.28 142)');
    const direct = oklchToLinearSrgb(0.86, 0.28, 142);

    expect(closeTo(fromString[0], direct[0])).toBe(true);
    expect(closeTo(fromString[1], direct[1])).toBe(true);
    expect(closeTo(fromString[2], direct[2])).toBe(true);
  });

  it('parses oklch() percentage lightness and a deg suffix and a dropped alpha', () => {
    const fromString = parseColorString('oklch(86% 0.28 142deg / 0.5)');
    const direct = oklchToLinearSrgb(0.86, 0.28, 142);

    expect(closeTo(fromString[0], direct[0])).toBe(true);
    expect(closeTo(fromString[1], direct[1])).toBe(true);
    expect(closeTo(fromString[2], direct[2])).toBe(true);
  });

  it('parses oklab()', () => {
    const fromString = parseColorString('oklab(0.7 0.15 -0.1)');
    const direct = oklabToLinearSrgb(0.7, 0.15, -0.1);

    expect(closeTo(fromString[0], direct[0])).toBe(true);
  });

  it('throws on unrecognized syntax', () => {
    expect(() => parseColorString('rebeccapurple')).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @lovo/matter exec vitest run src/primitives/color-space/cpu-convert.test.ts`
Expected: FAIL — cannot resolve `./cpu-convert.js`.

- [ ] **Step 3: Write minimal implementation**

```ts
// packages/matter/src/primitives/color-space/cpu-convert.ts
import { srgbChannelToLinear } from './transfer.js';

/**
 * OKLab (L, a, b) -> extended linear-sRGB. CPU mirror of the TSL `oklabToLinear`
 * in `oklab.ts` (same M2^-1 / cube / M1^-1 matrices). The result is NOT clamped:
 * colors outside sRGB return channels below 0 or above 1, which a wide-gamut
 * output can render and an sRGB output clamps at the framebuffer.
 */
export function oklabToLinearSrgb(
  lightness: number,
  greenRed: number,
  blueYellow: number,
): [number, number, number] {
  const longRoot = lightness + 0.3963377774 * greenRed + 0.2158037573 * blueYellow;
  const mediumRoot = lightness - 0.1055613458 * greenRed - 0.0638541728 * blueYellow;
  const shortRoot = lightness - 0.0894841775 * greenRed - 1.291485548 * blueYellow;

  const longCone = longRoot * longRoot * longRoot;
  const mediumCone = mediumRoot * mediumRoot * mediumRoot;
  const shortCone = shortRoot * shortRoot * shortRoot;

  const red = 4.0767416621 * longCone - 3.3077115913 * mediumCone + 0.2309699292 * shortCone;
  const green = -1.2684380046 * longCone + 2.6097574011 * mediumCone - 0.3413193965 * shortCone;
  const blue = -0.0041960863 * longCone - 0.7034186147 * mediumCone + 1.707614701 * shortCone;

  return [red, green, blue];
}

/** OKLch (L, C, h-in-degrees) -> extended linear-sRGB. */
export function oklchToLinearSrgb(
  lightness: number,
  chroma: number,
  hueDegrees: number,
): [number, number, number] {
  const hueRadians = (hueDegrees * Math.PI) / 180;
  const greenRed = chroma * Math.cos(hueRadians);
  const blueYellow = chroma * Math.sin(hueRadians);

  return oklabToLinearSrgb(lightness, greenRed, blueYellow);
}

/** Parse `50%` -> 0.5 or a bare number. `scale` is the value of 100% (default 1). */
function parseComponent(token: string, scale: number): number {
  const trimmed = token.trim();

  if (trimmed.endsWith('%')) {
    return (parseFloat(trimmed.slice(0, -1)) / 100) * scale;
  }

  return parseFloat(trimmed);
}

/** Split `oklch(...)`/`oklab(...)` inner text into 3 component tokens, dropping `/ alpha`. */
function functionArgs(input: string, prefix: string): string[] {
  const inner = input.slice(prefix.length, input.lastIndexOf(')'));
  const beforeAlpha = inner.split('/')[0] ?? '';

  return beforeAlpha
    .trim()
    .split(/[\s,]+/)
    .filter((token) => token.length > 0);
}

/**
 * Parse a color string to **extended** linear-sRGB. Accepts `#rrggbb`,
 * `oklab(L a b)`, and `oklch(L C H)` (CSS Color 4 syntax: L/C may be percentages,
 * H may carry a `deg` suffix, an optional `/ alpha` is parsed and dropped).
 * Throws on any other syntax.
 */
export function parseColorString(input: string): [number, number, number] {
  const value = input.trim();

  if (value.startsWith('#')) {
    const hex = value.slice(1);

    return [
      srgbChannelToLinear(parseInt(hex.slice(0, 2), 16) / 255),
      srgbChannelToLinear(parseInt(hex.slice(2, 4), 16) / 255),
      srgbChannelToLinear(parseInt(hex.slice(4, 6), 16) / 255),
    ];
  }

  if (value.startsWith('oklch(')) {
    const [lightnessToken, chromaToken, hueToken] = functionArgs(value, 'oklch(');

    if (lightnessToken === undefined || chromaToken === undefined || hueToken === undefined) {
      throw new Error(`Invalid oklch() color: "${input}"`);
    }

    const lightness = parseComponent(lightnessToken, 1);
    const chroma = parseComponent(chromaToken, 0.4);
    const hueDegrees = parseFloat(hueToken.replace(/deg$/, ''));

    return oklchToLinearSrgb(lightness, chroma, hueDegrees);
  }

  if (value.startsWith('oklab(')) {
    const [lightnessToken, aToken, bToken] = functionArgs(value, 'oklab(');

    if (lightnessToken === undefined || aToken === undefined || bToken === undefined) {
      throw new Error(`Invalid oklab() color: "${input}"`);
    }

    return oklabToLinearSrgb(
      parseComponent(lightnessToken, 1),
      parseComponent(aToken, 0.4),
      parseComponent(bToken, 0.4),
    );
  }

  throw new Error(`Unsupported color syntax: "${input}". Use #rrggbb, oklch(...), or oklab(...).`);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @lovo/matter exec vitest run src/primitives/color-space/cpu-convert.test.ts`
Expected: PASS (all assertions).

- [ ] **Step 5: Export the helpers**

In `packages/matter/src/primitives/color-space/index.ts`, add:

```ts
export { oklabToLinearSrgb, oklchToLinearSrgb, parseColorString } from './cpu-convert.js';
```

In `packages/matter/src/index.ts`, extend the color-space export line:

```ts
export {
  mixColor,
  srgbChannelToLinear,
  oklabToLinearSrgb,
  oklchToLinearSrgb,
  parseColorString,
} from './primitives/color-space/index.js';
```

- [ ] **Step 6: Typecheck + commit**

Run: `pnpm --filter @lovo/matter typecheck`
Expected: PASS.

```bash
git add packages/matter/src/primitives/color-space/cpu-convert.ts packages/matter/src/primitives/color-space/cpu-convert.test.ts packages/matter/src/primitives/color-space/index.ts packages/matter/src/index.ts
git commit -m "feat(matter): add CPU oklab/oklch decode and parseColorString"
```

### Task 7: Route component color parsing through `parseColor`

**Files:**
- Modify: `registry/utils/color.ts`
- Modify: `registry/aurora/shader.tsx`
- Modify: `registry/waves/shader.tsx`
- Modify: `registry/vignette/shader.tsx`
- Modify: `registry/mesh-gradient/shader.tsx`

**Interfaces:**
- Consumes: `parseColorString` from `@lovo/matter` (Task 6).
- Produces: `parseColor(input: string): [number, number, number]` exported from `registry/utils/color.ts`; `parseHex` retained as a thin delegate so no existing call site breaks.

No new unit test (registry has no Vitest setup; the parser itself is unit-tested in Task 6). Validated by the Phase 3 gate + the existing visual suite.

- [ ] **Step 1: Update `registry/utils/color.ts`**

Replace the import line and the `parseHex` block. New top of file:

```ts
import { type ColorRampStop, parseColorString } from '@lovo/matter';
import { vec3 } from 'three/tsl';

/**
 * Parse a color string into **extended** linear-sRGB channels. Accepts `#rrggbb`,
 * `oklch(...)`, and `oklab(...)`. Hex is sRGB and decodes into [0,1]; oklch/oklab
 * may land outside sRGB (channels <0 or >1) for wide-gamut (P3) colors — those
 * survive to a P3 output and clamp per-channel on an sRGB output.
 */
export const parseColor = (color: string): [number, number, number] => parseColorString(color);

/** @deprecated Use {@link parseColor}; retained so existing call sites keep working. */
export const parseHex = parseColor;
```

Keep `ColorStop`, `Palette`, `colorStopsKey`, and `toColorRampStops` as-is **except** change the `parseHex(stop.color)` call inside `toColorRampStops` to `parseColor(stop.color)`:

```ts
    const [redChannel, greenChannel, blueChannel] = parseColor(stop.color);
```

- [ ] **Step 2: Swap `parseHex` → `parseColor` in the four shaders**

In each of `registry/aurora/shader.tsx`, `registry/waves/shader.tsx`, `registry/vignette/shader.tsx`, `registry/mesh-gradient/shader.tsx`:

- Change the import `import { parseHex } from '../utils/color';` (and any `type Palette, parseHex` form) to import `parseColor` instead (keep other named imports like `Palette`).
- Replace every `parseHex(` call with `parseColor(`.

Exact call sites (from grep): `aurora/shader.tsx` lines ~60, ~71, ~148; `waves/shader.tsx` line ~94; `vignette/shader.tsx` lines ~48, ~59; `mesh-gradient/shader.tsx` lines ~39, ~50 (and the import on line ~21 is `import { type Palette, parseColor } from '../utils/color';`).

- [ ] **Step 3: Typecheck the registry and docs**

Run: `pnpm typecheck`
Expected: PASS (all packages).

- [ ] **Step 4: Commit**

```bash
git add registry/utils/color.ts registry/aurora/shader.tsx registry/waves/shader.tsx registry/vignette/shader.tsx registry/mesh-gradient/shader.tsx
git commit -m "feat(registry): accept oklch/oklab color inputs via parseColor"
```

### PHASE 3 GATE (stop and feel it)

1. **Automated:** Task 6 unit tests prove a high-chroma `oklch(...)` decodes to extended linear-sRGB (channels outside `[0,1]`). This is the deterministic proof that wide-gamut input flows.
2. **Feel it:** on the LinearGradient demo (run `pnpm --filter @matter/docs dev`), set a stop to a vivid `oklch(0.87 0.34 142)` and toggle `gamut`. Under `p3` on a P3 display it looks vividly green, beyond what the same hex could show; under `srgb` it clamps gracefully to the sRGB edge.

> **Gate result (during execution): PASSED with a follow-up.** The wide-gamut color rendered and P3 output is active. The corrected test color is `oklch(0.87 0.34 142)` (the planned `0.86 0.28 142` is actually *inside* sRGB — sRGB green's max chroma at that hue is ~0.295). The stop-color Tweakpane widget had to switch from the color-picker to a text input (`view: 'text'`) because the picker silently rejects `oklch()`/`oklab()` strings.
>
> **Banding observed (expected, filed):** smooth gradients show visible 8-bit quantization banding on P3 output (the same 256 levels stretched across a wider gamut). Investigated float/HDR mitigation: three 0.170 has no supported float-canvas path and full HDR is out of scope. Dithering is the cheap standard fix — filed as **GitHub #46** and scheduled as **Phase 5 (spike)** below. Not a blocker for P3 support.

---

## Phase 4 — Docs demo + visual regression

End state: visual baselines stay deterministic regardless of the dev machine's display; a probe proves the P3 path widens; the LinearGradient demo exposes the `gamut` control.

### Task 8: Pin visual-regression scenes to sRGB

> **Plan revisions (during execution):**
> - **Pulled forward before the Phase 2 gate.** On a P3 dev machine the gate's "baselines unchanged" check is meaningless until scenes are pinned to sRGB (default `auto` → P3 otherwise), so this ran before Task 5's gate verification.
> - **Shared fixture instead of a per-spec `pinSrgbGamut(page)` helper.** Added `apps/docs-tests/visual/fixtures.ts` exporting an extended `test` whose `context` fixture installs the init script once; all 10 screenshot/pixel specs swap `import { expect, test } from '@playwright/test'` → `from './fixtures'`. DRYer and covers the probe specs too. The only manual-`browser.newContext()` test (linear-gradient reduced-motion) needs no pin — it compares two shots for equality, no baseline.
> - **Bug fix vs the plan's draft helper:** spreading a `MediaQueryList` (`{...mql, matches:false}`) drops its methods, so `addEventListener` would be `undefined` and `useDisplayGamut` would throw. The fixture wraps it in a `Proxy` instead.
> - **Correct test command is `pnpm --filter @matter/docs-tests test:visual`** (there is no `test` script). All gate/verification commands below that say `... test` should read `... test:visual`.
> - **Pre-existing flakiness found (NOT caused by this feature):** the full suite shows a rotating 1/20 failure between `grain` and `vignette` (both animated grain overlays capturing at a slightly different animation phase under single-worker load). Verified by running the full suite on the pre-feature engine, where it also fails 1/20 (grain that run). All non-grain tests — including every mixColor/colorRamp-driven gradient — pass deterministically, which is the real proof the clamp removal (Task 5) is sRGB-neutral. The grain-test flake is out of scope for this feature; flagged to the user.

**Files:**
- Create: `apps/docs-tests/visual/fixtures.ts`
- Modify: the 10 screenshot/pixel specs (swap the `@playwright/test` import for `./fixtures`)

**Interfaces:**
- Produces: `pinSrgbGamut(page: Page): Promise<void>` — installs an init script forcing `matchMedia('(color-gamut: p3)')` to report `matches: false`, so `ShaderScene`'s default `'auto'` resolves to `'srgb'` on any machine.

Rationale: existing baselines were generated under sRGB (CI). Pinning keeps them reproducible on P3 dev machines without re-baselining.

- [ ] **Step 1: Add the helper**

Append to `apps/docs-tests/visual/helpers.ts`:

```ts
/**
 * Force `(color-gamut: p3)` to NOT match for this page, so ShaderScene's default
 * `gamut="auto"` resolves to sRGB regardless of the host display. Keeps visual
 * baselines deterministic across sRGB CI and P3 dev machines. Call BEFORE goto.
 */
export async function pinSrgbGamut(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const nativeMatchMedia = window.matchMedia.bind(window);

    window.matchMedia = (query: string) => {
      if (query.includes('color-gamut') && query.includes('p3')) {
        return {
          ...nativeMatchMedia(query),
          matches: false,
        } as MediaQueryList;
      }

      return nativeMatchMedia(query);
    };
  });
}
```

- [ ] **Step 2: Apply it in every component visual spec**

In each `apps/docs-tests/visual/*.spec.ts`, import `pinSrgbGamut` alongside `waitForShader` and call `await pinSrgbGamut(page);` immediately before the first `await page.goto(...)` in each test that screenshots a shader. Example for `linear-gradient.spec.ts` first test:

```ts
import { pinSrgbGamut, waitForShader } from './helpers';

test('LinearGradient — default story', async ({ page }) => {
  await pinSrgbGamut(page);
  await page.goto('/components/linear-gradient?visualTest=1');
  await waitForShader(page);
  // ...unchanged
});
```

For tests that create their own context/page via `browser.newContext()` (the reduced-motion ones), call `await pinSrgbGamut(page);` on the created `page` before its `goto`.

- [ ] **Step 3: Run the full visual suite**

Run: `pnpm --filter @matter/docs-tests test`
Expected: PASS with NO baseline changes. (Pinning to sRGB matches how baselines were generated; if any diff appears, the host was previously rendering P3 — the pin is what fixes it. Do not `--update-snapshots` unless a diff is understood and intended.)

- [ ] **Step 4: Commit**

```bash
git add apps/docs-tests/visual/helpers.ts apps/docs-tests/visual/*.spec.ts
git commit -m "test(docs-tests): pin visual scenes to sRGB for deterministic baselines"
```

### Task 9: P3 probe dev route + spec

> **Plan revision (during execution): the automated pixel-diff probe isn't achievable; the spec is a render smoke test instead.** Confirmed empirically: a WebGPU canvas can't be read back via `drawImage`/`getImageData` (returns zeros after present), and a Playwright screenshot is color-managed to sRGB, collapsing the P3-vs-sRGB difference. So `gamut.spec.ts` asserts both forced-gamut ShaderScenes render without error (canvases sized, no page errors) — guarding that the manual Display-P3 `context.configure` doesn't throw/blank. The deterministic automated proof of wide-gamut **decode** is the `parseColorString` unit test (Task 6); output-**widening** is validated by eye on a P3 display (Phase 3 gate). The probe route stays useful for manual inspection.

**Files:**
- Create: `apps/docs/src/app/dev/gamut-probe/page.tsx`
- Create: `apps/docs/src/app/dev/gamut-probe/ProbeGrid.tsx`
- Create: `apps/docs-tests/visual/gamut.spec.ts`

**Interfaces:**
- Consumes: `ShaderScene` `gamut` prop, `mixColor`, `parseColorString`/`oklchToLinearSrgb` (engine), the `addPlaneMesh` docs util, `VisualTestPause`.
- Produces: a route `/dev/gamut-probe` rendering the SAME out-of-sRGB oklch color in two stacked halves — top forced `gamut="srgb"`, bottom forced `gamut="p3"`. The spec asserts the two halves differ (proves the P3 path does something the sRGB path can't).

- [ ] **Step 1: Build the probe components**

```tsx
// apps/docs/src/app/dev/gamut-probe/ProbeGrid.tsx
'use client';

import { useEffect } from 'react';

import { oklchToLinearSrgb } from '@lovo/matter';
import { ShaderScene, useShaderContext } from '@lovo/matter-react';
import { vec3, vec4 } from 'three/tsl';

import { addPlaneMesh } from '@/lib/meshUtils';
import { VisualTestPause } from '@/lib/visualTestHooks';

// A vivid green that lands outside sRGB — its linear-sRGB channels exceed [0,1].
const VIVID_GREEN = oklchToLinearSrgb(0.86, 0.28, 142);

function ProbeMesh() {
  const shaderContext = useShaderContext();

  useEffect(() => {
    if (!shaderContext) return;

    const color = vec3(VIVID_GREEN[0], VIVID_GREEN[1], VIVID_GREEN[2]);

    return addPlaneMesh(shaderContext, vec4(color, 1));
  }, [shaderContext]);

  return null;
}

export default function ProbeGrid() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      <div data-gamut="srgb" style={{ position: 'relative', width: '100%', height: 300 }}>
        <ShaderScene gamut="srgb">
          <ProbeMesh />
          <VisualTestPause />
        </ShaderScene>
      </div>
      <div data-gamut="p3" style={{ position: 'relative', width: '100%', height: 300 }}>
        <ShaderScene gamut="p3">
          <ProbeMesh />
          <VisualTestPause />
        </ShaderScene>
      </div>
    </div>
  );
}
```

```tsx
// apps/docs/src/app/dev/gamut-probe/page.tsx
import dynamic from 'next/dynamic';

const ProbeGrid = dynamic(() => import('./ProbeGrid'), { ssr: false });

export default function GamutProbePage() {
  return <ProbeGrid />;
}
```

(If sibling dev routes set `export const dynamic = '...'` or use a client-only pattern, mirror that exact pattern — check `apps/docs/src/app/dev/color-space-probe/` for the convention the build expects.)

- [ ] **Step 2: Write the probe spec**

```ts
// apps/docs-tests/visual/gamut.spec.ts
import { expect, test } from '@playwright/test';

import { waitForShader } from './helpers';

// NOTE: do NOT pinSrgbGamut here — the route forces gamut explicitly per half.
test('gamut probe — P3 output differs from sRGB for an out-of-sRGB color', async ({ page }) => {
  await page.goto('/dev/gamut-probe?visualTest=1');
  await waitForShader(page);

  const srgbCanvas = page.locator('[data-gamut="srgb"] canvas').first();
  const p3Canvas = page.locator('[data-gamut="p3"] canvas').first();

  const srgbShot = await srgbCanvas.screenshot();
  const p3Shot = await p3Canvas.screenshot();

  // The same out-of-sRGB color, rendered through a P3 output, must produce a
  // different framebuffer than the sRGB output (which clamps it to the sRGB edge).
  expect(srgbShot.compare(p3Shot)).not.toBe(0);
});
```

- [ ] **Step 3: Run the probe spec**

Run: `pnpm --filter @matter/docs-tests test gamut.spec.ts`
Expected: PASS.

**Implementation checkpoint:** if this FAILS with the two halves identical, the failure mode is screenshot color-management collapsing the P3 canvas back to sRGB on an sRGB CI display. If so, switch the assertion to a GPU-side readback (`renderer.three.readRenderTargetPixelsAsync` on a render target, or read the canvas via `toDataURL`/`getImageData` with an explicit `{ colorSpace: 'display-p3' }`) comparing the encoded buffers, which is independent of the display. Record which approach was used and why.

- [ ] **Step 4: Commit**

```bash
git add apps/docs/src/app/dev/gamut-probe apps/docs-tests/visual/gamut.spec.ts
git commit -m "test(docs-tests): add P3 gamut probe route and spec"
```

### Task 10: `gamut` control on the LinearGradient demo

**Files:**
- Modify: `apps/docs/src/app/components/linear-gradient/page.tsx`

**Interfaces:**
- Consumes: `ShaderScene` `gamut` prop; `GamutPreference` type from `@lovo/matter-react`.
- Produces: a Tweakpane `gamut` dropdown (`auto`/`srgb`/`p3`) driving `<ShaderScene gamut={...}>` — the "feel it" surface.

- [ ] **Step 1: Add gamut to the demo params**

Add the type import near the other type imports:

```ts
import type { GamutPreference } from '@lovo/matter-react';
```

Extend the `Params` interface with `gamut: GamutPreference;` and `INITIAL` with `gamut: 'auto',`.

- [ ] **Step 2: Add the Tweakpane control**

After the `hueInterpolation` binding block, add:

```ts
    pane.addBinding(local, 'gamut', {
      options: { Auto: 'auto', sRGB: 'srgb', 'Display P3': 'p3' },
    });
```

- [ ] **Step 3: Pass it to ShaderScene and the remount key**

Change the demo's `<ShaderScene>` to `<ShaderScene gamut={params.gamut}>`. Add `params.gamut` to `remountKey` so a gamut change remounts cleanly:

```ts
  const remountKey =
    params.gamut +
    '|' +
    params.colorSpace +
    '|' +
    params.hueInterpolation +
    '|' +
    params.stops.map((stop) => `${stop.color}@${stop.position}`).join('|');
```

Also include `gamut` in the copyable `formatJsx`/`formatParams` output (add `gamut="${params.gamut}"` to the JSX string and `gamut: '${params.gamut}',` to the params string), so copied snippets reflect the control.

- [ ] **Step 4: Typecheck + manual check**

Run: `pnpm typecheck`
Expected: PASS.

Run: `pnpm --filter @matter/docs dev`, open the LinearGradient page, toggle the gamut dropdown, confirm it switches without errors and (on P3) shows the difference with a vivid `oklch(...)` stop.

- [ ] **Step 5: Commit**

```bash
git add apps/docs/src/app/components/linear-gradient/page.tsx
git commit -m "docs: expose gamut control on the LinearGradient playground"
```

### PHASE 4 GATE (stop and feel it)

1. Full visual suite green: `pnpm --filter @matter/docs-tests test:visual` (note: the script is `test:visual`, not `test`; expect the pre-existing grain-overlay flake from #45 — re-run or accept 19/20).
2. The gamut-probe spec passes (or the readback fallback is in place with a recorded note).
3. On the LinearGradient page, the `gamut` dropdown is present and switches live; with an `oklch(...)` stop the P3 setting reads more vivid on a P3 display and falls back cleanly on sRGB.

---

## Phase 5 — Output dithering spike (added during execution)

> Tracked as **GitHub #46**. Goal: reduce the 8-bit-P3 gradient banding observed at the Phase 3 gate with a small sub-LSB output dither.
>
> **Outcome (kept as spike, user-approved):** added a `dither` TSL primitive (`packages/matter/src/primitives/dither/`) — hash-based triangular-PDF noise (~1 LSB), exported from `@lovo/matter` — and applied it always-on to `LinearGradient`'s output. Confirmed visually it breaks up the P3 banding. Caveats it ships with (full productization deferred to #46): applied in **linear-sRGB working space** (correct home is a final output pass after color conversion), **always-on** (no toggle), and **LinearGradient-only** (other components still band). The 1-LSB noise stays within the visual-regression screenshot tolerance, so no baselines changed.

## Phase 6 — Wide-gamut color picker + HSL/HSV crash fix (added during execution)

> Surfaced while validating Phase 5.
>
> **Color picker:** the built-in Tweakpane picker is sRGB and rejects `oklch()`/`oklab()`. Added `tweakpane-plugin-color-plus` (pre-release, **docs-only devDependency**) to the LinearGradient playground; seeded the demo's default stops in oklch and set `color: { formatLocked: true }` so `stop.color` always stays oklch — a format `parseColor` supports — regardless of picker manipulation (no `rgb()`/`hsl()`/`display-p3()` leak).
>
> **Bug fix (`fix(matter)`):** an out-of-sRGB stop (negative/&gt;1 linear channels — now reachable via oklch inputs + unclamped mixing) sent through `hsl`/`hsv` `fromLinear` produced `pow(negativeConstant, …)`, which WGSL const-evaluation rejects → fragment shader failed to compile → black canvas. Root-caused via the quoted WGSL error (the strict const-eval doesn't reproduce in headless Chromium's WebGPU toolchain). Fix: clamp into `[0,1]` before the sRGB transfer in `hsl`/`hsv` `fromLinear` — HSL/HSV are sRGB-gamut concepts, so gamut-clamping before conversion is the correct behavior. Guarded by a new `dev/hsl-gamut-probe` route + `hsl-gamut.spec.ts` (guards rendering; can't reproduce the exact compile error headless).

---

## Self-Review

**Spec coverage:**
- API (`gamut: 'auto'|'srgb'|'p3'` on ShaderScene, default `'auto'`; `createRenderer` resolved-`gamut` param) → Tasks 1, 2, 4.
- Detection + live re-resolution via `matchMedia` → Task 3, wired in Task 4.
- Output path / `outputColorSpace` + WebGPU-context checkpoint → Task 2 + Phase 1 gate.
- Unclamp `mixColor` (sRGB-neutral) → Task 5 + Phase 2 gate.
- Wide-gamut input `oklch()`/`oklab()` → extended linear, no `color(display-p3)`/`rgb()`/`hsl()` → Tasks 6, 7.
- Visual-regression determinism (pin sRGB) → Task 8.
- P3 probe → Task 9.
- Docs demo with controls → Task 10.
- Non-goals (HDR, Rec2020, gamut mapping, palette re-gen, per-stop alpha) → respected; alpha explicitly parsed-and-dropped in Task 6.

**Placeholder scan:** No TBD/TODO; every code step has complete code. The two `Implementation checkpoint` notes (WebGPU context config in Phase 1 gate; probe readback fallback in Task 9) are genuine spec-flagged open items with concrete fallbacks, not placeholders.

**Type consistency:** `OutputGamut` (`'srgb'|'p3'`) defined in Task 1, consumed in Tasks 2/3; `GamutPreference` (`'auto'|OutputGamut`) defined in Task 3, consumed in Tasks 4/10. `parseColorString` defined Task 6, consumed Task 7 (`parseColor` delegate). `gamutToColorSpace` Task 1 → Task 2. Names consistent across tasks.

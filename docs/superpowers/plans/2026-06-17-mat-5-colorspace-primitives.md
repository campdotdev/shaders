# Color-space primitives (MAT-5, Plan 1 of 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the engine-layer color-space conversion primitives (`linear`, `oklab`, `oklch`, `lch`, `hsl`, `hsv`), a `mixColor` primitive, a `colorSpace` parameter on `colorRamp`, and a Playwright-verified probe page — with **no change to any shipped component's appearance**.

**Architecture:** Each color space is a small module exporting a `ColorSpaceImpl` (`fromLinear` / `toLinear` / `lerp`). A registry maps `ColorSpace` → impl. `mixColor` and `colorRamp` are generic dispatchers over the registry. All conversions assume **linear-sRGB** input/output; output is clamped to `[0,1]` (gamut clip). Correctness is verified by a probe page that renders round-trip swatches sampled by Playwright.

**Tech Stack:** TypeScript 5 (strict, `verbatimModuleSyntax`), `three@0.170.0` TSL (`three/tsl`), Vitest 4 (smoke tests), Playwright (pixel readback against the docs site), Next.js 15 docs app.

**Scope note:** This is Plan 1 of 3 for the MAT-5 spec (`docs/superpowers/specs/2026-06-17-mat-5-colorspace-interpolation-design.md`). It covers **spec Phase 1 only**. Plan 2 (foundation fix `parseHex`→linear + LinearGradient slice) and Plan 3 (rollout to SimplexNoise/MeshGradient/Aurora/Waves + docs) are written after this plan's validation gate. **This plan must not change `parseHex` or any component** — that is deliberately deferred so no baselines break here.

## Global Constraints

- TypeScript strict mode, `verbatimModuleSyntax`, `noUncheckedIndexedAccess`. Use `import type` for type-only imports; relative imports end in `.js`.
- Clear, descriptive identifiers — no terse abbreviations (CLAUDE.md naming convention). Reasonable exceptions: math/shader locals mirroring the math (single-letter color/space channels like `r`, `g`, `b`, `L`, `a`, `b`, `h`).
- No emojis in code or commit messages.
- Build TSL expressions in functional / method-chained form mirroring existing primitives (`color-ramp.ts`, `quantize.ts`). Do not wrap in `Fn(...)`.
- Conventional Commits, scope `matter` for the engine package: `feat(matter): …`. The probe page + Playwright test commit under `docs`/`test` scopes as noted.
- `pnpm` only. Engine tests: `pnpm --filter @lovo/matter test`. Typecheck: `pnpm --filter @lovo/matter typecheck`.
- **Deviation from spec, intentional:** `colorRamp`'s `colorSpace` parameter defaults to `'linear'` (a behavior-preserving no-op mix), NOT `'oklab'`. The opinionated `'oklab'` default lives at the component-prop layer (Plan 2+). This keeps `colorRamp` a neutral primitive and guarantees this plan changes no appearance.

---

## File Structure

Create (engine, `packages/matter/src/primitives/color-space/`):
- `types.ts` — `ColorSpace` union + `ColorSpaceImpl` interface.
- `transfer.ts` — `srgbChannelToLinear` (JS), `srgbToLinear` / `linearToSrgb` (TSL). Used by hsl/hsv and (later) the foundation fix.
- `hue.ts` — `shortestArcHue(h1, h2, t, period)`.
- `linear.ts` — `linearSpace` (identity).
- `oklab.ts` — `linearToOklab` / `oklabToLinear` + `oklabSpace`.
- `oklch.ts` — `oklchSpace` (builds on oklab).
- `lch.ts` — `lchSpace` (CIELAB via XYZ).
- `hsl.ts` — `hslSpace` (on gamma sRGB).
- `hsv.ts` — `hsvSpace` (on gamma sRGB).
- `registry.ts` — `colorSpaces: Record<ColorSpace, ColorSpaceImpl>`.
- `mix-color.ts` — `mixColor(colorA, colorB, t, colorSpace)`.
- `index.ts` — barrel exporting `mixColor`, `ColorSpace`.
- Test files: `transfer.test.ts`, `mix-color.test.ts`, `color-ramp.test.ts` (in `color-ramp/`).

Modify:
- `packages/matter/src/primitives/color-ramp/color-ramp.ts` — add `colorSpace` param.
- `packages/matter/src/index.ts` — export `mixColor`, `ColorSpace`.

Create (test harness):
- `apps/docs/src/app/dev/color-space-probe/page.tsx` — probe page.
- `apps/docs-tests/visual/color-space.spec.ts` — Playwright pixel-readback test.

---

## Task 1: `ColorSpace` type + sRGB transfer functions

**Files:**
- Create: `packages/matter/src/primitives/color-space/types.ts`
- Create: `packages/matter/src/primitives/color-space/transfer.ts`
- Test: `packages/matter/src/primitives/color-space/transfer.test.ts`

**Interfaces:**
- Produces: `type ColorSpace = 'linear' | 'oklab' | 'oklch' | 'lch' | 'hsl' | 'hsv'`; `interface ColorSpaceImpl { fromLinear, toLinear, lerp }`; `srgbChannelToLinear(c: number): number`; `srgbToLinear(srgb)` / `linearToSrgb(linear)` returning `ShaderNodeObject<Node>`.

- [ ] **Step 1: Write the failing test** — `transfer.test.ts`

```ts
import { uv } from 'three/tsl';
import { describe, expect, it } from 'vitest';

import { linearToSrgb, srgbChannelToLinear, srgbToLinear } from './transfer.js';

describe('srgbChannelToLinear', () => {
  it('maps endpoints exactly', () => {
    expect(srgbChannelToLinear(0)).toBe(0);
    expect(srgbChannelToLinear(1)).toBeCloseTo(1, 6);
  });

  it('matches the known sRGB midpoint (0.5 -> ~0.214041)', () => {
    expect(srgbChannelToLinear(0.5)).toBeCloseTo(0.21404114, 6);
  });

  it('uses the linear segment below the 0.04045 knee', () => {
    expect(srgbChannelToLinear(0.04)).toBeCloseTo(0.04 / 12.92, 6);
  });
});

describe('TSL transfer nodes', () => {
  it('build without throwing', () => {
    expect(srgbToLinear(uv())).toBeDefined();
    expect(linearToSrgb(uv())).toBeDefined();
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `pnpm --filter @lovo/matter test -- transfer`
Expected: FAIL — `Cannot find module './transfer.js'`.

- [ ] **Step 3: Create `types.ts`**

```ts
import type { ShaderNodeObject } from 'three/tsl';
import type { Node } from 'three/webgpu';

import type { TSLNode } from '../color-ramp/color-ramp.js';

/** Interpolation space for blending colors. Always converts via linear-sRGB. */
export type ColorSpace = 'linear' | 'oklab' | 'oklch' | 'lch' | 'hsl' | 'hsv';

/**
 * One color space's TSL implementation. `fromLinear`/`toLinear` convert between
 * linear-sRGB and the space's coordinates; `lerp` interpolates two in-space
 * coordinates (with shortest-arc hue for cylindrical spaces).
 */
export interface ColorSpaceImpl {
  fromLinear(rgb: ShaderNodeObject<Node>): ShaderNodeObject<Node>;
  toLinear(coords: ShaderNodeObject<Node>): ShaderNodeObject<Node>;
  lerp(a: ShaderNodeObject<Node>, b: ShaderNodeObject<Node>, t: TSLNode): ShaderNodeObject<Node>;
}
```

- [ ] **Step 4: Create `transfer.ts`**

```ts
import type { ShaderNodeObject } from 'three/tsl';
import { mix, pow, step } from 'three/tsl';
import type { Node } from 'three/webgpu';

import type { TSLNode } from '../color-ramp/color-ramp.js';

/**
 * sRGB-encoded channel in [0,1] -> linear-sRGB. Standard sRGB EOTF.
 * Mirrors three's `convertSRGBToLinear` (e.g. 0.5 -> 0.21404114).
 */
export function srgbChannelToLinear(channel: number): number {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

/** TSL: vec3 sRGB-encoded -> linear-sRGB (branchless via step/mix). */
export function srgbToLinear(srgb: TSLNode): ShaderNodeObject<Node> {
  // pow(srgb, 1) normalizes the TSLNode union into a chainable node (no-op).
  // Reuse the normalized `value` everywhere — calling `.add()` directly on the
  // raw TSLNode union fails typecheck (bare Node has no chain methods).
  const value = pow(srgb, 1);
  const lowSegment = value.div(12.92);
  const highSegment = pow(value.add(0.055).div(1.055), 2.4);
  return mix(lowSegment, highSegment, step(0.04045, value));
}

/** TSL: vec3 linear-sRGB -> sRGB-encoded (branchless via step/mix). Inverse OETF. */
export function linearToSrgb(linear: TSLNode): ShaderNodeObject<Node> {
  const value = pow(linear, 1);
  const lowSegment = value.mul(12.92);
  const highSegment = pow(value, 1 / 2.4).mul(1.055).sub(0.055);
  return mix(lowSegment, highSegment, step(0.0031308, value));
}
```

> Note: `pow(srgb, 1)` normalizes the `TSLNode` union input into a chainable `ShaderNodeObject<Node>` (mirrors how `color-ramp.ts` wraps its `t` input). It compiles to a no-op.

- [ ] **Step 5: Run the test, verify it passes**

Run: `pnpm --filter @lovo/matter test -- transfer`
Expected: PASS (4 tests).

- [ ] **Step 6: Typecheck and commit**

Run: `pnpm --filter @lovo/matter typecheck`
Expected: no errors.

```bash
git add packages/matter/src/primitives/color-space/types.ts \
        packages/matter/src/primitives/color-space/transfer.ts \
        packages/matter/src/primitives/color-space/transfer.test.ts
git commit -m "feat(matter): add ColorSpace type and sRGB transfer functions"
```

---

## Task 2: `shortestArcHue` + `linear` space

**Files:**
- Create: `packages/matter/src/primitives/color-space/hue.ts`
- Create: `packages/matter/src/primitives/color-space/linear.ts`

**Interfaces:**
- Consumes: `ColorSpaceImpl` (Task 1).
- Produces: `shortestArcHue(h1, h2, t, period): ShaderNodeObject<Node>`; `linearSpace: ColorSpaceImpl`.

- [ ] **Step 1: Create `hue.ts`**

```ts
import type { ShaderNodeObject } from 'three/tsl';
import { mod } from 'three/tsl';
import type { Node } from 'three/webgpu';

import type { TSLNode } from '../color-ramp/color-ramp.js';

/**
 * Interpolate a hue from `h1` to `h2` along the SHORTER arc (CSS Color 4 default).
 * `period` is the hue's full range (2π for radians, 1 for turns). The delta is
 * wrapped into [-period/2, period/2) so the lerp never travels the long way.
 */
export function shortestArcHue(
  h1: ShaderNodeObject<Node>,
  h2: ShaderNodeObject<Node>,
  t: TSLNode,
  period: number,
): ShaderNodeObject<Node> {
  const half = period / 2;
  const delta = mod(h2.sub(h1).add(half), period).sub(half);
  return h1.add(delta.mul(t));
}
```

- [ ] **Step 2: Create `linear.ts`**

```ts
import { mix, vec3 } from 'three/tsl';

import type { ColorSpaceImpl } from './types.js';

/** Identity space: interpolate raw linear-sRGB values with no conversion. */
export const linearSpace: ColorSpaceImpl = {
  fromLinear: (rgb) => vec3(rgb),
  toLinear: (coords) => vec3(coords),
  lerp: (a, b, t) => mix(a, b, t),
};
```

- [ ] **Step 3: Typecheck and commit**

Run: `pnpm --filter @lovo/matter typecheck`
Expected: no errors.

```bash
git add packages/matter/src/primitives/color-space/hue.ts \
        packages/matter/src/primitives/color-space/linear.ts
git commit -m "feat(matter): add shortest-arc hue helper and linear color space"
```

---

## Task 3: OKLab space

**Files:**
- Create: `packages/matter/src/primitives/color-space/oklab.ts`

**Interfaces:**
- Produces: `linearToOklab(rgb)`, `oklabToLinear(lab)` (package-internal), `oklabSpace: ColorSpaceImpl`.

- [ ] **Step 1: Create `oklab.ts`** (Björn Ottosson's transform; `cbrt` from three is sign-safe)

```ts
import type { ShaderNodeObject } from 'three/tsl';
import { cbrt, mix, vec3 } from 'three/tsl';
import type { Node } from 'three/webgpu';

import type { ColorSpaceImpl } from './types.js';

/** linear-sRGB -> OKLab (L, a, b). */
export function linearToOklab(rgb: ShaderNodeObject<Node>): ShaderNodeObject<Node> {
  const r = rgb.r;
  const g = rgb.g;
  const b = rgb.b;

  const longCone = r.mul(0.4122214708).add(g.mul(0.5363325363)).add(b.mul(0.0514459929));
  const mediumCone = r.mul(0.2119034982).add(g.mul(0.6806995451)).add(b.mul(0.1073969566));
  const shortCone = r.mul(0.0883024619).add(g.mul(0.2817188376)).add(b.mul(0.6299787005));

  const longRoot = cbrt(longCone);
  const mediumRoot = cbrt(mediumCone);
  const shortRoot = cbrt(shortCone);

  const lightness = longRoot.mul(0.2104542553).add(mediumRoot.mul(0.793617785)).sub(shortRoot.mul(0.0040720468));
  const greenRed = longRoot.mul(1.9779984951).sub(mediumRoot.mul(2.428592205)).add(shortRoot.mul(0.4505937099));
  const blueYellow = longRoot.mul(0.0259040371).add(mediumRoot.mul(0.7827717662)).sub(shortRoot.mul(0.808675766));

  return vec3(lightness, greenRed, blueYellow);
}

/** OKLab (L, a, b) -> linear-sRGB. */
export function oklabToLinear(lab: ShaderNodeObject<Node>): ShaderNodeObject<Node> {
  const lightness = lab.x;
  const greenRed = lab.y;
  const blueYellow = lab.z;

  const longRoot = lightness.add(greenRed.mul(0.3963377774)).add(blueYellow.mul(0.2158037573));
  const mediumRoot = lightness.sub(greenRed.mul(0.1055613458)).sub(blueYellow.mul(0.0638541728));
  const shortRoot = lightness.sub(greenRed.mul(0.0894841775)).sub(blueYellow.mul(1.291485548));

  const longCone = longRoot.mul(longRoot).mul(longRoot);
  const mediumCone = mediumRoot.mul(mediumRoot).mul(mediumRoot);
  const shortCone = shortRoot.mul(shortRoot).mul(shortRoot);

  const r = longCone.mul(4.0767416621).sub(mediumCone.mul(3.3077115913)).add(shortCone.mul(0.2309699292));
  const g = longCone.mul(-1.2684380046).add(mediumCone.mul(2.6097574011)).sub(shortCone.mul(0.3413193965));
  const b = longCone.mul(-0.0041960863).sub(mediumCone.mul(0.7034186147)).add(shortCone.mul(1.707614701));

  return vec3(r, g, b);
}

export const oklabSpace: ColorSpaceImpl = {
  fromLinear: linearToOklab,
  toLinear: oklabToLinear,
  lerp: (a, b, t) => mix(a, b, t),
};
```

- [ ] **Step 2: Typecheck and commit**

Run: `pnpm --filter @lovo/matter typecheck`
Expected: no errors.

```bash
git add packages/matter/src/primitives/color-space/oklab.ts
git commit -m "feat(matter): add OKLab color space conversion"
```

---

## Task 4: OKLch space

**Files:**
- Create: `packages/matter/src/primitives/color-space/oklch.ts`

**Interfaces:**
- Consumes: `linearToOklab` / `oklabToLinear` (Task 3); `shortestArcHue` (Task 2).
- Produces: `oklchSpace: ColorSpaceImpl` (channels `L`, `C`, `h`; `h` in radians).

- [ ] **Step 1: Create `oklch.ts`**

```ts
import type { ShaderNodeObject } from 'three/tsl';
import { atan2, cos, length, mix, sin, vec2, vec3 } from 'three/tsl';
import type { Node } from 'three/webgpu';

import { linearToOklab, oklabToLinear } from './oklab.js';
import { shortestArcHue } from './hue.js';
import type { ColorSpaceImpl } from './types.js';

const TWO_PI = Math.PI * 2;

/** linear-sRGB -> OKLch (L, C, h). h in radians [-π, π]. */
function linearToOklch(rgb: ShaderNodeObject<Node>): ShaderNodeObject<Node> {
  const lab = linearToOklab(rgb);
  const lightness = lab.x;
  const greenRed = lab.y;
  const blueYellow = lab.z;

  const chroma = length(vec2(greenRed, blueYellow));
  const hue = atan2(blueYellow, greenRed);

  return vec3(lightness, chroma, hue);
}

/** OKLch (L, C, h) -> linear-sRGB. */
function oklchToLinear(lch: ShaderNodeObject<Node>): ShaderNodeObject<Node> {
  const lightness = lch.x;
  const chroma = lch.y;
  const hue = lch.z;

  const greenRed = chroma.mul(cos(hue));
  const blueYellow = chroma.mul(sin(hue));

  return oklabToLinear(vec3(lightness, greenRed, blueYellow));
}

export const oklchSpace: ColorSpaceImpl = {
  fromLinear: linearToOklch,
  toLinear: oklchToLinear,
  lerp: (a, b, t) =>
    vec3(mix(a.x, b.x, t), mix(a.y, b.y, t), shortestArcHue(a.z, b.z, t, TWO_PI)),
};
```

- [ ] **Step 2: Typecheck and commit**

Run: `pnpm --filter @lovo/matter typecheck`
Expected: no errors.

```bash
git add packages/matter/src/primitives/color-space/oklch.ts
git commit -m "feat(matter): add OKLch color space conversion"
```

---

## Task 5: CIELAB LCH space

**Files:**
- Create: `packages/matter/src/primitives/color-space/lch.ts`

**Interfaces:**
- Consumes: `shortestArcHue` (Task 2).
- Produces: `lchSpace: ColorSpaceImpl` (channels `L`, `C`, `h`; `h` in radians). CIELAB via CIE XYZ (D65).

- [ ] **Step 1: Create `lch.ts`**

```ts
import type { ShaderNodeObject } from 'three/tsl';
import { atan2, cbrt, cos, length, mix, sin, step, vec2, vec3 } from 'three/tsl';
import type { Node } from 'three/webgpu';

import { shortestArcHue } from './hue.js';
import type { ColorSpaceImpl } from './types.js';

const TWO_PI = Math.PI * 2;

// D65 reference white (CIE 1931 2°).
const WHITE_X = 0.95047;
const WHITE_Y = 1.0;
const WHITE_Z = 1.08883;

// CIELAB nonlinearity constants.
const EPSILON = 216 / 24389; // ~0.008856
const KAPPA = 24389 / 27; // ~903.3

/** CIELAB forward nonlinearity f(t), branchless via step/mix. */
function labForward(ratio: ShaderNodeObject<Node>): ShaderNodeObject<Node> {
  const linearPart = ratio.mul(KAPPA).add(16).div(116);
  const cubeRootPart = cbrt(ratio);
  return mix(linearPart, cubeRootPart, step(EPSILON, ratio));
}

/** CIELAB inverse nonlinearity, branchless via step/mix on f^3. */
function labInverse(f: ShaderNodeObject<Node>): ShaderNodeObject<Node> {
  const cubed = f.mul(f).mul(f);
  const linearPart = f.mul(116).sub(16).div(KAPPA);
  return mix(linearPart, cubed, step(EPSILON, cubed));
}

/** linear-sRGB -> CIELAB LCh (L, C, h). h in radians. */
function linearToLch(rgb: ShaderNodeObject<Node>): ShaderNodeObject<Node> {
  const r = rgb.r;
  const g = rgb.g;
  const b = rgb.b;

  // linear-sRGB -> CIE XYZ (D65).
  const x = r.mul(0.4123907993).add(g.mul(0.3575843394)).add(b.mul(0.1804807884));
  const y = r.mul(0.2126390059).add(g.mul(0.7151686788)).add(b.mul(0.0721923154));
  const z = r.mul(0.0193308187).add(g.mul(0.1191947798)).add(b.mul(0.9505321522));

  const fx = labForward(x.div(WHITE_X));
  const fy = labForward(y.div(WHITE_Y));
  const fz = labForward(z.div(WHITE_Z));

  const lightness = fy.mul(116).sub(16);
  const greenRed = fx.sub(fy).mul(500);
  const blueYellow = fy.sub(fz).mul(200);

  const chroma = length(vec2(greenRed, blueYellow));
  const hue = atan2(blueYellow, greenRed);

  return vec3(lightness, chroma, hue);
}

/** CIELAB LCh (L, C, h) -> linear-sRGB. */
function lchToLinear(lch: ShaderNodeObject<Node>): ShaderNodeObject<Node> {
  const lightness = lch.x;
  const chroma = lch.y;
  const hue = lch.z;

  const greenRed = chroma.mul(cos(hue));
  const blueYellow = chroma.mul(sin(hue));

  const fy = lightness.add(16).div(116);
  const fx = fy.add(greenRed.div(500));
  const fz = fy.sub(blueYellow.div(200));

  const x = labInverse(fx).mul(WHITE_X);
  const y = labInverse(fy).mul(WHITE_Y);
  const z = labInverse(fz).mul(WHITE_Z);

  // CIE XYZ (D65) -> linear-sRGB.
  const r = x.mul(3.2409699419).sub(y.mul(1.5373831776)).sub(z.mul(0.4986107603));
  const g = x.mul(-0.9692436363).add(y.mul(0.8759675015)).add(z.mul(0.0415550574));
  const b = x.mul(0.0556300797).sub(y.mul(0.2039769589)).add(z.mul(1.0569715142));

  return vec3(r, g, b);
}

export const lchSpace: ColorSpaceImpl = {
  fromLinear: linearToLch,
  toLinear: lchToLinear,
  lerp: (a, b, t) =>
    vec3(mix(a.x, b.x, t), mix(a.y, b.y, t), shortestArcHue(a.z, b.z, t, TWO_PI)),
};
```

- [ ] **Step 2: Typecheck and commit**

Run: `pnpm --filter @lovo/matter typecheck`
Expected: no errors.

```bash
git add packages/matter/src/primitives/color-space/lch.ts
git commit -m "feat(matter): add CIELAB LCh color space conversion"
```

---

## Task 6: HSV space (co-write candidate — verify against probe)

**Files:**
- Create: `packages/matter/src/primitives/color-space/hsv.ts`

**Interfaces:**
- Consumes: `srgbToLinear` / `linearToSrgb` (Task 1); `shortestArcHue` (Task 2).
- Produces: `hsvSpace: ColorSpaceImpl` (channels `h`, `s`, `v`; `h` in turns [0,1)). Operates on **gamma sRGB**.

> HSV/HSL are defined on gamma-encoded sRGB, so we encode (`linearToSrgb`) before
> and decode (`srgbToLinear`) after. The branchless rgb↔hsv below is Sam Hocevar's
> standard formulation. **Verify carefully against the round-trip swatch in Task 10's
> probe** — swizzle-heavy branchless code is easy to mistranscribe.

- [ ] **Step 1: Create `hsv.ts`**

```ts
import type { ShaderNodeObject } from 'three/tsl';
import { abs, clamp, fract, max, min, mix, step, vec3, vec4 } from 'three/tsl';
import type { Node } from 'three/webgpu';

import { shortestArcHue } from './hue.js';
import { linearToSrgb, srgbToLinear } from './transfer.js';
import type { ColorSpaceImpl } from './types.js';

const EPSILON = 1e-10;

// Sam Hocevar's branchless RGB->HSV. Reference (GLSL):
//   vec4 K = vec4(0.0, -1.0/3.0, 2.0/3.0, -1.0);
//   vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
//   vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
//   float d = q.x - min(q.w, q.y);
//   return vec3(abs(q.z + (q.w - q.y)/(6.0*d + e)), d/(q.x + e), q.x);
function gammaRgbToHsv(c: ShaderNodeObject<Node>): ShaderNodeObject<Node> {
  const p = mix(vec4(c.b, c.g, -1 / 3, 2 / 3), vec4(c.g, c.b, 0, -1 / 3), step(c.b, c.g));
  const q = mix(vec4(p.x, p.y, p.w, c.r), vec4(c.r, p.y, p.z, p.x), step(p.x, c.r));
  const chroma = q.x.sub(min(q.w, q.y));
  const hue = abs(q.z.add(q.w.sub(q.y).div(chroma.mul(6).add(EPSILON))));
  const saturation = chroma.div(q.x.add(EPSILON));
  return vec3(hue, saturation, q.x);
}

// Hocevar's branchless HSV->RGB. Reference (GLSL):
//   vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
//   vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
//   return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
function hsvToGammaRgb(hsv: ShaderNodeObject<Node>): ShaderNodeObject<Node> {
  const hue = hsv.x;
  const saturation = hsv.y;
  const value = hsv.z;
  const p = abs(fract(vec3(hue).add(vec3(1, 2 / 3, 1 / 3))).mul(6).sub(vec3(3)));
  return mix(vec3(1), clamp(p.sub(vec3(1)), 0, 1), saturation).mul(value);
}

export const hsvSpace: ColorSpaceImpl = {
  fromLinear: (rgb) => gammaRgbToHsv(linearToSrgb(rgb)),
  toLinear: (hsv) => srgbToLinear(hsvToGammaRgb(hsv)),
  lerp: (a, b, t) =>
    vec3(shortestArcHue(a.x, b.x, t, 1), mix(a.y, b.y, t), mix(a.z, b.z, t)),
};
```

> `max` is imported for parity with the HSL task; remove if your linter flags it as unused here.

- [ ] **Step 2: Typecheck and commit**

Run: `pnpm --filter @lovo/matter typecheck`
Expected: no errors. (Remove any genuinely-unused import the linter flags.)

```bash
git add packages/matter/src/primitives/color-space/hsv.ts
git commit -m "feat(matter): add HSV color space conversion"
```

---

## Task 7: HSL space (co-write candidate — verify against probe)

**Files:**
- Create: `packages/matter/src/primitives/color-space/hsl.ts`

**Interfaces:**
- Consumes: `srgbToLinear` / `linearToSrgb` (Task 1); `shortestArcHue` (Task 2).
- Produces: `hslSpace: ColorSpaceImpl` (channels `h`, `s`, `l`; `h` in turns [0,1)). Operates on **gamma sRGB**.

> HSL shares its hue with HSV; saturation/lightness differ. Hue is computed with the
> same Hocevar selection; `s`/`l` use the standard HSL formulas. Inverse derives RGB
> from hue via the same `abs(fract(...)*6 - 3)` ramp, then applies chroma/lightness.
> **Verify against the round-trip swatch in Task 10's probe.**

- [ ] **Step 1: Create `hsl.ts`**

```ts
import type { ShaderNodeObject } from 'three/tsl';
import { abs, clamp, fract, max, min, mix, step, vec3, vec4 } from 'three/tsl';
import type { Node } from 'three/webgpu';

import { shortestArcHue } from './hue.js';
import { linearToSrgb, srgbToLinear } from './transfer.js';
import type { ColorSpaceImpl } from './types.js';

const EPSILON = 1e-10;

/** Hocevar branchless hue (turns [0,1)) from gamma RGB — shared with HSV. */
function gammaRgbHue(c: ShaderNodeObject<Node>): ShaderNodeObject<Node> {
  const p = mix(vec4(c.b, c.g, -1 / 3, 2 / 3), vec4(c.g, c.b, 0, -1 / 3), step(c.b, c.g));
  const q = mix(vec4(p.x, p.y, p.w, c.r), vec4(c.r, p.y, p.z, p.x), step(p.x, c.r));
  const chroma = q.x.sub(min(q.w, q.y));
  return abs(q.z.add(q.w.sub(q.y).div(chroma.mul(6).add(EPSILON))));
}

/** gamma sRGB -> HSL (h, s, l). */
function gammaRgbToHsl(c: ShaderNodeObject<Node>): ShaderNodeObject<Node> {
  const maxChannel = max(c.r, max(c.g, c.b));
  const minChannel = min(c.r, min(c.g, c.b));
  const lightness = maxChannel.add(minChannel).mul(0.5);
  const chroma = maxChannel.sub(minChannel);
  // s = chroma / (1 - |2L - 1|)
  const saturation = chroma.div(lightness.mul(2).sub(1).abs().oneMinus().add(EPSILON));
  return vec3(gammaRgbHue(c), saturation, lightness);
}

/** HSL (h, s, l) -> gamma sRGB. */
function hslToGammaRgb(hsl: ShaderNodeObject<Node>): ShaderNodeObject<Node> {
  const hue = hsl.x;
  const saturation = hsl.y;
  const lightness = hsl.z;

  const chroma = lightness.mul(2).sub(1).abs().oneMinus().mul(saturation);
  // Hue ramp: per-channel triangle wave, same basis as Hocevar's hsv2rgb.
  const ramp = abs(fract(vec3(hue).add(vec3(1, 2 / 3, 1 / 3))).mul(6).sub(vec3(3)));
  const rgbUnit = clamp(ramp.sub(vec3(1)), 0, 1); // hue -> [0,1] per channel at full chroma
  return rgbUnit.sub(0.5).mul(chroma).add(lightness);
}

export const hslSpace: ColorSpaceImpl = {
  fromLinear: (rgb) => gammaRgbToHsl(linearToSrgb(rgb)),
  toLinear: (hsl) => srgbToLinear(hslToGammaRgb(hsl)),
  lerp: (a, b, t) =>
    vec3(shortestArcHue(a.x, b.x, t, 1), mix(a.y, b.y, t), mix(a.z, b.z, t)),
};
```

- [ ] **Step 2: Typecheck and commit**

Run: `pnpm --filter @lovo/matter typecheck`
Expected: no errors.

```bash
git add packages/matter/src/primitives/color-space/hsl.ts
git commit -m "feat(matter): add HSL color space conversion"
```

---

## Task 8: Registry + `mixColor` + public exports

**Files:**
- Create: `packages/matter/src/primitives/color-space/registry.ts`
- Create: `packages/matter/src/primitives/color-space/mix-color.ts`
- Create: `packages/matter/src/primitives/color-space/index.ts`
- Create: `packages/matter/src/primitives/color-space/mix-color.test.ts`
- Modify: `packages/matter/src/index.ts`

**Interfaces:**
- Consumes: every `*Space` impl (Tasks 2–7).
- Produces: `colorSpaces: Record<ColorSpace, ColorSpaceImpl>`; `mixColor(colorA, colorB, t, colorSpace = 'oklab'): ShaderNodeObject<Node>`. Public exports: `mixColor`, `ColorSpace`.

- [ ] **Step 1: Write the failing test** — `mix-color.test.ts`

```ts
import { uv, vec3 } from 'three/tsl';
import { describe, expect, it } from 'vitest';

import type { ColorSpace } from './types.js';
import { mixColor } from './mix-color.js';

const SPACES: ColorSpace[] = ['linear', 'oklab', 'oklch', 'lch', 'hsl', 'hsv'];

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
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `pnpm --filter @lovo/matter test -- mix-color`
Expected: FAIL — `Cannot find module './mix-color.js'`.

- [ ] **Step 3: Create `registry.ts`**

```ts
import { hslSpace } from './hsl.js';
import { hsvSpace } from './hsv.js';
import { lchSpace } from './lch.js';
import { linearSpace } from './linear.js';
import { oklabSpace } from './oklab.js';
import { oklchSpace } from './oklch.js';
import type { ColorSpace, ColorSpaceImpl } from './types.js';

/** Maps each ColorSpace to its TSL implementation. */
export const colorSpaces: Record<ColorSpace, ColorSpaceImpl> = {
  linear: linearSpace,
  oklab: oklabSpace,
  oklch: oklchSpace,
  lch: lchSpace,
  hsl: hslSpace,
  hsv: hsvSpace,
};
```

- [ ] **Step 4: Create `mix-color.ts`**

```ts
import type { ShaderNodeObject } from 'three/tsl';
import { clamp, vec3 } from 'three/tsl';
import type { Node } from 'three/webgpu';

import type { TSLNode } from '../color-ramp/color-ramp.js';
import { colorSpaces } from './registry.js';
import type { ColorSpace } from './types.js';

/**
 * Blend two linear-sRGB colors in `colorSpace`: convert both endpoints into the
 * space, interpolate (shortest-arc hue for cylindrical spaces), convert back to
 * linear-sRGB. Result is clamped to [0,1] (out-of-gamut colors are clipped).
 */
export function mixColor(
  colorA: TSLNode,
  colorB: TSLNode,
  t: TSLNode,
  colorSpace: ColorSpace = 'oklab',
): ShaderNodeObject<Node> {
  const space = colorSpaces[colorSpace];
  const a = space.fromLinear(vec3(colorA));
  const b = space.fromLinear(vec3(colorB));
  return clamp(space.toLinear(space.lerp(a, b, t)), 0, 1);
}
```

- [ ] **Step 5: Create `index.ts`**

```ts
export { mixColor } from './mix-color.js';
export type { ColorSpace } from './types.js';
```

- [ ] **Step 6: Add exports to `packages/matter/src/index.ts`**

Add after the existing `colorRamp` export block:

```ts
export { mixColor } from './primitives/color-space/index.js';
export type { ColorSpace } from './primitives/color-space/index.js';
```

- [ ] **Step 7: Run the test, verify it passes**

Run: `pnpm --filter @lovo/matter test -- mix-color`
Expected: PASS (2 tests).

- [ ] **Step 8: Typecheck, build, commit**

Run: `pnpm --filter @lovo/matter typecheck && pnpm --filter @lovo/matter build`
Expected: no errors; build succeeds.

```bash
git add packages/matter/src/primitives/color-space/registry.ts \
        packages/matter/src/primitives/color-space/mix-color.ts \
        packages/matter/src/primitives/color-space/index.ts \
        packages/matter/src/primitives/color-space/mix-color.test.ts \
        packages/matter/src/index.ts
git commit -m "feat(matter): add mixColor primitive and color-space registry"
```

---

## Task 9: `colorSpace` parameter on `colorRamp` (behavior-preserving)

**Files:**
- Modify: `packages/matter/src/primitives/color-ramp/color-ramp.ts`
- Create: `packages/matter/src/primitives/color-ramp/color-ramp.test.ts`

**Interfaces:**
- Consumes: `colorSpaces` registry (Task 8); `ColorSpace` type.
- Produces: `colorRamp(t, stops, colorSpace: ColorSpace = 'linear')`. Default `'linear'` preserves today's behavior exactly (plain mix, no conversion).

- [ ] **Step 1: Write the failing test** — `color-ramp.test.ts`

```ts
import { uv, vec3 } from 'three/tsl';
import { describe, expect, it } from 'vitest';

import { colorRamp } from './color-ramp.js';

const stops = [
  { color: vec3(1, 0, 0), position: 0 },
  { color: vec3(0, 0, 1), position: 1 },
];

describe('colorRamp colorSpace', () => {
  it('builds with the default (linear) space', () => {
    expect(colorRamp(uv().x, stops)).toBeDefined();
  });

  it('builds for oklab and oklch', () => {
    expect(colorRamp(uv().x, stops, 'oklab')).toBeDefined();
    expect(colorRamp(uv().x, stops, 'oklch')).toBeDefined();
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `pnpm --filter @lovo/matter test -- color-ramp`
Expected: FAIL — `colorRamp` rejects a third argument / `'oklab'` not assignable.

- [ ] **Step 3: Modify `colorRamp`** — interpolate in-space, convert back once

Replace the body of `colorRamp` in `color-ramp.ts`. New signature and implementation:

```ts
import type { ShaderNodeObject } from 'three/tsl';
import { vec3 } from 'three/tsl';
import type { Node } from 'three/webgpu';

import { colorSpaces } from '../color-space/registry.js';
import type { ColorSpace } from '../color-space/types.js';

// ... existing TSLNode / ColorRampStop definitions stay unchanged ...

export function colorRamp(
  t: TSLNode,
  stops: ColorRampStop[],
  colorSpace: ColorSpace = 'linear',
): ShaderNodeObject<Node> {
  const space = colorSpaces[colorSpace];
  const first = stops[0];

  if (first === undefined) return vec3(0, 0, 0);

  // Convert each stop into the interpolation space up front, then run the
  // nested-mix chain IN that space, and convert the result back to linear once.
  const firstCoords = space.fromLinear(vec3(first.color));

  if (stops.length === 1) return space.toLinear(firstCoords);

  let resultCoords = firstCoords;

  for (let index = 1; index < stops.length; index += 1) {
    const previousStop = stops[index - 1];
    const nextStop = stops[index];

    if (previousStop === undefined || nextStop === undefined) continue;
    const positionSpan = nextStop.position - previousStop.position;

    if (positionSpan <= 0) continue;
    const localT = clamp(div(sub(t, previousStop.position), positionSpan), 0, 1);

    const nextCoords = space.fromLinear(vec3(nextStop.color));
    resultCoords = space.lerp(resultCoords, nextCoords, localT);
  }

  return space.toLinear(resultCoords);
}
```

> Keep the existing `clamp`, `div`, `sub` imports. The nested chain still collapses
> to clean pairwise interpolation between adjacent stops (the running result equals
> the previous stop exactly at each segment boundary), which holds in cylindrical
> spaces too — so per-segment shortest-arc hue is correct.

- [ ] **Step 4: Run the test, verify it passes**

Run: `pnpm --filter @lovo/matter test -- color-ramp`
Expected: PASS.

- [ ] **Step 5: Verify the full engine suite + typecheck + build**

Run: `pnpm --filter @lovo/matter test && pnpm --filter @lovo/matter typecheck && pnpm --filter @lovo/matter build`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add packages/matter/src/primitives/color-ramp/color-ramp.ts \
        packages/matter/src/primitives/color-ramp/color-ramp.test.ts
git commit -m "feat(matter): add colorSpace parameter to colorRamp (default linear)"
```

---

## Task 10: Color-space probe page

**Files:**
- Create: `apps/docs/src/app/dev/color-space-probe/page.tsx`

**Interfaces:**
- Consumes: `mixColor`, `ColorSpace` (`@lovo/matter`); `ShaderScene` (`@lovo/matter-react`).
- Produces: a dev route at `/dev/color-space-probe` rendering, for each space, two adjacent swatches — a reference color and its `toLinear(fromLinear(reference))` round-trip — plus one `mixColor(red, blue, 0.5)` swatch per space. Each swatch is a labelled, data-attributed region for Playwright to sample.

> The probe builds material colorNodes directly with **explicit linear-sRGB values**
> (it does NOT use `parseHex`, which is unchanged in this plan). Round-trip swatches
> let Playwright assert `roundTrip ≈ reference` per space WITHOUT needing absolute
> reference values — a strong, self-contained correctness check that catches any
> forward/inverse mismatch.

- [ ] **Step 1: Create the probe page**

```tsx
'use client';

import dynamic from 'next/dynamic';

import type { ColorSpace } from '@lovo/matter';
import { mixColor } from '@lovo/matter';
import { useShaderContext } from '@lovo/matter-react';
import { useEffect } from 'react';
import { mix, uv, vec3, vec4 } from 'three/tsl';
import { Mesh, MeshBasicNodeMaterial, PlaneGeometry } from 'three/webgpu';

import { colorSpaces } from '../../../../../../packages/matter/src/primitives/color-space/registry';

const ShaderScene = dynamic(() => import('@lovo/matter-react').then((m) => m.ShaderScene), {
  ssr: false,
});

const SPACES: ColorSpace[] = ['linear', 'oklab', 'oklch', 'lch', 'hsl', 'hsv'];

// Reference linear-sRGB colors to round-trip (in-gamut, varied hue/chroma/lightness).
const REFERENCES: [number, number, number][] = [
  [0.6, 0.2, 0.4],
  [0.1, 0.5, 0.7],
  [0.8, 0.7, 0.1],
];

function ProbeSwatch({ index, build }: { index: number; build: () => ReturnType<typeof vec3> }) {
  const shaderContext = useShaderContext();

  useEffect(() => {
    if (!shaderContext) return;
    const material = new MeshBasicNodeMaterial();
    material.colorNode = vec4(build(), 1);
    const mesh = new Mesh(new PlaneGeometry(2, 2), material);
    shaderContext.scene.add(mesh);
    return () => {
      shaderContext.scene.remove(mesh);
      try {
        material.dispose();
      } catch {
        // three/webgpu can throw during Strict Mode double-invoke dispose.
      }
      mesh.geometry.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shaderContext, index]);

  return null;
}

export default function ColorSpaceProbePage() {
  // Build one row per space: [reference, roundTrip] for each REFERENCE color,
  // plus a mixColor(red, blue, 0.5) cell. Each cell is its own ShaderScene so a
  // Playwright locator can sample a known canvas per (space, kind, refIndex).
  return (
    <main style={{ display: 'grid', gap: 0 }}>
      {SPACES.map((space) => (
        <div key={space} data-space={space} style={{ display: 'flex' }}>
          {REFERENCES.map((reference, refIndex) => {
            const space_ = colorSpaces[space];
            return (
              <div key={`ref-${refIndex}`} style={{ display: 'flex' }}>
                <div
                  data-cell={`${space}-reference-${refIndex}`}
                  style={{ width: 80, height: 80 }}
                >
                  <ShaderScene>
                    <ProbeSwatch index={refIndex} build={() => vec3(...reference)} />
                  </ShaderScene>
                </div>
                <div
                  data-cell={`${space}-roundtrip-${refIndex}`}
                  style={{ width: 80, height: 80 }}
                >
                  <ShaderScene>
                    <ProbeSwatch
                      index={refIndex}
                      build={() => space_.toLinear(space_.fromLinear(vec3(...reference)))}
                    />
                  </ShaderScene>
                </div>
              </div>
            );
          })}
          <div data-cell={`${space}-mid`} style={{ width: 80, height: 80 }}>
            <ShaderScene>
              <ProbeSwatch index={99} build={() => mixColor(vec3(1, 0, 0), vec3(0, 0, 1), uv().x.mul(0).add(0.5), space)} />
            </ShaderScene>
          </div>
        </div>
      ))}
    </main>
  );
}
```

> The deep relative import of `registry` is intentional and dev-only — the probe needs
> the per-space impls, which are not part of the public barrel. If the docs app's
> `transpilePackages`/path config rejects it, instead temporarily export `colorSpaces`
> from `@lovo/matter`'s `index.ts` for the duration of this plan and import it from the
> package; remove that export before Plan 1 ships if it was added only for the probe.

- [ ] **Step 2: Manually verify in dev mode**

Run: `pnpm --filter @matter/docs dev`
Open: `http://localhost:3000/dev/color-space-probe`
Expected: for every space, each `reference` swatch and its neighboring `roundtrip` swatch look identical; the `mid` swatch shows a red→blue midpoint (purple-ish; for `oklab`/`oklch` noticeably more vivid than a muddy gray).

- [ ] **Step 3: Commit**

```bash
git add apps/docs/src/app/dev/color-space-probe/page.tsx
git commit -m "test(docs): add color-space probe page for conversion verification"
```

---

## Task 11: Playwright pixel-readback test (the validation gate)

**Files:**
- Create: `apps/docs-tests/visual/color-space.spec.ts`

**Interfaces:**
- Consumes: the probe page (Task 10), `data-cell` attributes.

- [ ] **Step 1: Inspect an existing spec for the wait helper**

Read: `apps/docs-tests/visual/helpers.ts` (for `waitForShader`) and `apps/docs-tests/visual/linear-gradient.spec.ts` for the canvas-locator pattern.

- [ ] **Step 2: Write the test**

```ts
import { expect, test } from '@playwright/test';

import { waitForShader } from './helpers';

const SPACES = ['linear', 'oklab', 'oklch', 'lch', 'hsl', 'hsv'] as const;
const REFERENCE_COUNT = 3;

// Average a small region of a cell's canvas and return [r,g,b] in 0..255.
async function sampleCell(page: import('@playwright/test').Page, cell: string) {
  const canvas = page.locator(`[data-cell="${cell}"] canvas`).first();
  const box = await canvas.boundingBox();
  if (!box) throw new Error(`no canvas for cell ${cell}`);
  const shot = await canvas.screenshot();
  // Decode center pixel via the browser.
  return page.evaluate(
    async ({ bytes }) => {
      const blob = new Blob([new Uint8Array(bytes)], { type: 'image/png' });
      const bitmap = await createImageBitmap(blob);
      const c = document.createElement('canvas');
      c.width = bitmap.width;
      c.height = bitmap.height;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(bitmap, 0, 0);
      const cx = Math.floor(bitmap.width / 2);
      const cy = Math.floor(bitmap.height / 2);
      const d = ctx.getImageData(cx, cy, 1, 1).data;
      return [d[0], d[1], d[2]] as [number, number, number];
    },
    { bytes: [...shot] },
  );
}

test('color-space conversions round-trip to the reference within tolerance', async ({ page }) => {
  await page.goto('/dev/color-space-probe');
  await waitForShader(page);

  for (const space of SPACES) {
    for (let refIndex = 0; refIndex < REFERENCE_COUNT; refIndex += 1) {
      const reference = await sampleCell(page, `${space}-reference-${refIndex}`);
      const roundTrip = await sampleCell(page, `${space}-roundtrip-${refIndex}`);
      for (let channel = 0; channel < 3; channel += 1) {
        expect(
          Math.abs(reference[channel] - roundTrip[channel]),
          `${space} ref#${refIndex} channel ${channel}`,
        ).toBeLessThanOrEqual(3);
      }
    }
  }
});

test('oklab red->blue midpoint is more saturated than a naive gray', async ({ page }) => {
  await page.goto('/dev/color-space-probe');
  await waitForShader(page);
  const [r, g, b] = await sampleCell(page, 'oklab-mid');
  // A perceptual midpoint of red/blue keeps chroma: green channel stays low,
  // red and blue are both clearly present. Guards against a muddy/desaturated mix.
  expect(g).toBeLessThan(Math.min(r, b));
});
```

- [ ] **Step 3: Run the test**

Run: `pnpm --filter @matter/docs build && pnpm --filter @matter/docs preview &` then `pnpm --filter @matter/docs-tests exec playwright test color-space`
(Or rely on the configured `webServer` per `apps/docs-tests/playwright.config.ts`: `pnpm --filter @matter/docs-tests exec playwright test color-space`.)
Expected: PASS. If a space's round-trip fails, fix that space's conversion (likely a mistranscribed constant/swizzle — most likely HSL/HSV from Tasks 6–7) and re-run.

- [ ] **Step 4: Commit**

```bash
git add apps/docs-tests/visual/color-space.spec.ts
git commit -m "test(docs-tests): verify color-space conversions via pixel readback"
```

---

## Validation Gate (end of Plan 1)

Stop here and hand back to the user for a phase gate (shader phase gates are non-negotiable):

1. Show the diff summary and explain the TSL concepts introduced (color-space conversion, why we encode for HSL/HSV, shortest-arc hue, gamut clip).
2. Have the user run `pnpm --filter @matter/docs dev` and open `/dev/color-space-probe` to eyeball every space's round-trip and the `mixColor` midpoints.
3. Confirm `pnpm --filter @lovo/matter test`, `typecheck`, `build`, and the Playwright `color-space` spec all pass.
4. Confirm no shipped component changed appearance (no baseline regeneration in this plan).

On approval, proceed to Plan 2 (foundation fix `parseHex`→linear + LinearGradient `colorSpace` slice).

---

## Self-Review

**Spec coverage (Phase 1 only):**
- ColorSpace type + six spaces — Tasks 1–7. ✅
- `mixColor` primitive (convert→lerp→convert-back, shortest-arc hue, gamut clip) — Task 8. ✅
- `colorRamp` `colorSpace` param (in-space chain, convert-back once) — Task 9. ✅
- HSL/HSV operate on gamma sRGB — Tasks 6–7 encode/decode. ✅
- Shortest-arc hue for cylindrical spaces — Task 2 helper, used in Tasks 4/5/6/7. ✅
- Gamut clip to [0,1] — Task 8 (`mixColor`); `colorRamp` returns `space.toLinear(...)` — NOTE: `colorRamp` does not clamp. Acceptable for Phase 1 (its default `linear` space cannot exceed gamut for in-[0,1] stops; oklch/lch via colorRamp arrive in Plan 2 with the component layer). If a Plan-2 reviewer wants parity, add `clamp(..., 0, 1)` around `colorRamp`'s return then.
- Probe page + Playwright correctness (round-trip identity + oklab midpoint) — Tasks 10–11. ✅
- Public exports `mixColor` + `ColorSpace` only; conversions internal — Task 8 (`index.ts` exports only those two). ✅
- No `parseHex`/component change — enforced by scope note; no task touches them. ✅
- `colorRamp` default `'linear'` (intentional spec deviation) — documented in Global Constraints + Task 9. ✅

**Placeholder scan:** No TBD/TODO/"add error handling". HSL/HSV bodies are complete with reference comments. ✅

**Type consistency:** `ColorSpaceImpl` (`fromLinear`/`toLinear`/`lerp`) used identically across Tasks 2–9. `mixColor` signature `(colorA, colorB, t, colorSpace='oklab')` matches its test and the probe usage. `colorRamp(t, stops, colorSpace='linear')` matches its test. `shortestArcHue(h1,h2,t,period)` matches all four call sites. ✅

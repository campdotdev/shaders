# Wide-gamut (Display P3) support — design

**Date:** 2026-06-18
**Branch:** `hunter/mat-36-add-wide-gamut-p3-etc-support`
**Status:** Approved design, pending implementation plan

## Goal

Render Matter scenes in the widest color gamut the display supports, defaulting to Display P3 where available and falling back to sRGB automatically. Let users author colors that live outside sRGB (via OKLCH/OKLab) and have them rendered faithfully on P3 displays while degrading gracefully on sRGB ones.

HDR (brightness beyond white, via float framebuffers + Extended sRGB) is explicitly **out of scope** for this feature — it requires HalfFloat render targets, tone-mapping decisions, and reworking the overlay/postprocessing pipeline. It is a separate, larger feature.

## Background: why this works now

The color pipeline already has the right foundation as of the "true-color" work:

- `parseHex` (`registry/utils/color.ts`) decodes hex → **linear-sRGB** working space via `srgbChannelToLinear` (the earlier double-encode bug is fixed).
- Mixing happens in a chosen perceptual space (`mixColor` / `colorRamp`, default `oklab` on components); the result is converted back to linear-sRGB.
- Three's renderer takes linear-sRGB working space and, on output, encodes it to whatever `renderer.outputColorSpace` specifies (default `SRGBColorSpace`).

So P3 support is three coordinated changes — an output path, removing a clamp, and widening input parsing — not a pipeline rewrite. Three's `ColorSpaces` module provides `DisplayP3ColorSpace` (and `LinearDisplayP3`, `ExtendedSRGB`, `LinearRec2020`); three is at `^0.170.0`.

### The counterintuitive part

A wider-gamut output canvas, by itself, buys nothing. sRGB hex colors re-encoded into a P3 container display *identically*. To see colors more saturated than sRGB can show, the values entering the output stage must *exceed* sRGB — either supplied directly (high-chroma OKLCH input) or produced by oklab/oklch mixing. Today both paths are flattened by an explicit clamp to `[0,1]`. Removing that clamp is the linchpin.

## Architecture

Three coordinated changes plus testing/docs.

### 1. Public API

`<ShaderScene>` gains one prop:

```tsx
gamut?: 'auto' | 'srgb' | 'p3'   // default 'auto'
```

- `'auto'` — query `matchMedia('(color-gamut: p3)')`; resolve to `p3` if supported, else `srgb`. Subscribe to the media query's `change` event so dragging the window between monitors updates live.
- `'srgb'` / `'p3'` — force the output gamut. Forcing `'srgb'` is also how the visual-regression suite stays deterministic.
- `'p3'` maps internally to three's `DisplayP3ColorSpace`; `'srgb'` to `SRGBColorSpace`.

`createRenderer(canvas, { maxDPR })` grows a resolved `gamut: 'srgb' | 'p3'` param. Detection lives in the React layer; the engine receives a concrete answer and stays framework-agnostic. It sets `renderer.outputColorSpace` accordingly.

No change to component-level props (`LinearGradient`, `MeshGradient`, `SimplexNoise`, etc.). Gamut is a scene-level **output** concern, orthogonal to the per-component `colorSpace` **mixing** prop. This preserves the existing orthogonality (mixing space vs output gamut).

### 2. Output path + detection

- **Engine** (`packages/matter/src/runtime/create-renderer/create-renderer.ts`): accept resolved `gamut`; set `renderer.outputColorSpace = gamut === 'p3' ? DisplayP3ColorSpace : SRGBColorSpace`. For WebGPU, the backend configures the `GPUCanvasContext` colorSpace from `outputColorSpace`; the WebGL fallback (forceWebGL) sets `gl.drawingBufferColorSpace`.
  - **Implementation checkpoint:** verify the WebGPU backend in three 0.170 actually reconfigures the `GPUCanvasContext` to `display-p3` from `outputColorSpace` alone. If it does not, configure the context explicitly (`context.configure({ ..., colorSpace: 'display-p3' })`).
- **React** (`packages/matter-react/src/components/shader-scene/shader-scene.tsx`): a `useDisplayGamut(gamut)` hook resolves `'auto'` → concrete value via `matchMedia`, subscribes to gamut changes, and feeds the result into renderer creation. On a gamut change it updates `renderer.outputColorSpace` and requests a re-render — no full renderer rebuild.

### 3. Unclamp the mix math

`mixColor` (`packages/matter/src/primitives/color-space/mix-color.ts`) currently ends with a clamp of the result to `[0,1]` in linear-sRGB. Remove the hard sRGB clamp so extended values survive. `colorRamp` inherits this because it composes `mixColor`.

Why this is safe (not a silent regression):

- On an **sRGB** output, the renderer's encode + framebuffer write clamps per-channel exactly as the explicit clamp did → identical pixels to today.
- On a **P3** output, a linear-sRGB channel like `1.15` now maps into valid P3 instead of being flattened to sRGB's edge.

We do **per-channel framebuffer clipping only** — no gamut-mapping/desaturation. That matches three's default behavior and keeps scope tight. Smarter gamut mapping (perceptual desaturation toward the gamut boundary) is a deliberate future item, not v1.

### 4. Wide-gamut color input

Generalize hex parsing into `parseColor(input: string): [number, number, number]` (returning extended linear-sRGB) that dispatches on syntax:

- `#rrggbb` → existing hex path, unchanged.
- `oklch(L C H)` / `oklch(L C H / alpha)` → OKLCH → linear-sRGB.
- `oklab(L a b)` → OKLab → linear-sRGB.

Notes:

- Conversions return **extended** linear-sRGB — channels may exceed `[0,1]` or go slightly negative for out-of-sRGB colors. The parser does **not** clamp; the unclamped mix math (§3) and the output stage handle range.
- Alpha in `oklch(... / a)` is parsed but dropped — components don't carry per-stop alpha today, and adding it is out of scope.
- The CPU-side OKLCH/OKLab → linear math mirrors the GPU TSL conversions already in `packages/matter/src/primitives/color-space/` — porting known math to JS, not inventing it.
- `parseHex` remains as a thin wrapper so existing callers don't break; component stop-parsing switches to `parseColor`.
- **Scope guard:** only `hex`, `oklch`, `oklab`. No `color(display-p3 …)`, no `rgb()` / `hsl()`.

### 5. Testing, docs, palette

- **Visual-regression determinism:** the Playwright suite (`apps/docs-tests/visual/`) pins scenes to `gamut="srgb"` so baselines are reproducible regardless of the CI or dev machine's display. Without pinning, a P3 dev Mac and an sRGB CI box produce different framebuffer bytes for identical-looking output.
- **P3 probe:** one focused test (or docs probe route) forcing `gamut="p3"` with a known out-of-sRGB OKLCH color, asserting the framebuffer carries values an sRGB encode could not produce. This proves the path actually widens, since most existing demos look identical under P3.
- **Docs demo:** a page (or section on the existing color/palette reference page) showing the same gradient under forced `srgb` vs `auto`, with Tweakpane controls — the "stop and feel it" surface. Visible difference on a P3 display; identical, graceful fallback on sRGB.
- **Palette:** `apps/docs/src/lib/palette.ts` already carries `paletteOklch`. No required change for v1; the demo can pull a high-chroma OKLCH accent to make the win obvious. Re-generating palette hex into P3 is **not** in scope.

## Phase breakdown

Each phase ends at a runnable, observable point ("stop and feel it" gate).

1. **Output path plumbing.** `gamut` param through `createRenderer` + `outputColorSpace`; `gamut` prop + `useDisplayGamut` detection in `ShaderScene`.
   - *Gate:* hardcode a forced `p3` scene with a known-vivid color, open on a P3 display, toggle `srgb` ↔ `p3` ↔ `auto`, feel the saturation pop and the fallback.
2. **Unclamp mix math.** Remove the sRGB clamp in `mixColor`.
   - *Gate:* a 2-stop OKLCH-mixed gradient between saturated stops shows richer midtones under `p3` vs `srgb`; confirm sRGB output is pixel-unchanged against existing baselines.
3. **Wide-gamut input.** `parseColor` with `oklch()` / `oklab()`.
   - *Gate:* pass a high-chroma `oklch(...)` directly to `LinearGradient`; vivid under P3, gracefully clipped under sRGB.
4. **Docs + visual regression.** Pin baselines to `srgb`, add the P3 probe test, add the docs demo.
   - *Gate:* docs page comparison renders; suite green.

## Non-goals

- HDR / brightness beyond white (Extended sRGB, HalfFloat framebuffers, tone mapping).
- `color(display-p3 …)`, `rgb()`, `hsl()` input syntaxes.
- Perceptual gamut mapping / desaturation (per-channel framebuffer clip only).
- Re-generating the docs palette hex values into P3.
- Per-stop alpha.
- Rec2020 or any gamut wider than Display P3.

## Open implementation checkpoints

- Confirm three 0.170 WebGPU backend configures the `GPUCanvasContext` colorSpace from `outputColorSpace`; if not, configure it explicitly.
- Confirm `matchMedia('(color-gamut: p3)')` `change` events fire on monitor switch in target browsers; if unreliable, fall back to re-querying on visibility/focus.

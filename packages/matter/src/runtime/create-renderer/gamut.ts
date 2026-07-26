// Wide-gamut (Display P3) output support. three 0.170 has no native WebGPU
// P3 path, so this file does two off-road things: registers the P3 color
// spaces from three's addon (below), and manually re-configures the
// GPUCanvasContext for 'display-p3' (applyCanvasGamut). A future three bump
// that configures the canvas color space itself should DELETE the manual
// reconfigure. "Gamut" = the range of colors a display can show; P3 is the
// wider range most modern screens have beyond sRGB.
import { ColorManagement, SRGBColorSpace } from 'three';
import {
  DisplayP3ColorSpace,
  DisplayP3ColorSpaceImpl,
  LinearDisplayP3ColorSpace,
  LinearDisplayP3ColorSpaceImpl,
} from 'three/examples/jsm/math/ColorSpaces.js';
import type { WebGPURenderer } from 'three/webgpu';

import type { OutputGamut } from '../../primitives/color-space/cpu-convert.js';
import type { GpuBackend } from './create-renderer.js';

/**
 * The output color gamut the renderer encodes its framebuffer for. Defined
 * alongside the CPU color conversions rather than here, so the gamut a color is
 * mapped into and the gamut the framebuffer is encoded for are the same type
 * rather than two identical unions that could drift apart.
 */
export type { OutputGamut };

// three 0.170 core registers only sRGB and linear-sRGB in ColorManagement. The
// Display P3 spaces ship as an addon that does NOT self-register, so we define
// them once here (idempotent) before any P3 output. This makes the renderer's
// linear-sRGB working space convert correctly into P3 on output.
ColorManagement.define({
  [DisplayP3ColorSpace]: DisplayP3ColorSpaceImpl,
  [LinearDisplayP3ColorSpace]: LinearDisplayP3ColorSpaceImpl,
});

/**
 * Map a resolved output gamut to the three color-space constant for
 * `renderer.outputColorSpace`. `'p3'` selects Display P3; `'srgb'` the default.
 */
export function gamutToColorSpace(gamut: OutputGamut): string {
  return gamut === 'p3' ? DisplayP3ColorSpace : SRGBColorSpace;
}

/**
 * Minimal structural view of the WebGPU backend internals we must reach into.
 * three's public `Backend` type surfaces neither `device` nor `context`, but the
 * WebGPU backend sets both at init (`this.device`, `this.context`).
 */
interface WebGpuBackendInternals {
  device: GPUDevice;
  context: GPUCanvasContext;
}

function hasWebGpuBackendInternals(backend: unknown): backend is WebGpuBackendInternals {
  if (typeof backend !== 'object' || backend === null) return false;
  if (!('device' in backend) || !('context' in backend)) return false;

  const { device, context } = backend;

  return (
    typeof device === 'object' &&
    device !== null &&
    typeof context === 'object' &&
    context !== null &&
    'configure' in context &&
    typeof context.configure === 'function'
  );
}

/**
 * Re-configure the WebGPU canvas context for the output gamut.
 *
 * Necessary because three 0.170's WebGPU backend configures the `GPUCanvasContext`
 * only at init, with no `colorSpace` field — so it defaults to sRGB and a P3
 * `outputColorSpace` would write P3-encoded pixels into an sRGB surface. We re-run
 * `configure()` once with `colorSpace: 'display-p3'`, mirroring three's other
 * config values. Critically, `alphaMode` must mirror three's choice: the WebGPU
 * backend defaults `alpha` to `true` and therefore configures the context as
 * `'premultiplied'` (transparent). Passing `'opaque'` here would override that and
 * paint the canvas opaque black until the first shader frame, producing a black
 * flash over whatever sits behind a transparent canvas. Usage matches the
 * backend's `RENDER_ATTACHMENT | COPY_SRC`. Resize never re-configures the
 * context, so this sticks for the renderer's lifetime.
 *
 * No-op for sRGB output, for the WebGL2 fallback (which stays sRGB in v1), and
 * where WebGPU is unavailable.
 */
export function applyCanvasGamut(
  renderer: WebGPURenderer,
  backend: GpuBackend,
  gamut: OutputGamut,
): void {
  if (gamut !== 'p3' || backend !== 'webgpu') return;

  // `navigator.gpu` is typed as always-present but is genuinely absent on hosts
  // without WebGPU, so probe with `in` (a `=== undefined` check reads as dead).
  if (typeof navigator === 'undefined' || !('gpu' in navigator)) return;

  const webGpuBackend = renderer.backend;

  if (!hasWebGpuBackendInternals(webGpuBackend)) return;

  webGpuBackend.context.configure({
    device: webGpuBackend.device,
    format: navigator.gpu.getPreferredCanvasFormat(),
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
    alphaMode: 'premultiplied',
    colorSpace: 'display-p3',
  });
}

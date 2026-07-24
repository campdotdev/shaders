// Renderer construction: wraps three's WebGPURenderer (which silently falls
// back to WebGL2 where WebGPU is missing — notably headless browsers) and
// applies Matter's defaults: transparent clear, capped pixel ratio, output
// gamut, and a resize helper with the logical-size guard described inline.
// ShaderScene calls this once per mount; Mode 2 users can call it directly.
import { Color, Vector2 } from 'three';
import { WebGPURenderer } from 'three/webgpu';

import { applyCanvasGamut, gamutToColorSpace, type OutputGamut } from './gamut.js';

export type { OutputGamut } from './gamut.js';

export type GpuBackend = 'webgpu' | 'webgl2';

export interface CreateRendererOptions {
  /** Anti-alias the framebuffer. Default: true. */
  antialias?: boolean;
  /** Force WebGL2 even if WebGPU is available (useful for testing fallback). Default: false. */
  forceWebGL?: boolean;
  /** Clear color (hex, CSS string, or THREE.Color). Default: transparent. */
  clearColor?: number | string | Color;
  /** Clear alpha (0–1). Default: 0 (transparent). */
  clearAlpha?: number;
  /** Cap on devicePixelRatio. Default: 2. Pass Infinity to disable. */
  maxDPR?: number;
  /** Output color gamut the framebuffer is encoded for. Default: 'srgb'. */
  gamut?: OutputGamut;
}

export interface GpuRenderer {
  /** The underlying Three.js WebGPURenderer (which may be running on a WebGL2 backend). */
  three: WebGPURenderer;
  /** Which backend the renderer initialized with. */
  backend: GpuBackend;
  /** Tear down the renderer and release GPU resources. */
  dispose: () => void;
  /** Resize the renderer to the canvas's current client dimensions. */
  resize: () => void;
}

/**
 * Create a Matter renderer wrapping THREE.WebGPURenderer.
 *
 * Tries WebGPU first; falls back to WebGL2 automatically if WebGPU is
 * unavailable on the host. The returned object exposes the underlying
 * three renderer plus a small wrapper for resize and disposal.
 */
export async function createRenderer(
  canvas: HTMLCanvasElement,
  opts: CreateRendererOptions = {},
): Promise<GpuRenderer> {
  const {
    antialias = true,
    forceWebGL = false,
    clearColor = 0x000000,
    clearAlpha = 0,
    maxDPR = 2,
    gamut = 'srgb',
  } = opts;

  const three = new WebGPURenderer({
    canvas,
    antialias,
    forceWebGL,
  });

  await three.init();

  three.outputColorSpace = gamutToColorSpace(gamut);

  three.setPixelRatio(Math.min(window.devicePixelRatio, maxDPR));
  const resolvedClearColor = clearColor instanceof Color ? clearColor : new Color(clearColor);

  three.setClearColor(resolvedClearColor, clearAlpha);

  const rendererSize = new Vector2();
  const resize = () => {
    const canvasWidth = canvas.clientWidth;
    const canvasHeight = canvas.clientHeight;

    // Ignore zero-size (canvas not yet laid out); a ResizeObserver will call
    // back once it has real dimensions.
    if (canvasWidth === 0 || canvasHeight === 0) return;

    // Compare against the renderer's *logical* size (getSize), NOT canvas.width.
    // The backend can set the canvas drawing buffer during init while the
    // renderer's logical size stays at the 300x150 default — comparing
    // canvas.width would then skip setSize and leave the render target
    // (and every shader's output) compressed.
    three.getSize(rendererSize);

    if (rendererSize.width !== canvasWidth || rendererSize.height !== canvasHeight) {
      three.setSize(canvasWidth, canvasHeight, false);
    }
  };

  resize();

  // Detect backend after init. `isWebGLBackend` is an internal duck-type flag
  // not declared in three's public Backend type — probe via `in` rather than
  // a property access that would trip strict typing.
  const isWebGL = 'isWebGLBackend' in three.backend && three.backend.isWebGLBackend === true;
  const backend: GpuBackend = forceWebGL || isWebGL ? 'webgl2' : 'webgpu';

  // three's WebGPU backend doesn't configure the canvas context for P3, so do it
  // ourselves now that the backend is known. No-op for sRGB / WebGL fallback.
  applyCanvasGamut(three, backend, gamut);

  return {
    three,
    backend,
    dispose: () => three.dispose(),
    resize,
  };
}

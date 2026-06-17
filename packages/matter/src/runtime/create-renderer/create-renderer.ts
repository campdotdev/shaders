import { Color, Vector2 } from 'three';
import { WebGPURenderer } from 'three/webgpu';

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
  } = opts;

  const three = new WebGPURenderer({
    canvas,
    antialias,
    forceWebGL,
  });

  await three.init();

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

  return {
    three,
    backend,
    dispose: () => three.dispose(),
    resize,
  };
}

import { WebGPURenderer } from 'three/webgpu'
import { Color } from 'three'

export type MatterBackend = 'webgpu' | 'webgl2'

export interface CreateRendererOptions {
  /** Anti-alias the framebuffer. Default: true. */
  antialias?: boolean
  /** Force WebGL2 even if WebGPU is available (useful for testing fallback). Default: false. */
  forceWebGL?: boolean
  /** Clear color (hex, CSS string, or THREE.Color). Default: transparent. */
  clearColor?: number | string | Color
  /** Clear alpha (0–1). Default: 0 (transparent). */
  clearAlpha?: number
  /** Cap on devicePixelRatio. Default: 2. Pass Infinity to disable. */
  maxDPR?: number
}

export interface MatterRenderer {
  /** The underlying Three.js WebGPURenderer (which may be running on a WebGL2 backend). */
  three: WebGPURenderer
  /** Which backend the renderer initialized with. */
  backend: MatterBackend
  /** Tear down the renderer and release GPU resources. */
  dispose: () => void
  /** Resize the renderer to the canvas's current client dimensions. */
  resize: () => void
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
): Promise<MatterRenderer> {
  const {
    antialias = true,
    forceWebGL = false,
    clearColor = 0x000000,
    clearAlpha = 0,
    maxDPR = 2,
  } = opts

  const three = new WebGPURenderer({
    canvas,
    antialias,
    forceWebGL,
  })

  await three.init()

  three.setPixelRatio(Math.min(window.devicePixelRatio, maxDPR))
  const resolvedClearColor =
    clearColor instanceof Color ? clearColor : new Color(clearColor as number | string)
  three.setClearColor(resolvedClearColor, clearAlpha)

  const resize = () => {
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    if (canvas.width !== w * three.getPixelRatio() || canvas.height !== h * three.getPixelRatio()) {
      three.setSize(w, h, false)
    }
  }
  resize()

  // Detect backend after init. The exact API may differ between three versions;
  // probe the renderer's backend symbol if present, fall back to a property check.
  const backend: MatterBackend =
    forceWebGL ||
    (three as unknown as { backend?: { isWebGLBackend?: boolean } }).backend?.isWebGLBackend
      ? 'webgl2'
      : 'webgpu'

  return {
    three,
    backend,
    dispose: () => three.dispose(),
    resize,
  }
}

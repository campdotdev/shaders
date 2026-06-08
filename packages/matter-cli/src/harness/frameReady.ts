declare global {
  interface Window {
    __matterReady?: boolean
  }
}

const NOISE_FLOOR = 2
const SAMPLE_SIZE = 4

export function installFrameReadyWatcher(): void {
  const tick = (): void => {
    const canvas = document.querySelector('canvas')
    if (canvas) {
      if (isNonBlank(canvas)) {
        window.__matterReady = true
        return
      }
    }
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

function isNonBlank(canvas: HTMLCanvasElement): boolean {
  try {
    // Backend-agnostic: read the canvas as an image via an offscreen 2D context.
    // Note: WebGPU/WebGL canvases support drawImage into a 2D context as long
    // as preserveDrawingBuffer or auto-clear behaviour hasn't already wiped them
    // for the frame we're sampling. We tick on rAF so we sample after Matter's
    // render call but before the browser's compositor clears.
    const off = document.createElement('canvas')
    off.width = SAMPLE_SIZE
    off.height = SAMPLE_SIZE
    const ctx = off.getContext('2d')
    if (!ctx) return false
    const sx = Math.max(0, Math.floor(canvas.width / 2) - SAMPLE_SIZE / 2)
    const sy = Math.max(0, Math.floor(canvas.height / 2) - SAMPLE_SIZE / 2)
    ctx.drawImage(canvas, sx, sy, SAMPLE_SIZE, SAMPLE_SIZE, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE)
    const { data } = ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE)
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i] ?? 0
      const g = data[i + 1] ?? 0
      const b = data[i + 2] ?? 0
      if (r > NOISE_FLOOR || g > NOISE_FLOOR || b > NOISE_FLOOR) return true
    }
    return false
  } catch {
    return false
  }
}

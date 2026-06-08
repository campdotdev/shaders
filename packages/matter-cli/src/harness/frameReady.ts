declare global {
  interface Window {
    __matterReady?: boolean
  }
}

const NOISE_FLOOR = 2
const SAMPLE_SIZE = 4

export function installFrameReadyWatcher(): void {
  let inflight = false
  const tick = async (): Promise<void> => {
    if (window.__matterReady) return
    if (!inflight) {
      const canvas = document.querySelector('canvas')
      if (canvas && canvas.width > 0 && canvas.height > 0) {
        inflight = true
        try {
          if (await isNonBlank(canvas)) {
            window.__matterReady = true
            return
          }
        } finally {
          inflight = false
        }
      }
    }
    requestAnimationFrame(() => {
      void tick()
    })
  }
  requestAnimationFrame(() => {
    void tick()
  })
}

async function isNonBlank(canvas: HTMLCanvasElement): Promise<boolean> {
  try {
    const sx = Math.max(0, Math.floor(canvas.width / 2) - SAMPLE_SIZE / 2)
    const sy = Math.max(0, Math.floor(canvas.height / 2) - SAMPLE_SIZE / 2)
    // createImageBitmap works for WebGPU canvases (drawImage does not).
    const bitmap = await createImageBitmap(canvas, sx, sy, SAMPLE_SIZE, SAMPLE_SIZE)
    const off = document.createElement('canvas')
    off.width = SAMPLE_SIZE
    off.height = SAMPLE_SIZE
    const ctx = off.getContext('2d')
    if (!ctx) return false
    ctx.drawImage(bitmap, 0, 0)
    bitmap.close()
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

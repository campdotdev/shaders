declare global {
  interface Window {
    __matterReady?: boolean;
  }
}

// Number of rAF ticks to wait after the canvas is mounted AND sized before
// signaling ready. Three ticks (~50ms at 60Hz) is enough for ShaderScene's
// renderer to size the canvas, compile the TSL graph, queue the first frame,
// and have it composite. The actual pixel readback isn't accessible to JS on
// WebGPU canvases — Playwright captures the GPU surface directly via Chromium's
// DevTools Protocol, which works regardless.
const STABLE_FRAMES = 3;

export function installFrameReadyWatcher(): void {
  let stableCount = 0;
  const tick = (): void => {
    if (window.__matterReady === true) return;
    const canvas = document.querySelector('canvas');

    if (canvas && canvas.width > 0 && canvas.height > 0) {
      stableCount += 1;
      if (stableCount >= STABLE_FRAMES) {
        window.__matterReady = true;

        return;
      }
    } else {
      stableCount = 0;
    }
    requestAnimationFrame(tick);
  };

  requestAnimationFrame(tick);
}

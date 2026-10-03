// A canvas's size as a framework-free Input: [width, height,
// devicePixelRatio]. ShaderScene owns one per renderer and calls `update`
// from its resize observer, after it resizes the renderer and before it
// redraws, so every size uniform a child writes from this signal is current
// in the frame the scene draws. useResize hands the signal to components.
// Pixel-density changes (browser zoom, or the window dragged to a monitor
// with different scaling) update it on their own.

// ----------------------------------------------------------------------------
// The signal's shape
// ----------------------------------------------------------------------------

export type ResizeValue = readonly [width: number, height: number, dpr: number];

export interface ResizeSignal {
  get(): ResizeValue;
  on(event: 'change', listener: (value: ResizeValue) => void): () => void;
}

export interface CanvasSize {
  /** The read side, for the shader context. */
  signal: ResizeSignal;
  /** Re-measure the canvas, and notify listeners if anything changed. */
  update: () => void;
  /** Stop watching pixel density and drop every listener. */
  dispose: () => void;
}

export function createCanvasSize(canvas: HTMLCanvasElement): CanvasSize {
  const listeners = new Set<(value: ResizeValue) => void>();

  // --------------------------------------------------------------------------
  // Measuring: read the box, and tell listeners only about real changes
  // --------------------------------------------------------------------------

  const measure = (): ResizeValue => [
    canvas.clientWidth,
    canvas.clientHeight,
    window.devicePixelRatio,
  ];
  let value = measure();

  const update = () => {
    const next = measure();

    if (next[0] === value[0] && next[1] === value[1] && next[2] === value[2]) return;
    value = next;
    for (const listener of listeners) listener(next);
  };

  // --------------------------------------------------------------------------
  // Pixel density: re-arm a media query pinned to each new density
  // --------------------------------------------------------------------------

  // There's no DPR-change event, only matchMedia against a query pinned to
  // the CURRENT value — `(resolution: 2dppx)` fires once when the density
  // stops being 2, and never again. So each firing re-arms a fresh query
  // pinned to the NEW density (tearing down the spent one), and the watch
  // keeps working across any number of zoom levels or monitor moves.
  let mediaQueryList: MediaQueryList | null = null;
  const onDensityChange = () => {
    update();
    watchDensity();
  };
  const watchDensity = () => {
    mediaQueryList?.removeEventListener('change', onDensityChange);
    mediaQueryList = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    mediaQueryList.addEventListener('change', onDensityChange);
  };

  watchDensity();

  // --------------------------------------------------------------------------
  // The handle
  // --------------------------------------------------------------------------

  return {
    signal: {
      get: () => value,
      on: (_event, listener) => {
        listeners.add(listener);

        return () => {
          listeners.delete(listener);
        };
      },
    },
    update,
    dispose() {
      mediaQueryList?.removeEventListener('change', onDensityChange);
      mediaQueryList = null;
      listeners.clear();
    },
  };
}

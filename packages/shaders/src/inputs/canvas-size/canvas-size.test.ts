import { afterEach, describe, expect, it, vi } from 'vitest';

import { createCanvasSize } from './canvas-size.js';

function canvasOfSize(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');

  Object.defineProperty(canvas, 'clientWidth', { configurable: true, value: width });
  Object.defineProperty(canvas, 'clientHeight', { configurable: true, value: height });

  return canvas;
}

function resizeCanvas(canvas: HTMLCanvasElement, width: number, height: number): void {
  Object.defineProperty(canvas, 'clientWidth', { configurable: true, value: width });
  Object.defineProperty(canvas, 'clientHeight', { configurable: true, value: height });
}

describe('createCanvasSize', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reads the canvas size and pixel density when created', () => {
    vi.stubGlobal('devicePixelRatio', 2);
    const canvasSize = createCanvasSize(canvasOfSize(800, 400));

    expect(canvasSize.signal.get()).toEqual([800, 400, 2]);
    canvasSize.dispose();
  });

  it('tells its listeners the new size on an update', () => {
    const canvas = canvasOfSize(800, 400);
    const canvasSize = createCanvasSize(canvas);
    const listener = vi.fn();

    canvasSize.signal.on('change', listener);
    resizeCanvas(canvas, 1200, 400);
    canvasSize.update();

    expect(listener).toHaveBeenCalledExactlyOnceWith([1200, 400, window.devicePixelRatio]);
    expect(canvasSize.signal.get()).toEqual([1200, 400, window.devicePixelRatio]);
    canvasSize.dispose();
  });

  it('stays quiet on an update that changes nothing', () => {
    const canvasSize = createCanvasSize(canvasOfSize(800, 400));
    const listener = vi.fn();

    canvasSize.signal.on('change', listener);
    canvasSize.update();

    expect(listener).not.toHaveBeenCalled();
    canvasSize.dispose();
  });

  // There is no pixel-density event, only a media query pinned to the
  // current density, which fires once when the density leaves it. The watch
  // re-pins to each new density, so it keeps working across any number of
  // changes.
  it('follows every pixel-density change', () => {
    const queries: Array<{ query: string; listener: () => void }> = [];

    vi.stubGlobal('devicePixelRatio', 1);
    vi.stubGlobal('matchMedia', (query: string) => ({
      addEventListener: (_event: string, listener: () => void) => queries.push({ query, listener }),
      removeEventListener: vi.fn(),
    }));
    const canvasSize = createCanvasSize(canvasOfSize(800, 400));
    const listener = vi.fn();

    canvasSize.signal.on('change', listener);
    vi.stubGlobal('devicePixelRatio', 2);
    queries.at(-1)?.listener();
    vi.stubGlobal('devicePixelRatio', 3);
    queries.at(-1)?.listener();

    expect(queries.map(({ query }) => query)).toEqual([
      '(resolution: 1dppx)',
      '(resolution: 2dppx)',
      '(resolution: 3dppx)',
    ]);
    expect(listener.mock.calls).toEqual([[[800, 400, 2]], [[800, 400, 3]]]);
    canvasSize.dispose();
  });

  it('drops its listeners on dispose', () => {
    const canvas = canvasOfSize(800, 400);
    const canvasSize = createCanvasSize(canvas);
    const listener = vi.fn();

    canvasSize.signal.on('change', listener);
    canvasSize.dispose();
    resizeCanvas(canvas, 1200, 400);
    canvasSize.update();

    expect(listener).not.toHaveBeenCalled();
  });
});

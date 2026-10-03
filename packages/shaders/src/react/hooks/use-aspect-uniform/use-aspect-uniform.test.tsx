import type { ReactNode } from 'react';

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FrameScheduler } from '../../../engine.js';
import { type CanvasSize, createCanvasSize } from '../../../inputs/canvas-size/canvas-size.js';
import { ShaderContext } from '../../context/shader-context.js';
import { useAspectUniform } from './use-aspect-uniform.js';

// A canvas whose CSS box the test controls. happy-dom lays nothing out, so
// clientWidth and clientHeight are defined by hand and read live from `size`.
function makeCanvas(width: number, height: number) {
  const canvas = document.createElement('canvas');
  const size = { width, height };

  Object.defineProperty(canvas, 'clientWidth', { get: () => size.width });
  Object.defineProperty(canvas, 'clientHeight', { get: () => size.height });

  return { canvas, size };
}

// The scene's size signal for that canvas. The test calls `update` by hand
// where ShaderScene's resize observer would.
const makeWrapper = (scheduler: FrameScheduler, canvasSize: CanvasSize) => {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <ShaderContext.Provider
        value={
          {
            scheduler,
            canvasSize: canvasSize.signal,
          } as unknown as React.ContextType<typeof ShaderContext>
        }
      >
        {children}
      </ShaderContext.Provider>
    );
  }

  return Wrapper;
};

const valueOf = (node: unknown) => (node as { value: number }).value;

describe('useAspectUniform', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', () => 0);
    vi.stubGlobal('cancelAnimationFrame', () => {});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('falls back to 16:9 outside a ShaderScene', () => {
    const { result } = renderHook(() => useAspectUniform());

    expect(valueOf(result.current)).toBeCloseTo(16 / 9);
  });

  // A static scene may have drawn its last frame before this hook's effect
  // runs, so the ratio it writes has to arrive with a render request or it
  // never shows.
  it('reads the canvas ratio, and requests a render', () => {
    const scheduler = new FrameScheduler();

    scheduler.setIdle(true);
    const requestRender = vi.spyOn(scheduler, 'requestRender');
    const { canvas } = makeCanvas(1728, 144);

    const { result } = renderHook(() => useAspectUniform(), {
      wrapper: makeWrapper(scheduler, createCanvasSize(canvas)),
    });

    expect(valueOf(result.current)).toBe(12);
    expect(requestRender).toHaveBeenCalled();
  });

  it('follows a resize and requests a render each time', () => {
    const scheduler = new FrameScheduler();

    scheduler.setIdle(true);
    const requestRender = vi.spyOn(scheduler, 'requestRender');
    const { canvas, size } = makeCanvas(1728, 144);
    const canvasSize = createCanvasSize(canvas);

    const { result } = renderHook(() => useAspectUniform(), {
      wrapper: makeWrapper(scheduler, canvasSize),
    });

    requestRender.mockClear();
    size.width = 864;
    act(() => canvasSize.update());

    expect(valueOf(result.current)).toBe(6);
    expect(requestRender).toHaveBeenCalledTimes(1);
  });

  it('ignores a collapsed canvas and picks up the size it gets later', () => {
    const scheduler = new FrameScheduler();
    const { canvas, size } = makeCanvas(0, 0);
    const canvasSize = createCanvasSize(canvas);

    const { result } = renderHook(() => useAspectUniform(), {
      wrapper: makeWrapper(scheduler, canvasSize),
    });

    expect(valueOf(result.current)).toBeCloseTo(16 / 9);

    size.width = 1728;
    size.height = 144;
    act(() => canvasSize.update());

    expect(valueOf(result.current)).toBe(12);
  });

  it('keeps the same uniform identity across re-renders', () => {
    const scheduler = new FrameScheduler();
    const { canvas } = makeCanvas(1728, 144);

    const { result, rerender } = renderHook(() => useAspectUniform(), {
      wrapper: makeWrapper(scheduler, createCanvasSize(canvas)),
    });
    const first = result.current;

    rerender();
    expect(result.current).toBe(first);
  });
});

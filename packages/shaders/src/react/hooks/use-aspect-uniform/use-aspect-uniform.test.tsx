import type { ReactNode } from 'react';

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FrameScheduler } from '../../../engine.js';
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

// A ResizeObserver the test fires by hand, standing in for the browser's.
class FakeResizeObserver {
  static callbacks: Array<() => void> = [];

  constructor(callback: () => void) {
    FakeResizeObserver.callbacks.push(callback);
  }

  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}

  static fire(): void {
    for (const callback of FakeResizeObserver.callbacks) callback();
  }

  static reset(): void {
    FakeResizeObserver.callbacks = [];
  }
}

const makeWrapper = (scheduler: FrameScheduler, canvas: HTMLCanvasElement) => {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <ShaderContext.Provider
        value={
          {
            scheduler,
            renderer: { three: { domElement: canvas } },
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
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    vi.stubGlobal('requestAnimationFrame', () => 0);
    vi.stubGlobal('cancelAnimationFrame', () => {});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    FakeResizeObserver.reset();
  });

  it('falls back to 16:9 outside a ShaderScene', () => {
    const { result } = renderHook(() => useAspectUniform());

    expect(valueOf(result.current)).toBeCloseTo(16 / 9);
  });

  // The resize signal is a stub on the first effect pass and materializes a
  // render later. By then a static scene has drawn its last frame, so the
  // real ratio has to arrive with a render request or it never shows.
  it('reads the canvas ratio once the resize signal materializes, and requests a render', () => {
    const scheduler = new FrameScheduler();

    scheduler.setIdle(true);
    const requestRender = vi.spyOn(scheduler, 'requestRender');
    const { canvas } = makeCanvas(1728, 144);

    const { result } = renderHook(() => useAspectUniform(), {
      wrapper: makeWrapper(scheduler, canvas),
    });

    expect(valueOf(result.current)).toBe(12);
    expect(requestRender).toHaveBeenCalled();
  });

  it('follows a resize and requests a render each time', () => {
    const scheduler = new FrameScheduler();

    scheduler.setIdle(true);
    const requestRender = vi.spyOn(scheduler, 'requestRender');
    const { canvas, size } = makeCanvas(1728, 144);

    const { result } = renderHook(() => useAspectUniform(), {
      wrapper: makeWrapper(scheduler, canvas),
    });

    requestRender.mockClear();
    size.width = 864;
    act(() => FakeResizeObserver.fire());

    expect(valueOf(result.current)).toBe(6);
    expect(requestRender).toHaveBeenCalledTimes(1);
  });

  it('ignores a collapsed canvas and picks up the size it gets later', () => {
    const scheduler = new FrameScheduler();
    const { canvas, size } = makeCanvas(0, 0);

    const { result } = renderHook(() => useAspectUniform(), {
      wrapper: makeWrapper(scheduler, canvas),
    });

    expect(valueOf(result.current)).toBeCloseTo(16 / 9);

    size.width = 1728;
    size.height = 144;
    act(() => FakeResizeObserver.fire());

    expect(valueOf(result.current)).toBe(12);
  });

  it('keeps the same uniform identity across re-renders', () => {
    const scheduler = new FrameScheduler();
    const { canvas } = makeCanvas(1728, 144);

    const { result, rerender } = renderHook(() => useAspectUniform(), {
      wrapper: makeWrapper(scheduler, canvas),
    });
    const first = result.current;

    rerender();
    expect(result.current).toBe(first);
  });
});

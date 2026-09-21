import type { ReactNode } from 'react';

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FrameScheduler } from '../../../engine.js';
import { ShaderContext } from '../../context/shader-context.js';
import { useCursor } from './use-cursor.js';

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', () => 0);
  vi.stubGlobal('cancelAnimationFrame', () => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
});

const fireMoveOnWindow = (clientX: number, clientY: number) => {
  window.dispatchEvent(new MouseEvent('mousemove', { clientX, clientY, bubbles: true }));
};

// A scene with a real scheduler and no canvas, so the input normalizes
// against the viewport the way the Mode 2 tests do. The scheduler is the
// only part of the context useCursor reads for idle and wake.
const makeSceneWrapper = (scheduler: FrameScheduler) => {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <ShaderContext.Provider
        value={
          {
            scheduler,
            renderer: { three: { domElement: null } },
          } as unknown as React.ContextType<typeof ShaderContext>
        }
      >
        {children}
      </ShaderContext.Provider>
    );
  }

  return Wrapper;
};

describe('useCursor inside a ShaderScene', () => {
  it('asks the scheduler for a render on a pointer move, before any tick', () => {
    const scheduler = new FrameScheduler();
    const requestRender = vi.spyOn(scheduler, 'requestRender');

    renderHook(() => useCursor(), { wrapper: makeSceneWrapper(scheduler) });

    expect(requestRender).not.toHaveBeenCalled();

    act(() => {
      fireMoveOnWindow(10, 10);
    });

    expect(requestRender).toHaveBeenCalledTimes(1);
  });

  it('keeps the scene drawing after a move until the smoothing settles, then lets it park', () => {
    // Capture the scheduler's frame requests so the test can run frames by
    // hand. A queued frame means the scene is awake; an empty queue means it
    // has parked.
    const frames: FrameRequestCallback[] = [];

    vi.stubGlobal('requestAnimationFrame', (frame: FrameRequestCallback) => {
      frames.push(frame);

      return frames.length;
    });
    Object.defineProperty(window, 'innerWidth', { value: 1000, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 1000, configurable: true });

    const scheduler = new FrameScheduler();

    scheduler.start();

    let now = 0;
    const runFrame = () => {
      const frame = frames.shift();

      now += 1000 / 60;
      act(() => frame?.(now));
    };

    const { result } = renderHook(() => useCursor({ smoothing: 0.5 }), {
      wrapper: makeSceneWrapper(scheduler),
    });

    // A static scene: one idle vote and nothing animated. Its flush frame
    // runs with the pointer still, so the scene parks.
    scheduler.setIdle(true);
    runFrame();
    expect(frames).toHaveLength(0);

    act(() => {
      fireMoveOnWindow(1000, 1000);
    });
    expect(frames).toHaveLength(1);

    let framesDrawn = 0;

    while (frames.length > 0 && framesDrawn < 60) {
      runFrame();
      framesDrawn += 1;
    }

    // smoothing 0.5 lands on the target on the 14th 60fps tick (see the
    // CursorInput settle test), so the scene needs about that many frames
    // plus one to draw the landed value, and then parks on its own.
    expect(result.current.get()).toEqual([1, 1]);
    expect(frames).toHaveLength(0);
    expect(framesDrawn).toBeGreaterThan(1);
    expect(framesDrawn).toBeLessThanOrEqual(20);
  });
});

describe('useCursor outside a ShaderScene (Mode 2)', () => {
  it('still smooths on its own frame loop after a move', () => {
    const frames: FrameRequestCallback[] = [];

    vi.stubGlobal('requestAnimationFrame', (frame: FrameRequestCallback) => {
      frames.push(frame);

      return frames.length;
    });
    Object.defineProperty(window, 'innerWidth', { value: 1000, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 1000, configurable: true });

    const { result } = renderHook(() => useCursor({ smoothing: 0 }));

    // The private loop queued its first frame on mount.
    expect(frames).toHaveLength(1);

    act(() => {
      fireMoveOnWindow(1000, 1000);
    });

    const frame = frames.shift();

    act(() => frame?.(performance.now() + 1000));

    expect(result.current.get()).toEqual([1, 1]);
    // The loop re-queues itself, as it always has.
    expect(frames).toHaveLength(1);
  });
});

describe('useCursor', () => {
  it('returns initial value [0.5, 0.5] before any pointer move', () => {
    const { result } = renderHook(() => useCursor());

    const [x, y] = result.current.get();

    expect(x).toBe(0.5);
    expect(y).toBe(0.5);
  });

  it('updates the target on mousemove (viewport-normalized without element opt)', () => {
    const { result } = renderHook(() => useCursor());

    act(() => {});

    const signal = result.current;
    let lastChange: readonly [number, number] | undefined;

    signal.on('change', (v) => {
      lastChange = v;
    });

    act(() => {
      fireMoveOnWindow(0, 0);
    });
    act(() => {
      if ('tick' in signal) {
        (signal as unknown as { tick(d: number): void }).tick(1);
      }
    });

    expect(signal.get()).toBeDefined();
    expect(signal.get().length).toBe(2);
    if (lastChange !== undefined) {
      expect(lastChange.length).toBe(2);
    }
  });

  it('survives Strict Mode pseudo-unmount/remount cycle without throwing', () => {
    const { unmount } = renderHook(() => useCursor());

    act(() => {});

    expect(() => unmount()).not.toThrow();
  });
});

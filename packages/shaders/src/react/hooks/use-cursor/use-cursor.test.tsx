import { type ReactNode, StrictMode } from 'react';

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CursorInput, FrameScheduler } from '../../../engine.js';
import { ShaderContext } from '../../context/shader-context.js';
import { useCursor } from './use-cursor.js';

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', () => 0);
  vi.stubGlobal('cancelAnimationFrame', () => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const fireMoveOnWindow = (clientX: number, clientY: number) => {
  window.dispatchEvent(new PointerEvent('pointermove', { clientX, clientY, bubbles: true }));
};

// Capture frame requests so a test can run frames by hand. A queued frame
// means a loop is awake; an empty queue means it has parked.
const captureFrames = () => {
  const frames: FrameRequestCallback[] = [];

  vi.stubGlobal('requestAnimationFrame', (frame: FrameRequestCallback) => {
    frames.push(frame);

    return frames.length;
  });

  return frames;
};

// A square viewport, so a move to (size, size) lands the target at [1, 1].
const setViewport = (size: number) => {
  Object.defineProperty(window, 'innerWidth', { value: size, configurable: true });
  Object.defineProperty(window, 'innerHeight', { value: size, configurable: true });
};

// A 1000 by 1000 canvas at the viewport origin, so a move to (500, 500) is
// the canvas center and one to (1500, 500) is past its right edge.
const CANVAS_SIZE = 1000;
const canvasRect = {
  getBoundingClientRect: () => ({ left: 0, top: 0, width: CANVAS_SIZE, height: CANVAS_SIZE }),
};

// A scene with a real scheduler and a lazily created shared cursor input,
// mirroring what ShaderScene puts on the context. Tests reach the input
// through `getCursorInput` to assert on sharing. The renderer's canvas is
// a real element with a 500 by 500 rect at (100, 100), distinct from the
// shared input's rect, so a test can tell which frame a value came from.
const makeScene = (scheduler: FrameScheduler) => {
  let sharedInput: CursorInput | null = null;
  const getCursorInput = vi.fn(() => {
    sharedInput ??= new CursorInput({ element: canvasRect });

    return sharedInput;
  });
  const canvas = document.createElement('canvas');

  canvas.getBoundingClientRect = () =>
    ({ left: 100, top: 100, width: 500, height: 500 }) as DOMRect;
  const shaderContext = {
    scheduler,
    getCursorInput,
    renderer: { three: { domElement: canvas } },
  } as unknown as React.ContextType<typeof ShaderContext>;

  function Wrapper({ children }: { children: ReactNode }) {
    return <ShaderContext.Provider value={shaderContext}>{children}</ShaderContext.Provider>;
  }

  return { Wrapper, getCursorInput, dispose: () => sharedInput?.dispose() };
};

// Run the scheduler frames one 60fps tick at a time.
const makeFrameRunner = (frames: FrameRequestCallback[]) => {
  let now = 0;

  return (deltaMilliseconds = 1000 / 60) => {
    const frame = frames.shift();

    now += deltaMilliseconds;
    act(() => frame?.(now));
  };
};

const countPointerListeners = () =>
  vi.mocked(window.addEventListener).mock.calls.filter(([eventType]) => eventType === 'pointermove')
    .length;

describe('useCursor inside a ShaderScene', () => {
  it('shares one cursor input and one window listener between two calls', () => {
    vi.spyOn(window, 'addEventListener');
    const scheduler = new FrameScheduler();
    const scene = makeScene(scheduler);

    renderHook(
      () => {
        useCursor();
        useCursor({ smoothing: 0.5 });
      },
      { wrapper: scene.Wrapper },
    );

    expect(scene.getCursorInput).toHaveBeenCalled();
    expect(countPointerListeners()).toBe(1);
    scene.dispose();
  });

  it('smooths each call at its own rate toward the same target', () => {
    const frames = captureFrames();
    const runFrame = makeFrameRunner(frames);
    const scheduler = new FrameScheduler();
    const scene = makeScene(scheduler);

    scheduler.start();

    const { result } = renderHook(
      () => ({
        snappy: useCursor({ smoothing: 0, initial: [0, 0] }),
        lazy: useCursor({ smoothing: 0.5, initial: [0, 0] }),
      }),
      { wrapper: scene.Wrapper },
    );

    // The scheduler's first tick is zero-length by design: it only sets
    // the time origin.
    runFrame();
    act(() => {
      fireMoveOnWindow(500, 500);
    });
    runFrame();

    expect(result.current.snappy.get()).toEqual([0.5, 0.5]);
    // smoothing 0.5 closes half the gap on one 60fps tick.
    expect(result.current.lazy.get()[0]).toBeCloseTo(0.25, 6);
    expect(result.current.lazy.get()[1]).toBeCloseTo(0.25, 6);
    scene.dispose();
  });

  it('holds its own initial position until the first pointer move', () => {
    const scheduler = new FrameScheduler();
    const scene = makeScene(scheduler);

    const { result } = renderHook(() => useCursor({ initial: [0.5, 2] }), {
      wrapper: scene.Wrapper,
    });

    expect(result.current.get()).toEqual([0.5, 2]);
    scene.dispose();
  });

  it('starts a call mounted after a move from its initial and glides to the pointer', () => {
    const frames = captureFrames();
    const runFrame = makeFrameRunner(frames);
    const scheduler = new FrameScheduler();
    const scene = makeScene(scheduler);

    scheduler.start();
    // The first call attaches the shared input, and the pointer moves before
    // the second call mounts.
    renderHook(() => useCursor(), { wrapper: scene.Wrapper });
    act(() => {
      fireMoveOnWindow(500, 500);
    });

    const { result } = renderHook(() => useCursor({ smoothing: 0, initial: [0, 0] }), {
      wrapper: scene.Wrapper,
    });

    expect(result.current.get()).toEqual([0, 0]);
    runFrame();
    expect(result.current.get()).toEqual([0.5, 0.5]);
    scene.dispose();
  });

  it('wakes a parked scene for a call mounted after the pointer has moved', () => {
    const frames = captureFrames();
    const runFrame = makeFrameRunner(frames);
    const scheduler = new FrameScheduler();
    const scene = makeScene(scheduler);

    scheduler.start();
    renderHook(() => useCursor({ smoothing: 0 }), { wrapper: scene.Wrapper });

    // A static scene: the first call sees one move, settles, and the scene
    // parks with the pointer resting at the canvas center.
    scheduler.setIdle(true);
    runFrame();
    act(() => {
      fireMoveOnWindow(500, 500);
    });
    while (frames.length > 0) runFrame();

    const { result } = renderHook(() => useCursor({ smoothing: 0, initial: [0, 0] }), {
      wrapper: scene.Wrapper,
    });

    // Mounting alone has to queue a frame: nothing else will, because the
    // pointer is still.
    expect(frames).toHaveLength(1);
    while (frames.length > 0) runFrame();

    expect(result.current.get()).toEqual([0.5, 0.5]);
    expect(result.current.presence.get()).toBe(1);
    scene.dispose();
  });

  it('eases presence to 1 after the pointer enters the canvas and to 0 after it leaves', () => {
    const frames = captureFrames();
    const runFrame = makeFrameRunner(frames);
    const scheduler = new FrameScheduler();
    const scene = makeScene(scheduler);

    scheduler.start();

    const { result } = renderHook(() => useCursor({ smoothing: 0 }), {
      wrapper: scene.Wrapper,
    });
    const presenceChanges: number[] = [];

    result.current.presence.on('change', (value) => presenceChanges.push(value));

    expect(result.current.presence.get()).toBe(0);

    // The scheduler's first tick is zero-length by design: it only sets
    // the time origin.
    runFrame();
    act(() => {
      fireMoveOnWindow(500, 500);
    });
    runFrame();

    const afterOneFrame = result.current.presence.get();

    expect(afterOneFrame).toBeGreaterThan(0);
    expect(afterOneFrame).toBeLessThan(1);

    for (let frame = 0; frame < 60; frame += 1) runFrame();
    expect(result.current.presence.get()).toBe(1);

    act(() => {
      fireMoveOnWindow(1500, 500);
    });
    runFrame();
    expect(result.current.presence.get()).toBeLessThan(1);

    for (let frame = 0; frame < 60; frame += 1) runFrame();
    expect(result.current.presence.get()).toBe(0);
    expect(presenceChanges.length).toBeGreaterThan(2);
    scene.dispose();
  });

  it('settles presence in about a quarter second', () => {
    const frames = captureFrames();
    const runFrame = makeFrameRunner(frames);
    const scheduler = new FrameScheduler();
    const scene = makeScene(scheduler);

    scheduler.start();

    const { result } = renderHook(() => useCursor({ smoothing: 0 }), {
      wrapper: scene.Wrapper,
    });

    act(() => {
      fireMoveOnWindow(500, 500);
    });

    let framesUntilSettled = 0;

    while (result.current.presence.get() < 1 && framesUntilSettled < 120) {
      runFrame();
      framesUntilSettled += 1;
    }

    // 15 frames at 60fps is 250ms.
    expect(framesUntilSettled).toBeGreaterThanOrEqual(10);
    expect(framesUntilSettled).toBeLessThanOrEqual(20);
    scene.dispose();
  });

  it('keeps the scene drawing after a move until position and presence settle, then lets it park', () => {
    const frames = captureFrames();
    const runFrame = makeFrameRunner(frames);
    const scheduler = new FrameScheduler();
    const scene = makeScene(scheduler);

    scheduler.start();

    const { result } = renderHook(() => useCursor({ smoothing: 0 }), {
      wrapper: scene.Wrapper,
    });

    // A static scene: one idle vote and nothing animated. Its flush frame
    // runs with the pointer still, so the scene parks.
    scheduler.setIdle(true);
    runFrame();
    expect(frames).toHaveLength(0);

    act(() => {
      fireMoveOnWindow(500, 500);
    });
    expect(frames).toHaveLength(1);

    let framesDrawn = 0;

    while (frames.length > 0 && framesDrawn < 60) {
      runFrame();
      framesDrawn += 1;
    }

    // smoothing 0 lands the position on the first tick, so it is the
    // presence easing that keeps the frames coming: about 15 of them, plus
    // one to draw the landed value.
    expect(result.current.get()).toEqual([0.5, 0.5]);
    expect(result.current.presence.get()).toBe(1);
    expect(frames).toHaveLength(0);
    expect(framesDrawn).toBeGreaterThan(5);
    expect(framesDrawn).toBeLessThanOrEqual(20);
    scene.dispose();
  });

  it('asks the scheduler for a render on a pointer move, before any tick', () => {
    const scheduler = new FrameScheduler();
    const scene = makeScene(scheduler);
    const requestRender = vi.spyOn(scheduler, 'requestRender');

    renderHook(() => useCursor(), { wrapper: scene.Wrapper });

    expect(requestRender).not.toHaveBeenCalled();

    act(() => {
      fireMoveOnWindow(10, 10);
    });

    expect(requestRender).toHaveBeenCalledTimes(1);
    scene.dispose();
  });

  it('calls the latest onMove callback without replacing the signal', () => {
    const firstOnMove = vi.fn();
    const secondOnMove = vi.fn();
    const scheduler = new FrameScheduler();
    const scene = makeScene(scheduler);
    const { result, rerender } = renderHook(({ onMove }) => useCursor({ onMove }), {
      initialProps: { onMove: firstOnMove },
      wrapper: scene.Wrapper,
    });
    const signal = result.current;

    act(() => {
      fireMoveOnWindow(10, 10);
    });
    rerender({ onMove: secondOnMove });
    act(() => {
      fireMoveOnWindow(20, 20);
    });

    expect(result.current).toBe(signal);
    expect(firstOnMove).toHaveBeenCalledTimes(1);
    expect(secondOnMove).toHaveBeenCalledTimes(1);
    scene.dispose();
  });

  it('caps only the first tick after waking a parked scene', () => {
    const frames = captureFrames();
    const runFrameAfter = makeFrameRunner(frames);
    const scheduler = new FrameScheduler();
    const scene = makeScene(scheduler);

    scheduler.start();

    const { result } = renderHook(() => useCursor({ smoothing: 0.9, initial: [0.5, 0.5] }), {
      wrapper: scene.Wrapper,
    });

    scheduler.setIdle(true);
    runFrameAfter(1000 / 60);
    expect(frames).toHaveLength(0);

    act(() => {
      fireMoveOnWindow(1000, 1000);
    });

    // A five second gap is capped at one 30fps frame: 1 - 0.9^2 = 19% of
    // the 0.5 gap closes, landing at 0.595.
    runFrameAfter(5000);
    expect(result.current.get()[0]).toBeCloseTo(0.595, 6);

    act(() => {
      fireMoveOnWindow(1000, 1000);
    });
    runFrameAfter(800);
    const expected = 1 - (1 - 0.595) * Math.pow(0.9, 0.8 * 60);

    expect(result.current.get()[0]).toBeCloseTo(expected, 6);
    expect(result.current.get()[0]).toBeGreaterThan(0.99);
    scene.dispose();
  });

  it('caps the first cursor tick when another idle flush is already queued', () => {
    const frames = captureFrames();
    const runFrameAfter = makeFrameRunner(frames);
    const scheduler = new FrameScheduler();
    const scene = makeScene(scheduler);

    scheduler.start();

    const { result } = renderHook(() => useCursor({ smoothing: 0.9, initial: [0.5, 0.5] }), {
      wrapper: scene.Wrapper,
    });

    scheduler.setIdle(true);
    runFrameAfter(1000 / 60);
    expect(frames).toHaveLength(0);

    scheduler.requestRender();
    act(() => {
      fireMoveOnWindow(1000, 1000);
    });

    runFrameAfter(5000);

    expect(result.current.get()[0]).toBeCloseTo(0.595, 6);
    scene.dispose();
  });

  it('keeps the burst alive across the zero-length first tick', () => {
    const frames = captureFrames();
    const runFrame = makeFrameRunner(frames);
    const scheduler = new FrameScheduler();
    const scene = makeScene(scheduler);

    scheduler.start();

    const { result } = renderHook(() => useCursor({ smoothing: 0.5, initial: [0, 0] }), {
      wrapper: scene.Wrapper,
    });

    // The pointer moves before the scheduler has ever ticked. Its first
    // tick only sets the time origin, so it reports a zero delta and eases
    // nothing. The scene must still ask for the next frame.
    scheduler.setIdle(true);
    act(() => {
      fireMoveOnWindow(500, 500);
    });
    runFrame();

    expect(result.current.get()).toEqual([0, 0]);
    expect(frames).toHaveLength(1);

    let framesDrawn = 0;

    while (frames.length > 0 && framesDrawn < 60) {
      runFrame();
      framesDrawn += 1;
    }

    expect(result.current.get()).toEqual([0.5, 0.5]);
    expect(frames).toHaveLength(0);
    scene.dispose();
  });

  it('keeps the canvas frame when only the event target is overridden', () => {
    const frames = captureFrames();
    const runFrame = makeFrameRunner(frames);
    const scheduler = new FrameScheduler();
    const scene = makeScene(scheduler);
    const privateTarget = new EventTarget();

    scheduler.start();

    const { result } = renderHook(() => useCursor({ target: privateTarget, smoothing: 0 }), {
      wrapper: scene.Wrapper,
    });

    // The scene's canvas is 500 by 500 at (100, 100), so the viewport
    // point (350, 350) is its center, not the viewport's.
    runFrame();
    act(() => {
      privateTarget.dispatchEvent(new PointerEvent('pointermove', { clientX: 350, clientY: 350 }));
    });
    runFrame();

    expect(scene.getCursorInput).not.toHaveBeenCalled();
    expect(result.current.get()).toEqual([0.5, 0.5]);
    scene.dispose();
  });

  it('survives Strict Mode without a leaked move subscription', () => {
    const scheduler = new FrameScheduler();
    const scene = makeScene(scheduler);
    const onMove = vi.fn();

    function StrictWrapper({ children }: { children: ReactNode }) {
      return (
        <StrictMode>
          <scene.Wrapper>{children}</scene.Wrapper>
        </StrictMode>
      );
    }

    const { unmount } = renderHook(() => useCursor({ onMove }), { wrapper: StrictWrapper });

    act(() => {
      fireMoveOnWindow(500, 500);
    });

    expect(onMove).toHaveBeenCalledTimes(1);
    expect(() => unmount()).not.toThrow();
    scene.dispose();
  });

  it('attaches nothing when disabled and returns the stub', () => {
    vi.spyOn(window, 'addEventListener');
    const scheduler = new FrameScheduler();
    const scene = makeScene(scheduler);
    const add = vi.spyOn(scheduler, 'add');

    const { result } = renderHook(() => useCursor({ enabled: false }), {
      wrapper: scene.Wrapper,
    });

    act(() => {
      fireMoveOnWindow(500, 500);
    });

    expect(scene.getCursorInput).not.toHaveBeenCalled();
    expect(countPointerListeners()).toBe(0);
    expect(add).not.toHaveBeenCalled();
    expect(result.current.get()).toEqual([0.5, 0.5]);
    expect(result.current.presence.get()).toBe(0);
  });

  it('creates a private input in the caller frame when given an element', () => {
    const frames = captureFrames();
    const runFrame = makeFrameRunner(frames);
    const scheduler = new FrameScheduler();
    const scene = makeScene(scheduler);

    scheduler.start();

    // A 200 by 200 element at (100, 100): the viewport point (200, 200) is
    // its center, and the shared canvas would read it as [0.2, 0.2].
    const element = {
      getBoundingClientRect: () => ({ left: 100, top: 100, width: 200, height: 200 }),
    };
    const { result } = renderHook(() => useCursor({ element, smoothing: 0 }), {
      wrapper: scene.Wrapper,
    });

    act(() => {
      fireMoveOnWindow(200, 200);
    });
    runFrame();

    expect(scene.getCursorInput).not.toHaveBeenCalled();
    expect(result.current.get()).toEqual([0.5, 0.5]);
    scene.dispose();
  });

  it('leaves the shared input attached after a call unmounts', () => {
    vi.spyOn(window, 'removeEventListener');
    const scheduler = new FrameScheduler();
    const scene = makeScene(scheduler);
    const { unmount } = renderHook(() => useCursor(), { wrapper: scene.Wrapper });

    unmount();

    const removedPointerListeners = vi
      .mocked(window.removeEventListener)
      .mock.calls.filter(([eventType]) => eventType === 'pointermove');

    expect(removedPointerListeners).toHaveLength(0);
    scene.dispose();
  });
});

describe('useCursor outside a ShaderScene (Mode 2)', () => {
  it('still smooths on its own frame loop after a move', () => {
    const frames = captureFrames();

    setViewport(1000);

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

  it('attaches no listener and runs no loop when disabled', () => {
    vi.spyOn(window, 'addEventListener');
    const frames = captureFrames();

    renderHook(() => useCursor({ enabled: false }));

    expect(countPointerListeners()).toBe(0);
    expect(frames).toHaveLength(0);
  });

  it('survives Strict Mode with one listener and one frame loop', () => {
    vi.spyOn(window, 'addEventListener');
    vi.spyOn(window, 'removeEventListener');
    const frames = captureFrames();

    const { unmount } = renderHook(() => useCursor(), { wrapper: StrictMode });

    // Strict Mode mounted, unmounted, and mounted again: one listener and
    // one loop survive, and the first cycle's were torn down.
    expect(countPointerListeners()).toBe(2);
    expect(
      vi.mocked(window.removeEventListener).mock.calls.filter(([type]) => type === 'pointermove'),
    ).toHaveLength(1);
    expect(frames).toHaveLength(2);

    unmount();
    expect(
      vi.mocked(window.removeEventListener).mock.calls.filter(([type]) => type === 'pointermove'),
    ).toHaveLength(2);
  });
});

describe('useCursor', () => {
  it('returns initial value [0.5, 0.5] and presence 0 before any pointer move', () => {
    const { result } = renderHook(() => useCursor());

    expect(result.current.get()).toEqual([0.5, 0.5]);
    expect(result.current.presence.get()).toBe(0);
  });

  it('survives Strict Mode pseudo-unmount/remount cycle without throwing', () => {
    const { unmount } = renderHook(() => useCursor());

    act(() => {});

    expect(() => unmount()).not.toThrow();
  });
});

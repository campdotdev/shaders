import type { ReactNode } from 'react';

import { act, renderHook } from '@testing-library/react';
import type { Vector2 } from 'three/webgpu';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CursorInput, FrameScheduler } from '../../../engine.js';
import { ShaderContext } from '../../context/shader-context.js';
import type { AnimatableSignal, PositionProp } from '../animatable-signal/animatable-signal.js';
import { useAnimatablePoint } from './use-animatable-point.js';

const makeWrapper = (scheduler: FrameScheduler) => {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <ShaderContext.Provider
        value={
          {
            scheduler,
          } as unknown as React.ContextType<typeof ShaderContext>
        }
      >
        {children}
      </ShaderContext.Provider>
    );
  }

  return Wrapper;
};

const makeSignal = <T,>(initial: T) => {
  let value = initial;
  const subscribers = new Set<(v: T) => void>();
  const signal: AnimatableSignal<T> = {
    get: () => value,
    on: (_event, listener) => {
      subscribers.add(listener);

      return () => subscribers.delete(listener);
    },
  };
  const set = (next: T) => {
    value = next;
    for (const listener of subscribers) listener(next);
  };

  return { signal, set };
};

const read = (node: unknown) => (node as { value: Vector2 }).value;

describe('useAnimatablePoint', () => {
  it('initializes a Vector2 from a plain tuple', () => {
    const { result } = renderHook(() => useAnimatablePoint([0.25, 0.75]));

    expect(read(result.current).x).toBe(0.25);
    expect(read(result.current).y).toBe(0.75);
  });

  it('updates the vector when the tuple changes', () => {
    const { result, rerender } = renderHook(({ v }) => useAnimatablePoint(v), {
      initialProps: { v: [0.25, 0.75] as readonly [number, number] },
    });

    rerender({ v: [0.1, 0.2] as readonly [number, number] });
    expect(read(result.current).x).toBe(0.1);
    expect(read(result.current).y).toBe(0.2);
  });

  it('subscribes to a signal and writes the pair imperatively', () => {
    const { signal, set } = makeSignal<readonly [number, number]>([0.1, 0.2]);
    const { result } = renderHook(() => useAnimatablePoint(signal));

    expect(read(result.current).x).toBe(0.1);
    set([0.8, 0.9]);
    expect(read(result.current).x).toBe(0.8);
    expect(read(result.current).y).toBe(0.9);
  });

  it('seeds from a swapped-in signal before it ticks', () => {
    const first = makeSignal<readonly [number, number]>([0.1, 0.2]);
    const second = makeSignal<readonly [number, number]>([0.7, 0.8]);
    const { result, rerender } = renderHook(({ v }) => useAnimatablePoint(v), {
      initialProps: { v: first.signal },
    });

    rerender({ v: second.signal });
    expect(read(result.current).x).toBe(0.7);
    expect(read(result.current).y).toBe(0.8);
  });

  it('unsubscribes from a signal on unmount', () => {
    const { signal, set } = makeSignal<readonly [number, number]>([0.1, 0.2]);
    const { result, unmount } = renderHook(() => useAnimatablePoint(signal));

    unmount();
    set([0.8, 0.9]);
    expect(read(result.current).x).toBe(0.1);
  });

  it('keeps the same uniform identity across updates', () => {
    const { result, rerender } = renderHook(({ v }) => useAnimatablePoint(v), {
      initialProps: { v: [0.25, 0.75] as readonly [number, number] },
    });
    const first = result.current;

    rerender({ v: [0.1, 0.2] as readonly [number, number] });
    expect(result.current).toBe(first);
  });

  // screenOrigin converts a screen-style point (y grows down, [0,0] top-left)
  // into uv space (v grows up). The initial read is a separate code path from
  // the subscription, so it gets its own test: missing it renders a static
  // off-center value inverted, and on a parked scene nothing ever corrects it.
  describe('screenOrigin conversion', () => {
    it('converts the initial read', () => {
      const { result } = renderHook(() => useAnimatablePoint([0.25, 0.2], { screenOrigin: true }));

      expect(read(result.current).x).toBe(0.25);
      expect(read(result.current).y).toBeCloseTo(0.8);
    });

    it('converts a streamed change', () => {
      const { signal, set } = makeSignal<readonly [number, number]>([0.5, 0.5]);
      const { result } = renderHook(() => useAnimatablePoint(signal, { screenOrigin: true }));

      set([0.5, 0.1]);
      expect(read(result.current).y).toBeCloseTo(0.9);
    });

    it('leaves the pair alone when the option is off', () => {
      const { result } = renderHook(() => useAnimatablePoint([0.25, 0.2]));

      expect(read(result.current).y).toBe(0.2);
    });
  });

  describe('waking an idle scheduler', () => {
    beforeEach(() => {
      vi.stubGlobal('requestAnimationFrame', () => 0);
      vi.stubGlobal('cancelAnimationFrame', () => {});
    });
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('requests a render when a plain tuple changes', () => {
      const scheduler = new FrameScheduler();

      scheduler.setIdle(true);
      const requestRender = vi.spyOn(scheduler, 'requestRender');

      const { rerender } = renderHook(({ v }) => useAnimatablePoint(v), {
        wrapper: makeWrapper(scheduler),
        initialProps: { v: [0.25, 0.75] as readonly [number, number] },
      });

      requestRender.mockClear();
      rerender({ v: [0.1, 0.2] as readonly [number, number] });
      expect(requestRender).toHaveBeenCalled();
    });

    it('requests a render on every signal tick', () => {
      const scheduler = new FrameScheduler();

      scheduler.setIdle(true);
      const requestRender = vi.spyOn(scheduler, 'requestRender');
      const { signal, set } = makeSignal<readonly [number, number]>([0.1, 0.2]);

      renderHook(() => useAnimatablePoint(signal), { wrapper: makeWrapper(scheduler) });

      requestRender.mockClear();
      set([0.3, 0.4]);
      set([0.5, 0.6]);
      expect(requestRender).toHaveBeenCalledTimes(2);
    });

    // The array-props gotcha in docs/agents/tsl.md: a wrapper's
    // `center = [0.5, 0.5]` default allocates a fresh array every render, so
    // depending on tuple identity would re-run the effect - and poke an idle
    // scheduler - on every unrelated re-render.
    it('does not poke the scheduler when a re-render passes an equal tuple', () => {
      const scheduler = new FrameScheduler();

      scheduler.setIdle(true);
      const requestRender = vi.spyOn(scheduler, 'requestRender');

      const { rerender } = renderHook(({ v }) => useAnimatablePoint(v), {
        wrapper: makeWrapper(scheduler),
        initialProps: { v: [0.25, 0.75] as readonly [number, number] },
      });

      requestRender.mockClear();
      rerender({ v: [0.25, 0.75] as readonly [number, number] });
      expect(requestRender).not.toHaveBeenCalled();
    });

    it('works outside a ShaderScene, where there is no scheduler', () => {
      const { result, rerender } = renderHook(({ v }) => useAnimatablePoint(v), {
        initialProps: { v: [0.25, 0.75] as readonly [number, number] },
      });

      rerender({ v: [0.1, 0.2] as readonly [number, number] });
      expect(read(result.current).x).toBe(0.1);
    });
  });

  // The 'cursor' shorthand resolves to the scene's shared cursor through
  // useCursor. The fake scene mirrors what ShaderScene puts on the context:
  // a real scheduler and a lazily created shared input over a 1000 by 1000
  // canvas at the viewport origin, so a move to (250, 750) is [0.25, 0.75].
  describe("the 'cursor' shorthand", () => {
    const CANVAS_SIZE = 1000;
    let frames: FrameRequestCallback[];

    beforeEach(() => {
      frames = [];
      vi.stubGlobal('requestAnimationFrame', (frame: FrameRequestCallback) => {
        frames.push(frame);

        return frames.length;
      });
      vi.stubGlobal('cancelAnimationFrame', () => {});
      vi.spyOn(window, 'addEventListener');
    });
    afterEach(() => {
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    });

    const makeScene = () => {
      const scheduler = new FrameScheduler();
      let sharedInput: CursorInput | null = null;
      const getCursorInput = vi.fn(() => {
        sharedInput ??= new CursorInput({
          element: {
            getBoundingClientRect: () => ({
              left: 0,
              top: 0,
              width: CANVAS_SIZE,
              height: CANVAS_SIZE,
            }),
          },
        });

        return sharedInput;
      });
      const shaderContext = {
        scheduler,
        getCursorInput,
        renderer: { three: { domElement: document.createElement('canvas') } },
      } as unknown as React.ContextType<typeof ShaderContext>;

      function Wrapper({ children }: { children: ReactNode }) {
        return <ShaderContext.Provider value={shaderContext}>{children}</ShaderContext.Provider>;
      }

      // A static scene parks once the cursor's smoothing settles, which is
      // what lets settle() below run frames until the queue drains.
      scheduler.setIdle(true);
      scheduler.start();

      return { Wrapper, getCursorInput, dispose: () => sharedInput?.dispose() };
    };

    let now = 0;
    const settle = () => {
      while (frames.length > 0) {
        const frame = frames.shift();

        now += 1000 / 60;
        act(() => frame?.(now));
      }
    };
    const movePointer = (clientX: number, clientY: number) => {
      act(() => {
        window.dispatchEvent(new PointerEvent('pointermove', { clientX, clientY, bubbles: true }));
      });
      settle();
    };
    const countPointerListeners = () =>
      vi
        .mocked(window.addEventListener)
        .mock.calls.filter(([eventType]) => eventType === 'pointermove').length;

    it('follows the shared scene cursor', () => {
      const scene = makeScene();
      const { result } = renderHook(() => useAnimatablePoint('cursor'), {
        wrapper: scene.Wrapper,
      });

      movePointer(250, 750);
      expect(scene.getCursorInput).toHaveBeenCalled();
      expect(read(result.current).x).toBeCloseTo(0.25, 3);
      expect(read(result.current).y).toBeCloseTo(0.75, 3);
      scene.dispose();
    });

    it('sits at the canvas center before the first move by default', () => {
      const scene = makeScene();
      const { result } = renderHook(() => useAnimatablePoint('cursor'), {
        wrapper: scene.Wrapper,
      });

      settle();
      expect(read(result.current).x).toBe(0.5);
      expect(read(result.current).y).toBe(0.5);
      scene.dispose();
    });

    // A component that wants the pointer's absence to read as "no
    // reaction", such as LedWall's swell, parks the point off the canvas.
    // The very first value has to be the parked one: a single frame drawn
    // at the canvas center would flash the reaction there.
    it('sits at cursorInitial before the first move, from the very first value', () => {
      const scene = makeScene();
      const seen: number[] = [];
      const { result } = renderHook(
        () => {
          const node = useAnimatablePoint('cursor', { cursorInitial: [0.5, 2] });

          seen.push(read(node).y);

          return node;
        },
        { wrapper: scene.Wrapper },
      );

      settle();
      expect(seen.every((y) => y === 2)).toBe(true);
      expect(read(result.current).y).toBe(2);
      scene.dispose();
    });

    // cursorInitial is documented as read once, at mount. A later value must
    // not move the start, even when the point switches to 'cursor' after it.
    it('keeps the mount-time cursorInitial when the option changes later', () => {
      const scene = makeScene();
      const { result, rerender } = renderHook(
        ({ v, cursorInitial }: { v: PositionProp; cursorInitial: readonly [number, number] }) =>
          useAnimatablePoint(v, { cursorInitial }),
        { wrapper: scene.Wrapper, initialProps: { v: [0.25, 0.75], cursorInitial: [0.5, 2] } },
      );

      rerender({ v: [0.25, 0.75], cursorInitial: [0.5, 3] });
      rerender({ v: 'cursor', cursorInitial: [0.5, 3] });
      settle();
      expect(read(result.current).y).toBe(2);
      scene.dispose();
    });

    it('converts the cursor with screenOrigin like any other pair', () => {
      const scene = makeScene();
      const { result } = renderHook(() => useAnimatablePoint('cursor', { screenOrigin: true }), {
        wrapper: scene.Wrapper,
      });

      movePointer(250, 200);
      expect(read(result.current).x).toBeCloseTo(0.25, 3);
      expect(read(result.current).y).toBeCloseTo(0.8, 3);
      scene.dispose();
    });

    it('attaches no pointer listener for a tuple or a signal', () => {
      const scene = makeScene();
      const { signal } = makeSignal<readonly [number, number]>([0.1, 0.2]);

      renderHook(
        () => {
          useAnimatablePoint([0.25, 0.75]);
          useAnimatablePoint(signal, { screenOrigin: true });
        },
        { wrapper: scene.Wrapper },
      );

      expect(scene.getCursorInput).not.toHaveBeenCalled();
      expect(countPointerListeners()).toBe(0);
    });

    it('attaches no pointer listener for a tuple outside a ShaderScene', () => {
      renderHook(() => useAnimatablePoint([0.25, 0.75]));

      expect(countPointerListeners()).toBe(0);
    });

    it('keeps one uniform across tuple, cursor, and signal, and stops following when switched away', () => {
      const scene = makeScene();
      const { signal } = makeSignal<readonly [number, number]>([0.9, 0.1]);
      const { result, rerender } = renderHook(
        ({ v }: { v: PositionProp }) => useAnimatablePoint(v),
        { wrapper: scene.Wrapper, initialProps: { v: [0.25, 0.75] } },
      );
      const first = result.current;

      rerender({ v: 'cursor' });
      movePointer(600, 400);
      expect(result.current).toBe(first);
      expect(read(result.current).x).toBeCloseTo(0.6, 3);

      rerender({ v: signal });
      expect(result.current).toBe(first);
      expect(read(result.current).x).toBe(0.9);

      rerender({ v: [0.3, 0.3] });
      movePointer(100, 100);
      expect(result.current).toBe(first);
      expect(read(result.current).x).toBe(0.3);
      expect(read(result.current).y).toBe(0.3);
      scene.dispose();
    });
  });
});

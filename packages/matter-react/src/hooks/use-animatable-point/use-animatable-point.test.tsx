import type { ReactNode } from 'react';

import { FrameScheduler } from '@lovo/matter';
import { renderHook } from '@testing-library/react';
import type { Vector2 } from 'three/webgpu';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ShaderContext } from '../../context/shader-context.js';
import type { AnimatableSignal } from '../animatable-signal/animatable-signal.js';
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

    // Gotcha 16: a wrapper's `center = [0.5, 0.5]` default allocates a fresh
    // array every render, so depending on tuple identity would re-run the
    // effect - and poke an idle scheduler - on every unrelated re-render.
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
});

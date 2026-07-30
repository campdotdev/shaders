import type { ReactNode } from 'react';

import { FrameScheduler } from '@lovo/matter';
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ShaderContext } from '../../context/shader-context.js';
import { type AnimatableSignal, useAnimatableUniform } from './use-animatable-uniform.js';

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

describe('useAnimatableUniform', () => {
  it('initializes a uniform with the plain prop value', () => {
    const { result } = renderHook(() => useAnimatableUniform(0.5));

    expect((result.current as unknown as { value: number }).value).toBe(0.5);
  });

  it('updates the uniform when the prop changes', () => {
    const { result, rerender } = renderHook(({ v }) => useAnimatableUniform(v), {
      initialProps: { v: 0.5 },
    });

    rerender({ v: 0.9 });
    expect((result.current as unknown as { value: number }).value).toBe(0.9);
  });

  it('subscribes to a signal and writes value imperatively', () => {
    const { signal, set } = makeSignal(0.1);
    const { result } = renderHook(() => useAnimatableUniform(signal));

    expect((result.current as unknown as { value: number }).value).toBe(0.1);
    set(0.7);
    expect((result.current as unknown as { value: number }).value).toBe(0.7);
  });

  it('unsubscribes from signal on unmount', () => {
    const { signal, set } = makeSignal(0.1);
    const { result, unmount } = renderHook(() => useAnimatableUniform(signal));

    expect((result.current as unknown as { value: number }).value).toBe(0.1);
    unmount();
    set(0.9);
    // Uniform should not have updated after unmount.
    expect((result.current as unknown as { value: number }).value).toBe(0.1);
  });

  it('keeps the same uniform identity across plain-value updates', () => {
    const { result, rerender } = renderHook(({ v }) => useAnimatableUniform(v), {
      initialProps: { v: 0.5 },
    });
    const first = result.current;

    rerender({ v: 0.9 });
    expect(result.current).toBe(first);
  });

  // The scene renders on demand, so writing a uniform is only half the job:
  // a scene that has parked its frame loop has to be told to draw again, or
  // the new value never reaches the screen.
  describe('waking an idle scheduler', () => {
    beforeEach(() => {
      vi.stubGlobal('requestAnimationFrame', () => 0);
      vi.stubGlobal('cancelAnimationFrame', () => {});
    });
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('requests a render when a plain value changes', () => {
      const scheduler = new FrameScheduler();

      scheduler.setIdle(true);
      const requestRender = vi.spyOn(scheduler, 'requestRender');

      const { rerender } = renderHook(({ v }) => useAnimatableUniform(v), {
        wrapper: makeWrapper(scheduler),
        initialProps: { v: 0.5 },
      });

      requestRender.mockClear();
      rerender({ v: 0.9 });
      expect(requestRender).toHaveBeenCalled();
    });

    it('requests a render on every signal tick', () => {
      const scheduler = new FrameScheduler();

      scheduler.setIdle(true);
      const requestRender = vi.spyOn(scheduler, 'requestRender');
      const { signal, set } = makeSignal(0.1);

      renderHook(() => useAnimatableUniform(signal), { wrapper: makeWrapper(scheduler) });

      requestRender.mockClear();
      set(0.7);
      set(0.8);
      expect(requestRender).toHaveBeenCalledTimes(2);
    });

    it('stops requesting renders after unmount', () => {
      const scheduler = new FrameScheduler();

      scheduler.setIdle(true);
      const requestRender = vi.spyOn(scheduler, 'requestRender');
      const { signal, set } = makeSignal(0.1);

      const { unmount } = renderHook(() => useAnimatableUniform(signal), {
        wrapper: makeWrapper(scheduler),
      });

      unmount();
      requestRender.mockClear();
      set(0.9);
      expect(requestRender).not.toHaveBeenCalled();
    });

    it('works outside a ShaderScene, where there is no scheduler', () => {
      const { result, rerender } = renderHook(({ v }) => useAnimatableUniform(v), {
        initialProps: { v: 0.5 },
      });

      rerender({ v: 0.9 });
      expect((result.current as unknown as { value: number }).value).toBe(0.9);
    });
  });
});

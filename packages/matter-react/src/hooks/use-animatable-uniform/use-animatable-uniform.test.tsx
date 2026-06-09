import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { type AnimatableSignal, useAnimatableUniform } from './use-animatable-uniform.js';

const makeSignal = <T,>(initial: T) => {
  let value = initial;
  const subs = new Set<(v: T) => void>();
  const sig: AnimatableSignal<T> = {
    get: () => value,
    on: (_event, cb) => {
      subs.add(cb);

      return () => subs.delete(cb);
    },
  };
  const set = (next: T) => {
    value = next;
    for (const cb of subs) cb(next);
  };

  return { signal: sig, set };
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
});

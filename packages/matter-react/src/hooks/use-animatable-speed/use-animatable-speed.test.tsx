import { type ReactNode, StrictMode } from 'react';

import { getReducedMotionTimeScale } from '@lovo/matter';
import type { SchedulerClient, SchedulerTick } from '@lovo/matter';
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ShaderContext } from '../../context/shader-context.js';
import type { AnimatableSignal } from '../animatable-signal/animatable-signal.js';
import { useAnimatableSpeed } from './use-animatable-speed.js';

// Drives scheduler ticks by hand: the hook only needs add/remove/
// requestRender, and a manual tick() lets each test advance time by an
// exact delta without stubbing requestAnimationFrame.
class FakeScheduler {
  clients = new Set<SchedulerClient>();
  phaseResetListeners = new Set<() => void>();
  requestRender = vi.fn();

  add(client: SchedulerClient): void {
    this.clients.add(client);
  }

  remove(client: SchedulerClient): void {
    this.clients.delete(client);
  }

  onPhaseReset(listener: () => void): () => void {
    this.phaseResetListeners.add(listener);

    return () => this.phaseResetListeners.delete(listener);
  }

  resetPhases(): void {
    for (const listener of this.phaseResetListeners) listener();
  }

  tick(delta: number): void {
    const tick: SchedulerTick = { delta, elapsed: 0, now: 0 };

    for (const client of this.clients) client(tick);
  }
}

const makeWrapper = (scheduler: FakeScheduler) => {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <ShaderContext.Provider
        value={{ scheduler } as unknown as React.ContextType<typeof ShaderContext>}
      >
        {children}
      </ShaderContext.Provider>
    );
  }

  return Wrapper;
};

// Same provider as makeWrapper, but nested in <StrictMode> so React
// double-invokes the integrator effect (mount, cleanup, remount) on test
// setup, the same way it does in development. This is what proves the
// scheduler ends up with exactly one accumulator client, not two.
const makeStrictWrapper = (scheduler: FakeScheduler) => {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <StrictMode>
        <ShaderContext.Provider
          value={{ scheduler } as unknown as React.ContextType<typeof ShaderContext>}
        >
          {children}
        </ShaderContext.Provider>
      </StrictMode>
    );
  }

  return Wrapper;
};

const makeSignal = (initial: number) => {
  let value = initial;
  const subscribers = new Set<(v: number) => void>();
  const signal: AnimatableSignal<number> = {
    get: () => value,
    on: (_event, listener) => {
      subscribers.add(listener);

      return () => subscribers.delete(listener);
    },
  };
  const set = (next: number) => {
    value = next;
    for (const listener of subscribers) listener(next);
  };

  return { signal, set };
};

const phaseOf = (result: { current: unknown }): number =>
  (result.current as { value: number }).value;

describe('useAnimatableSpeed', () => {
  beforeEach(() => {
    // The reduced-motion scale is a module-global uniform shared across
    // tests; pin it to full speed unless a test says otherwise.
    getReducedMotionTimeScale().value = 1;
  });

  // All ticks below use frame-scale deltas (<= 0.1s) so they stay under the
  // MAX_DELTA clamp; the clamp has its own dedicated test.
  it('accumulates speed x delta across ticks', () => {
    const scheduler = new FakeScheduler();
    const { result } = renderHook(() => useAnimatableSpeed(2), {
      wrapper: makeWrapper(scheduler),
    });

    scheduler.tick(0.05);
    scheduler.tick(0.05);
    expect(phaseOf(result)).toBeCloseTo(0.2);
  });

  it('does not jump the phase when the static speed changes', () => {
    const scheduler = new FakeScheduler();
    const { result, rerender } = renderHook(({ v }) => useAnimatableSpeed(v), {
      wrapper: makeWrapper(scheduler),
      initialProps: { v: 1 },
    });

    scheduler.tick(0.1);
    expect(phaseOf(result)).toBeCloseTo(0.1);

    rerender({ v: 3 });
    // The change itself must not move the phase — that is the whole bug.
    expect(phaseOf(result)).toBeCloseTo(0.1);

    scheduler.tick(0.1);
    expect(phaseOf(result)).toBeCloseTo(0.4);
  });

  it('follows a signal-driven speed', () => {
    const scheduler = new FakeScheduler();
    const { signal, set } = makeSignal(1);
    const { result } = renderHook(() => useAnimatableSpeed(signal), {
      wrapper: makeWrapper(scheduler),
    });

    scheduler.tick(0.1);
    expect(phaseOf(result)).toBeCloseTo(0.1);

    set(2);
    // A rate change alone moves nothing until time passes.
    expect(phaseOf(result)).toBeCloseTo(0.1);

    scheduler.tick(0.1);
    expect(phaseOf(result)).toBeCloseTo(0.3);
  });

  it('scales accumulation by the reduced-motion time scale', () => {
    const scheduler = new FakeScheduler();

    getReducedMotionTimeScale().value = 0.5;
    const { result } = renderHook(() => useAnimatableSpeed(2), {
      wrapper: makeWrapper(scheduler),
    });

    scheduler.tick(0.1);
    expect(phaseOf(result)).toBeCloseTo(0.1);
  });

  it('clamps a giant delta so a parked scene cannot leap forward', () => {
    const scheduler = new FakeScheduler();
    const { result } = renderHook(() => useAnimatableSpeed(1), {
      wrapper: makeWrapper(scheduler),
    });

    // A flush tick after a long park carries the whole idle span as delta.
    scheduler.tick(60);
    expect(phaseOf(result)).toBeCloseTo(0.1);
  });

  it('keeps the same uniform identity across re-renders', () => {
    const scheduler = new FakeScheduler();
    const { result, rerender } = renderHook(({ v }) => useAnimatableSpeed(v), {
      wrapper: makeWrapper(scheduler),
      initialProps: { v: 1 },
    });
    const first = result.current;

    rerender({ v: 2 });
    expect(result.current).toBe(first);
  });

  it('requests a render on every signal tick', () => {
    const scheduler = new FakeScheduler();
    const { signal, set } = makeSignal(1);

    renderHook(() => useAnimatableSpeed(signal), { wrapper: makeWrapper(scheduler) });

    scheduler.requestRender.mockClear();
    set(2);
    set(3);
    expect(scheduler.requestRender).toHaveBeenCalledTimes(2);
  });

  it('stops accumulating and unsubscribes on unmount', () => {
    const scheduler = new FakeScheduler();
    const { signal, set } = makeSignal(1);
    const { result, unmount } = renderHook(() => useAnimatableSpeed(signal), {
      wrapper: makeWrapper(scheduler),
    });

    scheduler.tick(0.1);
    expect(phaseOf(result)).toBeCloseTo(0.1);

    unmount();
    expect(scheduler.clients.size).toBe(0);

    scheduler.requestRender.mockClear();
    set(5);
    expect(scheduler.requestRender).not.toHaveBeenCalled();
  });

  it('leaves exactly one accumulator client after a Strict Mode double-mount', () => {
    const scheduler = new FakeScheduler();
    const { result } = renderHook(() => useAnimatableSpeed(1), {
      wrapper: makeStrictWrapper(scheduler),
    });

    scheduler.tick(0.1);
    // Two accumulators would double-count the same tick and land at 0.2.
    expect(phaseOf(result)).toBeCloseTo(0.1);
    expect(scheduler.clients.size).toBe(1);
  });

  it('zeroes the accumulated phase when the scheduler fires a phase reset', () => {
    const scheduler = new FakeScheduler();
    const { result } = renderHook(() => useAnimatableSpeed(1), {
      wrapper: makeWrapper(scheduler),
    });

    scheduler.tick(0.1);
    expect(phaseOf(result)).toBeCloseTo(0.1);

    scheduler.resetPhases();
    expect(phaseOf(result)).toBe(0);

    // The accumulator keeps integrating from the new epoch.
    scheduler.tick(0.05);
    expect(phaseOf(result)).toBeCloseTo(0.05);
  });

  it('unsubscribes its phase-reset listener on unmount', () => {
    const scheduler = new FakeScheduler();
    const { unmount } = renderHook(() => useAnimatableSpeed(1), {
      wrapper: makeWrapper(scheduler),
    });

    expect(scheduler.phaseResetListeners.size).toBe(1);
    unmount();
    expect(scheduler.phaseResetListeners.size).toBe(0);
  });

  it('leaves exactly one phase-reset listener after a Strict Mode double-mount', () => {
    const scheduler = new FakeScheduler();

    renderHook(() => useAnimatableSpeed(1), {
      wrapper: makeStrictWrapper(scheduler),
    });

    expect(scheduler.phaseResetListeners.size).toBe(1);
  });

  it('works outside a ShaderScene, where there is no scheduler', () => {
    const { result } = renderHook(() => useAnimatableSpeed(1));

    expect(phaseOf(result)).toBe(0);
  });
});

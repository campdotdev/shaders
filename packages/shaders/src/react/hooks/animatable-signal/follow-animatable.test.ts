import { describe, expect, it, vi } from 'vitest';

import type { AnimatableSignal } from './animatable-signal.js';
import { followAnimatable } from './follow-animatable.js';

const makeSignal = <T>(initial: T) => {
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

  return { signal, set, subscribers };
};

const makeScheduler = () => ({ requestRender: vi.fn(() => true) });

describe('followAnimatable', () => {
  it('applies a plain value once, pokes the scheduler, and returns no cleanup', () => {
    const apply = vi.fn();
    const scheduler = makeScheduler();

    const cleanup = followAnimatable(0.5, apply, scheduler);

    expect(apply).toHaveBeenCalledExactlyOnceWith(0.5);
    expect(scheduler.requestRender).toHaveBeenCalledOnce();
    expect(cleanup).toBeUndefined();
  });

  it('seeds from a signal before subscribing, then applies every tick', () => {
    const apply = vi.fn();
    const { signal, set } = makeSignal(0.1);
    const on = vi.spyOn(signal, 'on');

    followAnimatable(signal, apply, makeScheduler());
    expect(apply).toHaveBeenLastCalledWith(0.1);
    expect(apply).toHaveBeenCalledBefore(on);

    set(0.7);
    expect(apply).toHaveBeenLastCalledWith(0.7);
    expect(apply).toHaveBeenCalledTimes(2);
  });

  it('pokes the scheduler after every write, including the seed', () => {
    const scheduler = makeScheduler();
    const { signal, set } = makeSignal(0.1);
    const order: string[] = [];

    scheduler.requestRender.mockImplementation(() => {
      order.push('render');

      return true;
    });
    followAnimatable(signal, () => order.push('apply'), scheduler);
    set(0.2);

    expect(order).toEqual(['apply', 'render', 'apply', 'render']);
  });

  it('returns a cleanup that unsubscribes from the signal', () => {
    const apply = vi.fn();
    const scheduler = makeScheduler();
    const { signal, set, subscribers } = makeSignal(0.1);

    const cleanup = followAnimatable(signal, apply, scheduler);

    cleanup?.();
    expect(subscribers.size).toBe(0);

    apply.mockClear();
    scheduler.requestRender.mockClear();
    set(0.9);
    expect(apply).not.toHaveBeenCalled();
    expect(scheduler.requestRender).not.toHaveBeenCalled();
  });

  it('still applies values when there is no scheduler', () => {
    const apply = vi.fn();
    const { signal, set } = makeSignal(1);

    followAnimatable(signal, apply, undefined);
    set(2);

    expect(apply.mock.calls).toEqual([[1], [2]]);
  });
});

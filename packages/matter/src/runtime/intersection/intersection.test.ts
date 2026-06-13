import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createIntersectionWatcher } from './intersection.js';

interface MockObserver {
  callback: IntersectionObserverCallback;
  observed: Element[];
  disconnect: ReturnType<typeof vi.fn>;
}

describe('intersection watcher', () => {
  let observers: MockObserver[] = [];

  beforeEach(() => {
    observers = [];
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        callback: IntersectionObserverCallback;
        observed: Element[] = [];
        disconnect = vi.fn();
        constructor(callback: IntersectionObserverCallback) {
          this.callback = callback;
          observers.push(this);
        }
        observe(el: Element) {
          this.observed.push(el);
        }
        unobserve(el: Element) {
          this.observed = this.observed.filter((observedElement) => observedElement !== el);
        }
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reports the canvas as in-view by default until the first callback', () => {
    const canvas = document.createElement('canvas');
    const watcher = createIntersectionWatcher(canvas);

    expect(watcher.isInView()).toBe(true);
    watcher.dispose();
  });

  it('updates when the observer reports intersection', () => {
    const canvas = document.createElement('canvas');
    const watcher = createIntersectionWatcher(canvas);
    const listener = vi.fn();

    watcher.subscribe(listener);
    const observer = observers[0]!;

    observer.callback(
      [{ isIntersecting: false } as IntersectionObserverEntry],
      observer as unknown as IntersectionObserver,
    );
    expect(watcher.isInView()).toBe(false);
    expect(listener).toHaveBeenLastCalledWith(false);
    observer.callback(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      observer as unknown as IntersectionObserver,
    );
    expect(watcher.isInView()).toBe(true);
    expect(listener).toHaveBeenLastCalledWith(true);
    watcher.dispose();
  });

  it('disconnects on dispose', () => {
    const canvas = document.createElement('canvas');
    const watcher = createIntersectionWatcher(canvas);
    const observer = observers[0]!;

    watcher.dispose();
    expect(observer.disconnect).toHaveBeenCalledTimes(1);
  });

  it('survives a strict-mode create-dispose-recreate cycle', () => {
    const canvas = document.createElement('canvas');
    const firstWatcher = createIntersectionWatcher(canvas);
    const listener = vi.fn();

    firstWatcher.subscribe(listener);
    firstWatcher.dispose();

    const secondWatcher = createIntersectionWatcher(canvas);

    secondWatcher.subscribe(listener);
    // After firstWatcher disposal, only secondWatcher's observer should fire its callback
    const observer = observers[1]!; // secondWatcher's observer (observers[0] was firstWatcher's)

    observer.callback(
      [{ isIntersecting: false } as IntersectionObserverEntry],
      observer as unknown as IntersectionObserver,
    );
    expect(listener).toHaveBeenCalledTimes(1);
    secondWatcher.dispose();
  });
});

describe('intersection watcher — SSR fallback', () => {
  beforeEach(() => {
    vi.stubGlobal('IntersectionObserver', undefined);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns a no-op watcher when IntersectionObserver is undefined', () => {
    const canvas = document.createElement('canvas');
    const watcher = createIntersectionWatcher(canvas);

    expect(watcher.isInView()).toBe(true);
    const unsub = watcher.subscribe(() => {});

    unsub();
    watcher.dispose();
    // No throw — that's the contract.
  });
});

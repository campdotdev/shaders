import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createVisibilityWatcher } from './visibility.js';

describe('visibility watcher', () => {
  let listeners: Array<() => void> = [];
  let visibilityState = 'visible';

  beforeEach(() => {
    listeners = [];
    visibilityState = 'visible';
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => visibilityState,
    });
    vi.spyOn(document, 'addEventListener').mockImplementation((type, listener) => {
      if (type === 'visibilitychange') listeners.push(listener as () => void);
    });
    vi.spyOn(document, 'removeEventListener').mockImplementation((type, listener) => {
      if (type === 'visibilitychange') {
        const listenerIndex = listeners.indexOf(listener as () => void);

        if (listenerIndex >= 0) listeners.splice(listenerIndex, 1);
      }
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reports visible by default', () => {
    const watcher = createVisibilityWatcher();

    expect(watcher.isVisible()).toBe(true);
    watcher.dispose();
  });

  it('emits change when visibility flips to hidden and back', () => {
    const watcher = createVisibilityWatcher();
    const listener = vi.fn();

    watcher.subscribe(listener);
    visibilityState = 'hidden';
    listeners.forEach((documentListener) => documentListener());
    expect(listener).toHaveBeenLastCalledWith(false);
    visibilityState = 'visible';
    listeners.forEach((documentListener) => documentListener());
    expect(listener).toHaveBeenLastCalledWith(true);
    watcher.dispose();
  });

  it('removes the document listener on dispose', () => {
    const watcher = createVisibilityWatcher();

    expect(listeners.length).toBe(1);
    watcher.dispose();
    expect(listeners.length).toBe(0);
  });

  it('survives a strict-mode create-dispose-recreate cycle', () => {
    const firstWatcher = createVisibilityWatcher();
    const listener = vi.fn();

    firstWatcher.subscribe(listener);
    firstWatcher.dispose();
    expect(listeners.length).toBe(0);

    const secondWatcher = createVisibilityWatcher();

    secondWatcher.subscribe(listener);
    expect(listeners.length).toBe(1);
    // After firstWatcher disposal, only secondWatcher's callback should fire
    visibilityState = 'hidden';
    listeners.forEach((documentListener) => documentListener());
    expect(listener).toHaveBeenCalledTimes(1);
    secondWatcher.dispose();
  });
});

describe('visibility watcher — SSR fallback', () => {
  it('returns a no-op watcher when document is undefined', () => {
    vi.stubGlobal('document', undefined);
    try {
      const w = createVisibilityWatcher();

      expect(w.isVisible()).toBe(true);
      const unsub = w.subscribe(() => {});

      unsub();
      w.dispose();
      // No throw — that's the contract.
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

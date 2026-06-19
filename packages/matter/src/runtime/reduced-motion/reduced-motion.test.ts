import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createReducedMotionWatcher,
  getReducedMotionTimeScale,
  resetReducedMotionForTests,
  setReducedMotionPolicy,
} from './reduced-motion.js';

interface MockMQL {
  matches: boolean;
  listeners: Array<(e: { matches: boolean }) => void>;
  addEventListener: (type: 'change', listener: (e: { matches: boolean }) => void) => void;
  removeEventListener: (type: 'change', listener: (e: { matches: boolean }) => void) => void;
  dispatch: (matches: boolean) => void;
}

const makeMQL = (initial: boolean): MockMQL => {
  const listeners: MockMQL['listeners'] = [];

  return {
    get matches() {
      return initial;
    },
    set matches(value) {
      initial = value;
    },
    listeners,
    addEventListener: (_t, listener) => listeners.push(listener),
    removeEventListener: (_t, listener) => {
      const listenerIndex = listeners.indexOf(listener);

      if (listenerIndex >= 0) listeners.splice(listenerIndex, 1);
    },
    dispatch(matches) {
      this.matches = matches;
      // Snapshot before iterating: a listener may removeEventListener itself,
      // mutating `listeners` mid-loop and skipping the next entry.
      for (const listener of listeners.slice()) listener({ matches });
    },
  };
};

describe('reducedMotion watcher', () => {
  let mql: MockMQL;

  beforeEach(() => {
    mql = makeMQL(false);
    vi.stubGlobal('matchMedia', () => mql);
    setReducedMotionPolicy('auto');
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    setReducedMotionPolicy('auto');
  });

  it('returns scale 1 when system reduce is off and policy is auto', () => {
    const watcher = createReducedMotionWatcher();

    expect(watcher.scale()).toBe(1);
    watcher.dispose();
  });

  it('returns scale 0.3 when system reduce is on and policy is auto', () => {
    mql.matches = true;
    const watcher = createReducedMotionWatcher();

    expect(watcher.scale()).toBe(0.3);
    watcher.dispose();
  });

  it('emits change when matchMedia toggles', () => {
    const watcher = createReducedMotionWatcher();
    const listener = vi.fn();

    watcher.subscribe(listener);
    mql.dispatch(true);
    expect(listener).toHaveBeenCalledWith(0.3);
    mql.dispatch(false);
    expect(listener).toHaveBeenLastCalledWith(1);
    watcher.dispose();
  });

  it('honors explicit policy override "off" (scale 1)', () => {
    mql.matches = true;
    setReducedMotionPolicy('off');
    const watcher = createReducedMotionWatcher();

    expect(watcher.scale()).toBe(1);
    watcher.dispose();
  });

  it('honors explicit policy override "paused" (scale 0)', () => {
    setReducedMotionPolicy('paused');
    const watcher = createReducedMotionWatcher();

    expect(watcher.scale()).toBe(0);
    watcher.dispose();
  });

  it('honors explicit policy override "slow" (scale 0.3 regardless of mql)', () => {
    setReducedMotionPolicy('slow');
    const watcher = createReducedMotionWatcher();

    expect(watcher.scale()).toBe(0.3);
    watcher.dispose();
  });

  it('emits when policy changes', () => {
    const watcher = createReducedMotionWatcher();
    const listener = vi.fn();

    watcher.subscribe(listener);
    setReducedMotionPolicy('paused');
    expect(listener).toHaveBeenLastCalledWith(0);
    setReducedMotionPolicy('off');
    expect(listener).toHaveBeenLastCalledWith(1);
    watcher.dispose();
  });

  it('removes listeners on dispose', () => {
    const watcher = createReducedMotionWatcher();

    expect(mql.listeners.length).toBe(1);
    watcher.dispose();
    expect(mql.listeners.length).toBe(0);
  });

  it('survives a strict-mode create-dispose-recreate cycle', () => {
    const firstWatcher = createReducedMotionWatcher();
    const listener = vi.fn();

    firstWatcher.subscribe(listener);
    firstWatcher.dispose();

    const secondWatcher = createReducedMotionWatcher();

    secondWatcher.subscribe(listener);
    setReducedMotionPolicy('paused');
    // Only secondWatcher is live; listener should be called exactly once (from secondWatcher's recompute).
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenLastCalledWith(0);
    secondWatcher.dispose();
  });
});

describe('reducedMotion watcher — SSR fallback', () => {
  beforeEach(() => {
    setReducedMotionPolicy('auto');
    vi.stubGlobal('matchMedia', undefined);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    setReducedMotionPolicy('auto');
  });

  it('returns a no-op watcher when matchMedia is undefined', () => {
    const watcher = createReducedMotionWatcher();

    expect(watcher.scale()).toBe(1);
    const listener = vi.fn();
    const unsub = watcher.subscribe(listener);

    unsub();
    watcher.dispose();
    // No throw, no error — that's the contract.
  });

  it('respects policy override on the SSR watcher', () => {
    setReducedMotionPolicy('paused');
    const watcher = createReducedMotionWatcher();

    expect(watcher.scale()).toBe(0);
    setReducedMotionPolicy('slow');
    // Note: SSR watcher does not emit on policy change (it's not in state.watchers).
    // But scale() at the time of next call should reflect the latest policy.
    expect(watcher.scale()).toBe(0.3);
    watcher.dispose();
  });
});

describe('reducedMotion uniform', () => {
  beforeEach(() => {
    resetReducedMotionForTests();
    vi.stubGlobal('matchMedia', () => ({
      matches: false,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    setReducedMotionPolicy('auto');
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    resetReducedMotionForTests();
    setReducedMotionPolicy('auto');
  });

  it('exposes a TSL uniform whose value matches the current scale', () => {
    const timeScaleUniform = getReducedMotionTimeScale();

    setReducedMotionPolicy('slow');
    expect((timeScaleUniform as unknown as { value: number }).value).toBe(0.3);
  });

  it('updates the uniform value when policy changes', () => {
    const timeScaleUniform = getReducedMotionTimeScale();

    setReducedMotionPolicy('off');
    expect((timeScaleUniform as unknown as { value: number }).value).toBe(1);
    setReducedMotionPolicy('paused');
    expect((timeScaleUniform as unknown as { value: number }).value).toBe(0);
  });
});

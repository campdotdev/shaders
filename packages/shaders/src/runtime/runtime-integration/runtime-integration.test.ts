import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FrameScheduler } from '../frame-scheduler/frame-scheduler.js';
import { createIntersectionWatcher } from '../intersection/intersection.js';
import { createVisibilityWatcher } from '../visibility/visibility.js';

describe('runtime integration', () => {
  let rafCallbacks: FrameRequestCallback[] = [];
  let nextRafId = 0;
  let visibilityState = 'visible';
  const visibilityListeners: Array<() => void> = [];
  let observerCallback: IntersectionObserverCallback | null = null;

  beforeEach(() => {
    rafCallbacks = [];
    nextRafId = 0;
    visibilityState = 'visible';
    visibilityListeners.length = 0;
    observerCallback = null;

    vi.stubGlobal('requestAnimationFrame', (frameCallback: FrameRequestCallback) => {
      rafCallbacks.push(frameCallback);

      return ++nextRafId;
    });
    vi.stubGlobal('cancelAnimationFrame', () => {});

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => visibilityState,
    });
    vi.spyOn(document, 'addEventListener').mockImplementation((type, listener) => {
      if (type === 'visibilitychange') visibilityListeners.push(listener as () => void);
    });
    vi.spyOn(document, 'removeEventListener').mockImplementation((type, listener) => {
      if (type === 'visibilitychange') {
        const listenerIndex = visibilityListeners.indexOf(listener as () => void);

        if (listenerIndex >= 0) visibilityListeners.splice(listenerIndex, 1);
      }
    });

    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(callback: IntersectionObserverCallback) {
          observerCallback = callback;
        }
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const tickFrame = (now = performance.now()) => {
    const callbacks = rafCallbacks;

    rafCallbacks = [];
    for (const frameCallback of callbacks) frameCallback(now);
  };

  it('combined gates: scene only ticks when visible AND in-view AND not idle', () => {
    const scheduler = new FrameScheduler();
    const client = vi.fn();

    scheduler.add(client);
    scheduler.start();

    const visibility = createVisibilityWatcher();
    const canvas = document.createElement('canvas');
    const intersection = createIntersectionWatcher(canvas);

    const update = () => {
      const should = visibility.isVisible() && intersection.isInView();

      if (should) scheduler.resume();
      else scheduler.pause();
    };

    visibility.subscribe(update);
    intersection.subscribe(update);
    update();

    tickFrame(0);
    expect(client).toHaveBeenCalledTimes(1);

    // Tab hidden → pause
    visibilityState = 'hidden';
    visibilityListeners.forEach((visibilityListener) => visibilityListener());
    tickFrame(16);
    expect(client).toHaveBeenCalledTimes(1);

    // Tab visible again → resume
    visibilityState = 'visible';
    visibilityListeners.forEach((visibilityListener) => visibilityListener());
    tickFrame(32);
    expect(client).toHaveBeenCalledTimes(2);

    // Canvas offscreen → pause
    observerCallback!([{ isIntersecting: false } as IntersectionObserverEntry], null as never);
    tickFrame(48);
    expect(client).toHaveBeenCalledTimes(2);

    // Canvas back in view → resume
    observerCallback!([{ isIntersecting: true } as IntersectionObserverEntry], null as never);
    tickFrame(64);
    expect(client).toHaveBeenCalledTimes(3);

    // Idle → final flush, then halt
    scheduler.setIdle(true);
    tickFrame(80); // flush
    expect(client).toHaveBeenCalledTimes(4);
    tickFrame(96); // no tick
    expect(client).toHaveBeenCalledTimes(4);

    // Wake via requestRender
    scheduler.requestRender();
    tickFrame(112);
    expect(client).toHaveBeenCalledTimes(5);
  });

  it('frame cap: limits a visible scene, and leaves the pause gates alone', () => {
    const scheduler = new FrameScheduler();
    const client = vi.fn();

    scheduler.setMaxFPS(30);
    scheduler.add(client);
    scheduler.start();

    const canvas = document.createElement('canvas');
    const intersection = createIntersectionWatcher(canvas);

    intersection.subscribe(() => {
      if (intersection.isInView()) scheduler.resume();
      else scheduler.pause();
    });

    // A 60 Hz display under a 30 cap ticks on every other frame.
    tickFrame(1000);
    tickFrame(1016.7);
    tickFrame(1033.3);
    expect(client).toHaveBeenCalledTimes(2);

    // Canvas offscreen → pause, and a new cap does not resume it
    observerCallback!([{ isIntersecting: false } as IntersectionObserverEntry], null as never);
    scheduler.setMaxFPS(60);
    tickFrame(1050);
    tickFrame(1066.7);
    expect(client).toHaveBeenCalledTimes(2);

    // Canvas back in view → resume under the new cap, on every frame
    observerCallback!([{ isIntersecting: true } as IntersectionObserverEntry], null as never);
    tickFrame(5000);
    tickFrame(5016.7);
    expect(client).toHaveBeenCalledTimes(4);
  });
});

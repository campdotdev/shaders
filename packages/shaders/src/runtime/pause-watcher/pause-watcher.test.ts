import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FrameScheduler } from '../frame-scheduler/frame-scheduler.js';
import { createPauseWatcher } from './pause-watcher.js';

interface MockObserver {
  callback: IntersectionObserverCallback;
  disconnect: ReturnType<typeof vi.fn>;
}

describe('createPauseWatcher', () => {
  let observers: MockObserver[] = [];

  beforeEach(() => {
    observers = [];
    vi.stubGlobal('requestAnimationFrame', () => 0);
    vi.stubGlobal('cancelAnimationFrame', () => {});
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        callback: IntersectionObserverCallback;
        disconnect = vi.fn();
        constructor(callback: IntersectionObserverCallback) {
          this.callback = callback;
          observers.push(this);
        }
        observe() {}
        unobserve() {}
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const fireIntersection = (isIntersecting: boolean) => {
    const observer = observers[0];

    if (!observer) throw new Error('no IntersectionObserver was created');
    observer.callback(
      [{ isIntersecting } as IntersectionObserverEntry],
      observer as unknown as IntersectionObserver,
    );
  };

  it('resumes while the tab is visible and the canvas is in view', () => {
    const scheduler = new FrameScheduler();
    const resume = vi.spyOn(scheduler, 'resume');

    createPauseWatcher(document.createElement('canvas'), scheduler);

    expect(resume).toHaveBeenCalled();
  });

  it('pauses when the canvas leaves the viewport and resumes when it returns', () => {
    const scheduler = new FrameScheduler();
    const pause = vi.spyOn(scheduler, 'pause');
    const resume = vi.spyOn(scheduler, 'resume');

    createPauseWatcher(document.createElement('canvas'), scheduler);
    pause.mockClear();
    resume.mockClear();

    fireIntersection(false);
    expect(pause).toHaveBeenCalledTimes(1);

    fireIntersection(true);
    expect(resume).toHaveBeenCalledTimes(1);
  });

  it('releases the observer on dispose', () => {
    const scheduler = new FrameScheduler();
    const watcher = createPauseWatcher(document.createElement('canvas'), scheduler);

    watcher.dispose();
    expect(observers[0]?.disconnect).toHaveBeenCalled();
  });
});

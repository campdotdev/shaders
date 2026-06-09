import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FrameScheduler } from './frame-scheduler.js';

/** Stubs requestAnimationFrame/cancelAnimationFrame and returns shared state for tests. */
function setupRafMocks() {
  let rafCallbacks: FrameRequestCallback[] = [];
  let nextRafId = 0;

  beforeEach(() => {
    rafCallbacks = [];
    nextRafId = 0;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafCallbacks.push(cb);

      return ++nextRafId;
    });
    vi.stubGlobal('cancelAnimationFrame', () => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** Drive one frame: invoke every queued rAF callback exactly once. */
  const tickFrame = (now = performance.now()) => {
    const callbacks = rafCallbacks;

    rafCallbacks = [];
    for (const cb of callbacks) cb(now);
  };

  return {
    getRafCallbacks: () => rafCallbacks,
    tickFrame,
  };
}

describe('FrameScheduler', () => {
  const { getRafCallbacks, tickFrame } = setupRafMocks();

  it('invokes registered clients on every tick', () => {
    const scheduler = new FrameScheduler();
    const client = vi.fn();

    scheduler.add(client);
    scheduler.start();

    tickFrame(0);
    tickFrame(16);
    tickFrame(32);

    expect(client).toHaveBeenCalledTimes(3);
  });

  it('does not invoke removed clients', () => {
    const scheduler = new FrameScheduler();
    const client = vi.fn();

    scheduler.add(client);
    scheduler.start();
    tickFrame(0);
    expect(client).toHaveBeenCalledTimes(1);

    scheduler.remove(client);
    tickFrame(16);
    expect(client).toHaveBeenCalledTimes(1); // unchanged
  });

  it('passes the timestamp delta (in seconds) to each client', () => {
    const scheduler = new FrameScheduler();
    const client = vi.fn();

    scheduler.add(client);
    scheduler.start();

    tickFrame(1000); // first frame establishes the baseline
    tickFrame(1016); // 16ms later

    expect(client).toHaveBeenLastCalledWith(expect.objectContaining({ delta: 0.016 }));
  });

  it('stops invoking clients after pause()', () => {
    const scheduler = new FrameScheduler();
    const client = vi.fn();

    scheduler.add(client);
    scheduler.start();
    tickFrame(0);
    expect(client).toHaveBeenCalledTimes(1);

    scheduler.pause();
    tickFrame(16);
    expect(client).toHaveBeenCalledTimes(1); // paused, no call
  });

  it('resumes invoking clients after resume()', () => {
    const scheduler = new FrameScheduler();
    const client = vi.fn();

    scheduler.add(client);
    scheduler.start();
    scheduler.pause();
    scheduler.resume();
    tickFrame(0);
    expect(client).toHaveBeenCalledTimes(1);
  });

  it('does not start the rAF loop when no clients are registered', () => {
    const scheduler = new FrameScheduler();

    scheduler.start();
    expect(getRafCallbacks().length).toBe(0);
  });

  it('starts the rAF loop when the first client is added', () => {
    const scheduler = new FrameScheduler();

    scheduler.start();
    scheduler.add(vi.fn());
    expect(getRafCallbacks().length).toBe(1);
  });
});

describe('setIdle (render-on-demand)', () => {
  const { tickFrame } = setupRafMocks();

  it('runs one final tick when setIdle(true) is called, then halts', () => {
    const scheduler = new FrameScheduler();
    const client = vi.fn();

    scheduler.add(client);
    scheduler.start();
    tickFrame(0);
    tickFrame(16);
    expect(client).toHaveBeenCalledTimes(2);

    scheduler.setIdle(true);
    tickFrame(32); // final flush tick
    expect(client).toHaveBeenCalledTimes(3);
    tickFrame(48); // no further ticks
    expect(client).toHaveBeenCalledTimes(3);
    tickFrame(64);
    expect(client).toHaveBeenCalledTimes(3);
  });

  it('resumes ticking when setIdle(false) is called', () => {
    const scheduler = new FrameScheduler();
    const client = vi.fn();

    scheduler.add(client);
    scheduler.start();
    scheduler.setIdle(true);
    tickFrame(0); // final flush
    expect(client).toHaveBeenCalledTimes(1);
    tickFrame(16); // no tick (idle)
    expect(client).toHaveBeenCalledTimes(1);

    scheduler.setIdle(false);
    tickFrame(32);
    expect(client).toHaveBeenCalledTimes(2);
    tickFrame(48);
    expect(client).toHaveBeenCalledTimes(3);
  });

  it('requestRender() forces one tick while idle', () => {
    const scheduler = new FrameScheduler();
    const client = vi.fn();

    scheduler.add(client);
    scheduler.start();
    scheduler.setIdle(true);
    tickFrame(0);
    expect(client).toHaveBeenCalledTimes(1);
    tickFrame(16);
    expect(client).toHaveBeenCalledTimes(1);

    scheduler.requestRender();
    tickFrame(32);
    expect(client).toHaveBeenCalledTimes(2);
    tickFrame(48); // back to idle
    expect(client).toHaveBeenCalledTimes(2);
  });

  it('does not halt when an animated vote counteracts a static vote', () => {
    const scheduler = new FrameScheduler();
    const client = vi.fn();

    scheduler.add(client);
    scheduler.start();

    const releaseStatic = scheduler.setIdle(true);
    const releaseAnimated = scheduler.setIdle(false);

    tickFrame(0);
    tickFrame(16);
    tickFrame(32);

    expect(client).toHaveBeenCalledTimes(3);

    releaseAnimated();
    tickFrame(48); // final flush after animated vote removed
    expect(client).toHaveBeenCalledTimes(4);
    tickFrame(64); // halted — static vote wins now
    expect(client).toHaveBeenCalledTimes(4);

    releaseStatic();
    tickFrame(80); // no more votes → runs again
    expect(client).toHaveBeenCalledTimes(5);
  });
});

describe('dispose invariants', () => {
  let rafCallbacks: FrameRequestCallback[] = [];
  let nextRafId = 0;
  let cancelled: number[] = [];

  beforeEach(() => {
    rafCallbacks = [];
    nextRafId = 0;
    cancelled = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafCallbacks.push(cb);

      return ++nextRafId;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      cancelled.push(id);
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('cancels the pending rAF on dispose', () => {
    const scheduler = new FrameScheduler();

    scheduler.add(vi.fn());
    scheduler.start();
    expect(rafCallbacks.length).toBe(1);
    scheduler.dispose();
    expect(cancelled.length).toBe(1);
  });

  it('does not invoke clients after dispose', () => {
    const scheduler = new FrameScheduler();
    const client = vi.fn();

    scheduler.add(client);
    scheduler.start();
    scheduler.dispose();
    // even if a leftover rAF callback fires, client should not be called
    rafCallbacks.forEach((cb) => cb(performance.now()));
    expect(client).not.toHaveBeenCalled();
  });
});

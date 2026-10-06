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

  // A paused scene is frozen, so the time it spends paused must not reach
  // the clients: the first tick after a resume carries no delta, and elapsed
  // counts only the time the scheduler ran.
  it('leaves the paused gap out of delta and elapsed', () => {
    const scheduler = new FrameScheduler();
    const client = vi.fn();

    scheduler.add(client);
    scheduler.start();
    tickFrame(1000);
    tickFrame(1016);

    scheduler.pause();
    scheduler.resume();
    tickFrame(9000);
    expect(client).toHaveBeenLastCalledWith(expect.objectContaining({ delta: 0, elapsed: 0.016 }));

    tickFrame(9016);
    expect(client).toHaveBeenLastCalledWith(
      expect.objectContaining({ delta: 0.016, elapsed: 0.032 }),
    );
  });

  // The pause watcher calls resume() on every visibility change, paused or
  // not, and a scheduler that is already running must keep its timing.
  it('keeps its timing when resume() runs while not paused', () => {
    const scheduler = new FrameScheduler();
    const client = vi.fn();

    scheduler.add(client);
    scheduler.start();
    tickFrame(1000);
    scheduler.resume();
    tickFrame(1016);

    expect(client).toHaveBeenLastCalledWith(expect.objectContaining({ delta: 0.016 }));
  });

  it('tells pause listeners when it pauses and resumes, once per change', () => {
    const scheduler = new FrameScheduler();
    const listener = vi.fn();
    const unsubscribe = scheduler.onPauseChange(listener);

    scheduler.start();
    scheduler.resume();
    expect(listener).not.toHaveBeenCalled();

    scheduler.pause();
    scheduler.pause();
    expect(listener.mock.calls).toEqual([[true]]);

    scheduler.resume();
    scheduler.resume();
    expect(listener.mock.calls).toEqual([[true], [false]]);

    unsubscribe();
    scheduler.pause();
    expect(listener).toHaveBeenCalledTimes(2);
  });

  // A start() that ends a pause is a resume too, so a clock that holds its
  // time while paused hears of it, and the paused gap stays out of the tick.
  it('resumes, telling pause listeners, when start() runs while paused', () => {
    const scheduler = new FrameScheduler();
    const client = vi.fn();
    const listener = vi.fn();

    scheduler.onPauseChange(listener);
    scheduler.add(client);
    scheduler.start();
    tickFrame(1000);
    tickFrame(1016);

    scheduler.pause();
    scheduler.stop();
    scheduler.start();
    tickFrame(9000);

    expect(listener.mock.calls).toEqual([[true], [false]]);
    expect(client).toHaveBeenLastCalledWith(expect.objectContaining({ delta: 0, elapsed: 0.016 }));
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

    expect(scheduler.requestRender()).toBe(true);
    expect(scheduler.requestRender()).toBe(false);
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

describe('setMaxFPS (frame cap)', () => {
  const { getRafCallbacks, tickFrame } = setupRafMocks();

  // Animation frame timestamps of a 120 Hz display, in milliseconds, from
  // the given frame number on.
  const at120Hz = (frameNumber: number) => 1000 + (frameNumber * 1000) / 120;

  it('runs its clients on every other animation frame at 120 Hz under a 60 cap', () => {
    const scheduler = new FrameScheduler();
    const client = vi.fn();

    scheduler.setMaxFPS(60);
    scheduler.add(client);
    scheduler.start();
    for (let frameNumber = 0; frameNumber < 8; frameNumber += 1) tickFrame(at120Hz(frameNumber));

    expect(client.mock.calls.map(([tick]) => tick.now)).toEqual([
      at120Hz(0),
      at120Hz(2),
      at120Hz(4),
      at120Hz(6),
    ]);
  });

  // With no frame cap a scene draws at the display's refresh rate, and a
  // value that names no cap behaves the same.
  it.each([undefined, 0, -30, Number.NaN, Number.POSITIVE_INFINITY])(
    'runs its clients on every animation frame with a cap of %s',
    (maxFPS) => {
      const scheduler = new FrameScheduler();
      const client = vi.fn();

      scheduler.setMaxFPS(maxFPS);
      scheduler.add(client);
      scheduler.start();
      for (let frameNumber = 0; frameNumber < 4; frameNumber += 1) tickFrame(at120Hz(frameNumber));

      expect(client).toHaveBeenCalledTimes(4);
    },
  );

  // Timestamps jitter, and some browsers round them to the millisecond, so
  // a frame a hair under one interval after the last still ticks.
  it('ticks on a frame that arrives a little early', () => {
    const scheduler = new FrameScheduler();
    const client = vi.fn();

    scheduler.setMaxFPS(60);
    scheduler.add(client);
    scheduler.start();
    tickFrame(1000);
    tickFrame(1016);
    tickFrame(1033);

    expect(client).toHaveBeenCalledTimes(3);
  });

  // A cap that does not divide the refresh rate waits for the first frame
  // after its interval, so a 100 cap at 120 Hz ticks less often than asked
  // rather than on every frame.
  it('ticks on every other frame at 120 Hz under a 100 cap', () => {
    const scheduler = new FrameScheduler();
    const client = vi.fn();

    scheduler.setMaxFPS(100);
    scheduler.add(client);
    scheduler.start();
    for (let frameNumber = 0; frameNumber < 6; frameNumber += 1) tickFrame(at120Hz(frameNumber));

    expect(client.mock.calls.map(([tick]) => tick.now)).toEqual([
      at120Hz(0),
      at120Hz(2),
      at120Hz(4),
    ]);
  });

  // Speed-driven phases add speed x delta each tick, so delta must span the
  // skipped frames for a capped scene to keep its pace.
  it('measures delta from the last tick, across skipped frames', () => {
    const scheduler = new FrameScheduler();
    const client = vi.fn();

    scheduler.setMaxFPS(60);
    scheduler.add(client);
    scheduler.start();
    tickFrame(at120Hz(0));
    tickFrame(at120Hz(1));
    tickFrame(at120Hz(2));

    expect(client).toHaveBeenCalledTimes(2);
    expect(client.mock.lastCall?.[0].delta).toBeCloseTo(1 / 60);
  });

  it('holds a frame that requestRender() asks for until the cap allows it', () => {
    const scheduler = new FrameScheduler();
    const client = vi.fn();

    scheduler.setMaxFPS(60);
    scheduler.add(client);
    scheduler.start();
    scheduler.setIdle(true);
    tickFrame(at120Hz(0)); // the idle flush
    expect(client).toHaveBeenCalledTimes(1);

    scheduler.requestRender();
    tickFrame(at120Hz(1)); // too soon after the flush
    expect(client).toHaveBeenCalledTimes(1);
    tickFrame(at120Hz(2));
    expect(client).toHaveBeenCalledTimes(2);
    tickFrame(at120Hz(3)); // parked again
    tickFrame(at120Hz(4));
    expect(client).toHaveBeenCalledTimes(2);
  });

  it('never wakes a parked loop', () => {
    const scheduler = new FrameScheduler();
    const client = vi.fn();

    scheduler.add(client);
    scheduler.start();
    scheduler.setIdle(true);
    tickFrame(1000); // the idle flush, then the loop parks
    expect(getRafCallbacks()).toHaveLength(0);

    scheduler.setMaxFPS(30);
    scheduler.setMaxFPS(undefined);

    expect(getRafCallbacks()).toHaveLength(0);
  });

  it('never resumes a paused loop', () => {
    const scheduler = new FrameScheduler();
    const client = vi.fn();

    scheduler.add(client);
    scheduler.start();
    tickFrame(1000);
    scheduler.pause();
    scheduler.setMaxFPS(30);
    scheduler.setMaxFPS(undefined);
    tickFrame(2000);

    expect(client).toHaveBeenCalledTimes(1);
  });

  // The pause watcher can pause and resume within one frame, as a canvas
  // scrolls out of view and straight back, and that must not let a frame
  // tick early.
  it('holds the first frame after a short pause to the cap', () => {
    const scheduler = new FrameScheduler();
    const client = vi.fn();

    scheduler.setMaxFPS(60);
    scheduler.add(client);
    scheduler.start();
    tickFrame(at120Hz(0));
    scheduler.pause();
    scheduler.resume();
    tickFrame(at120Hz(1));
    expect(client).toHaveBeenCalledTimes(1);

    tickFrame(at120Hz(2));
    expect(client).toHaveBeenCalledTimes(2);
  });

  it('applies a new cap to a running loop from the next frame', () => {
    const scheduler = new FrameScheduler();
    const client = vi.fn();

    scheduler.setMaxFPS(60);
    scheduler.add(client);
    scheduler.start();
    tickFrame(at120Hz(0));
    tickFrame(at120Hz(1)); // skipped under the 60 cap

    scheduler.setMaxFPS(undefined);
    tickFrame(at120Hz(2));
    tickFrame(at120Hz(3));

    scheduler.setMaxFPS(30);
    for (let frameNumber = 4; frameNumber < 12; frameNumber += 1) tickFrame(at120Hz(frameNumber));

    expect(client.mock.calls.map(([tick]) => tick.now)).toEqual([
      at120Hz(0),
      at120Hz(2),
      at120Hz(3),
      at120Hz(7),
      at120Hz(11),
    ]);
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

describe('FrameScheduler phase reset', () => {
  it('invokes registered phase-reset listeners on resetPhases()', () => {
    const scheduler = new FrameScheduler();
    const listener = vi.fn();

    scheduler.onPhaseReset(listener);
    scheduler.resetPhases();

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('does not invoke a phase-reset listener after its unsubscribe runs', () => {
    const scheduler = new FrameScheduler();
    const listener = vi.fn();

    const unsubscribe = scheduler.onPhaseReset(listener);

    unsubscribe();
    scheduler.resetPhases();

    expect(listener).not.toHaveBeenCalled();
  });

  it('drops phase-reset listeners on dispose', () => {
    const scheduler = new FrameScheduler();
    const listener = vi.fn();

    scheduler.onPhaseReset(listener);
    scheduler.dispose();
    scheduler.resetPhases();

    expect(listener).not.toHaveBeenCalled();
  });
});

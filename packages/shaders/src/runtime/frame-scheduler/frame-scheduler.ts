// The heart of Shaders' render-on-demand system: one requestAnimationFrame
// loop per scene, with clients (render callbacks) ticked every frame, or
// every frame the scene's frame cap allows (setMaxFPS). The interesting part
// is that the loop can STOP — components vote on whether anything is
// animating (setIdle), and when the votes say "all static" the scheduler
// runs one last flush tick (so the final state lands on screen) and then
// queues nothing until a vote changes or requestRender() pokes it.
// Its companions: visibility.ts pauses the loop when the tab is hidden,
// intersection.ts when the canvas scrolls out of view.

export interface SchedulerTick {
  /** Seconds since the previous tick. */
  delta: number;
  /** Seconds the scheduler has run since its first tick, not counting pauses. */
  elapsed: number;
  /** The rAF timestamp, in milliseconds. */
  now: number;
}

export type SchedulerClient = (tick: SchedulerTick) => void;

// How early a frame may arrive and still tick under a frame cap, as a
// fraction of the cap's interval. Animation frame timestamps jitter, and
// some browsers round them to the whole millisecond, so the frame one
// interval after the last can read short. Without the slack, a 60 cap on a
// 120 Hz display would skip that frame now and then and stutter. The slack
// also rounds up a cap that sits just under a divisor of the refresh rate:
// at 0.1, a 110 cap on a 120 Hz display ticks on every frame. A larger
// value rounds up caps that sit further below a divisor.
const FRAME_CAP_TOLERANCE = 0.1;

export class FrameScheduler {
  private readonly clients = new Set<SchedulerClient>();
  private readonly phaseResetListeners = new Set<() => void>();
  private readonly pauseListeners = new Set<(paused: boolean) => void>();
  private rafId: number | null = null;
  private running = false;
  private paused = false;
  private flushPending = false;
  private startedAt = 0;
  private lastTickAt = 0;
  // Set by a resume() that ends a pause, so the next tick can drop the gap.
  private resumedFromPause = false;
  // The frame cap as the shortest time between two ticks, in milliseconds,
  // tolerance included. 0 means no frame cap, so every animation frame ticks.
  private minTickGap = 0;

  // Reference-counted idle voting. The scheduler is idle only when at least
  // one component has voted idle AND no component has voted animated. This
  // prevents a static component (e.g. LinearGradient speed=0) from halting
  // the loop while an animated overlay (e.g. Grain) is still running.
  private idleVotes = 0;
  private animatedVotes = 0;

  /** True when all participating components prefer idle and none need animation. */
  get idle(): boolean {
    return this.idleVotes > 0 && this.animatedVotes === 0;
  }

  /**
   * Activate the scheduler. The rAF loop starts on the first client added.
   * A start() while paused also resumes, the way resume() does.
   */
  start(): void {
    this.running = true;
    this.resume();
    this.maybeQueue();
  }

  /** Halt the rAF loop entirely. Use dispose() for permanent teardown. */
  stop(): void {
    this.running = false;
    this.cancel();
  }

  /**
   * Temporarily skip ticks without losing client registrations. Pause
   * listeners hear of it. A pause() while already paused changes nothing.
   */
  pause(): void {
    if (this.paused) return;
    this.paused = true;
    for (const listener of this.pauseListeners) listener(true);
  }

  /**
   * Resume after pause(). The time spent paused never reaches the clients,
   * and pause listeners hear of it. A resume() while not paused, which the
   * pause watcher sends on every visibility change, changes nothing.
   */
  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    this.resumedFromPause = true;
    for (const listener of this.pauseListeners) listener(false);
    if (this.running) this.maybeQueue();
  }

  /**
   * Register a callback for when the scheduler pauses (true) or resumes
   * (false). Returns the unsubscribe. A clock the scheduler does not own,
   * such as the renderer's, listens here to hold its time while paused.
   */
  onPauseChange(listener: (paused: boolean) => void): () => void {
    this.pauseListeners.add(listener);

    return () => {
      this.pauseListeners.delete(listener);
    };
  }

  /**
   * Set the frame cap, the most ticks per second. The loop skips an
   * animation frame that arrives sooner than one interval after its last
   * tick, so a 60 cap ticks on every other frame of a 120 Hz display.
   * Frames that requestRender() asks for count against the cap. Undefined,
   * zero, a negative number, or a non-finite number removes the cap. The cap
   * applies from the next animation frame, and never wakes a parked or
   * paused loop.
   */
  setMaxFPS(maxFPS: number | undefined): void {
    const capped = maxFPS !== undefined && Number.isFinite(maxFPS) && maxFPS > 0;

    this.minTickGap = capped ? (1000 / maxFPS) * (1 - FRAME_CAP_TOLERANCE) : 0;
  }

  /** Register a client to be called on every tick. */
  add(client: SchedulerClient): void {
    this.clients.add(client);
    if (this.running) this.maybeQueue();
  }

  /** Unregister a client. */
  remove(client: SchedulerClient): void {
    this.clients.delete(client);
  }

  /** Permanent teardown: stop the loop and drop all clients. */
  dispose(): void {
    this.stop();
    this.clients.clear();
    this.phaseResetListeners.clear();
    this.pauseListeners.clear();
  }

  /**
   * Register a callback for `resetPhases()`. Returns the unsubscribe.
   *
   * Phase accumulators (useAnimatableSpeed) integrate wall-clock deltas into
   * uniforms the scheduler cannot see, so the scheduler brokers resets
   * instead of performing them: each accumulator registers here and zeroes
   * its own state when asked.
   */
  onPhaseReset(listener: () => void): () => void {
    this.phaseResetListeners.add(listener);

    return () => {
      this.phaseResetListeners.delete(listener);
    };
  }

  /**
   * Rewind every registered phase accumulator to zero. The visual-test
   * harness calls this alongside the renderer clock reset so a captured
   * frame renders at a reproducible time origin — accumulated phase is
   * wall-clock history, and without the rewind no two machines capture the
   * same frame.
   */
  resetPhases(): void {
    for (const listener of this.phaseResetListeners) listener();
  }

  /**
   * Cast a vote on whether the scheduler should be idle.
   *
   * `setIdle(true)` increments the idle-vote count; the returned cleanup
   * decrements it. `setIdle(false)` increments the animated-vote count;
   * its cleanup decrements that. The scheduler halts (after one flush tick)
   * only when `idleVotes > 0 && animatedVotes === 0`.
   *
   * Callers are responsible for calling the returned cleanup on unmount.
   * Use `requestRender()` or cast a `setIdle(false)` vote to wake the loop
   * without permanently registering an animated preference.
   */
  setIdle(idle: boolean): () => void {
    if (idle) {
      const wasIdle = this.idle;

      this.idleVotes += 1;
      const nowIdle = this.idle;

      if (!wasIdle && nowIdle) this.onBecameIdle();

      return () => {
        const prevIdle = this.idle;

        this.idleVotes = Math.max(0, this.idleVotes - 1);
        const afterIdle = this.idle;

        if (prevIdle && !afterIdle) this.onBecameAnimated();
      };
    } else {
      const wasIdle = this.idle;

      this.animatedVotes += 1;
      if (wasIdle) this.onBecameAnimated();

      return () => {
        const prevIdle = this.idle;

        this.animatedVotes = Math.max(0, this.animatedVotes - 1);
        const nowIdle = this.idle;

        if (!prevIdle && nowIdle) this.onBecameIdle();
      };
    }
  }

  /**
   * Force a single tick while idle. Useful for prop-change invalidation.
   * Returns true when this request starts a new idle flush rather than
   * extending one that is already queued.
   */
  requestRender(): boolean {
    if (!this.idle) return false;
    const startedIdleFlush = !this.flushPending;

    this.flushPending = true;
    this.maybeQueue();

    return startedIdleFlush;
  }

  private onBecameIdle(): void {
    this.flushPending = true;
    this.maybeQueue();
  }

  private onBecameAnimated(): void {
    this.flushPending = false;
    this.maybeQueue();
  }

  private maybeQueue(): void {
    if (this.rafId !== null) return;
    if (!this.running) return;
    if (this.clients.size === 0) return;
    if (this.idle && !this.flushPending) return;
    this.rafId = requestAnimationFrame(this.frame);
  }

  private cancel(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  /**
   * Whether a frame arrives too soon after the last tick for the frame cap.
   * The first tick always runs. A frame after a pause compares against the
   * last tick before it, so a short pause cannot slip in an extra tick.
   */
  private arrivesTooSoonForFrameCap(now: number): boolean {
    if (this.minTickGap === 0 || this.startedAt === 0) return false;

    return now - this.lastTickAt < this.minTickGap;
  }

  private readonly frame = (now: number): void => {
    this.rafId = null;
    if (!this.running || this.paused) return;
    // A skipped frame leaves the loop as it was: a pending idle flush stays
    // pending, so it ticks on the next frame the cap allows.
    if (this.arrivesTooSoonForFrameCap(now)) {
      this.maybeQueue();

      return;
    }

    if (this.startedAt === 0) {
      this.startedAt = now;
      this.lastTickAt = now;
    }
    // The first tick after a pause: move both origins forward by the gap,
    // so delta is 0 and elapsed picks up where the last tick left it.
    if (this.resumedFromPause) {
      this.resumedFromPause = false;
      this.startedAt += now - this.lastTickAt;
      this.lastTickAt = now;
    }
    const delta = (now - this.lastTickAt) / 1000;
    const elapsed = (now - this.startedAt) / 1000;

    this.lastTickAt = now;

    const tick: SchedulerTick = { delta, elapsed, now };

    for (const client of this.clients) {
      client(tick);
    }

    this.flushPending = false;
    this.maybeQueue();
  };
}

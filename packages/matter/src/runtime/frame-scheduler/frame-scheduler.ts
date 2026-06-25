export interface SchedulerTick {
  delta: number;
  elapsed: number;
  now: number;
}

export type SchedulerClient = (tick: SchedulerTick) => void;

export class FrameScheduler {
  private readonly clients = new Set<SchedulerClient>();
  private rafId: number | null = null;
  private running = false;
  private paused = false;
  private flushPending = false;
  private startedAt = 0;
  private lastTickAt = 0;

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

  /** Activate the scheduler. The rAF loop starts on the first client added. */
  start(): void {
    this.running = true;
    this.paused = false;
    this.maybeQueue();
  }

  /** Halt the rAF loop entirely. Use dispose() for permanent teardown. */
  stop(): void {
    this.running = false;
    this.cancel();
  }

  /** Temporarily skip ticks without losing client registrations. */
  pause(): void {
    this.paused = true;
  }

  /** Resume after pause(). */
  resume(): void {
    this.paused = false;
    if (this.running) this.maybeQueue();
  }

  /** Register a client to be called every frame. */
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

  /** Force a single tick while idle. Useful for prop-change invalidation. */
  requestRender(): void {
    if (!this.idle) return;
    this.flushPending = true;
    this.maybeQueue();
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

  private readonly frame = (now: number): void => {
    this.rafId = null;
    if (!this.running || this.paused) return;

    if (this.startedAt === 0) {
      this.startedAt = now;
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

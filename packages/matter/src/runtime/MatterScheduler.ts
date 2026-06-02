export interface SchedulerTick {
  /** Seconds since the previous tick. 0 on the first call. */
  delta: number
  /** Total seconds since the scheduler started its current run. */
  elapsed: number
  /** The raw `performance.now()` timestamp the rAF callback received. */
  now: number
}

export type SchedulerClient = (tick: SchedulerTick) => void

/**
 * Batches `requestAnimationFrame` calls across all clients registered with
 * a single scheduler. One scheduler is created per <ShaderScene>; clients
 * are typically a Three.js renderer's render call.
 */
export class FrameScheduler {
  private readonly clients = new Set<SchedulerClient>()
  private rafId: number | null = null
  private running = false
  private paused = false
  private idle = false
  private flushPending = false
  private startedAt = 0
  private lastTickAt = 0

  /** Activate the scheduler. The rAF loop starts on the first client added. */
  start(): void {
    this.running = true
    this.paused = false
    this.maybeQueue()
  }

  /** Halt the rAF loop entirely. Use dispose() for permanent teardown. */
  stop(): void {
    this.running = false
    this.cancel()
  }

  /** Temporarily skip ticks without losing client registrations. */
  pause(): void {
    this.paused = true
  }

  /** Resume after pause(). */
  resume(): void {
    this.paused = false
    if (this.running) this.maybeQueue()
  }

  /** Register a client to be called every frame. */
  add(client: SchedulerClient): void {
    this.clients.add(client)
    if (this.running) this.maybeQueue()
  }

  /** Unregister a client. */
  remove(client: SchedulerClient): void {
    this.clients.delete(client)
  }

  /** Permanent teardown: stop the loop and drop all clients. */
  dispose(): void {
    this.stop()
    this.clients.clear()
  }

  /**
   * Mark the scheduler idle. The next tick still fires (a final flush so
   * uniform changes that triggered the idle state are rendered), then the
   * rAF loop halts. Use `requestRender()` or `setIdle(false)` to wake.
   */
  setIdle(idle: boolean): void {
    if (this.idle === idle) return
    this.idle = idle
    if (idle) {
      this.flushPending = true
      this.maybeQueue()
    } else {
      this.flushPending = false
      this.maybeQueue()
    }
  }

  /** Force a single tick while idle. Useful for prop-change invalidation. */
  requestRender(): void {
    if (!this.idle) return
    this.flushPending = true
    this.maybeQueue()
  }

  private maybeQueue(): void {
    if (this.rafId !== null) return
    if (!this.running) return
    if (this.clients.size === 0) return
    if (this.idle && !this.flushPending) return
    this.rafId = requestAnimationFrame(this.frame)
  }

  private cancel(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
  }

  private readonly frame = (now: number): void => {
    this.rafId = null
    if (!this.running || this.paused) return

    if (this.startedAt === 0) {
      this.startedAt = now
      this.lastTickAt = now
    }
    const delta = (now - this.lastTickAt) / 1000
    const elapsed = (now - this.startedAt) / 1000

    this.lastTickAt = now

    const tick: SchedulerTick = { delta, elapsed, now }

    for (const client of this.clients) {
      client(tick)
    }

    this.flushPending = false
    this.maybeQueue()
  }
}

/** @deprecated Use FrameScheduler — alias removed in 0.5.0 */
export { FrameScheduler as MatterScheduler }

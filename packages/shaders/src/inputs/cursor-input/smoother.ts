// Frame-rate-independent easing of a small vector toward a moving target,
// with a settle snap so a host can tell when it has finished. CursorInput
// uses one for its own position, and every useCursor consumer owns one for
// its position and one for its presence. Internal: not on the engine barrel.

// ----------------------------------------------------------------------------
// Options and constants
// ----------------------------------------------------------------------------

export interface SmootherOptions {
  /**
   * How much of the remaining gap survives one 60fps frame, 0..1. 0 snaps
   * to the target on the next tick. 1 never eases, so the value only ever
   * reaches a target that is already within the settle threshold. Clamped
   * to that range.
   */
  smoothing: number;
  /**
   * Gap below which the value lands exactly on its target, per component.
   * The lerp only ever closes a fraction of the gap, so without the snap it
   * would take many invisible sub-pixel steps to reach float equality.
   * Pick a size the eye cannot see: under a device pixel for a position,
   * under a shade for an opacity.
   */
  settleThreshold: number;
}

/**
 * Longest stretch of time a wake tick may smooth across, in seconds. The
 * host reports the whole gap since its last frame after a parked scene
 * wakes. Smoothing across that gap would snap the value to the target.
 * Capping the marked wake tick at one 30fps frame preserves the glide while
 * ordinary slow frames still use their full delta.
 */
const MAX_WAKE_TICK_DELTA = 1 / 30;

// ----------------------------------------------------------------------------
// The smoother
// ----------------------------------------------------------------------------

export class Smoother {
  private readonly values: number[];
  private readonly targets: number[];
  private readonly smoothing: number;
  private readonly settleThreshold: number;

  constructor(initial: readonly number[], { smoothing, settleThreshold }: SmootherOptions) {
    this.values = [...initial];
    this.targets = [...initial];
    this.smoothing = clamp01(smoothing);
    this.settleThreshold = settleThreshold;
  }

  /**
   * The current eased value. The same array every call, mutated in place
   * by `tick`, so a caller that hands it on copies it first.
   */
  get(): readonly number[] {
    return this.values;
  }

  /** Where the value is heading. A tick moves the value toward this. */
  setTarget(next: readonly number[]): void {
    for (let index = 0; index < this.targets.length; index += 1) {
      this.targets[index] = next[index] ?? 0;
    }
  }

  /**
   * Advance the easing by `delta` seconds. Returns true when the value
   * moved, so the host knows to draw another frame, and false once it has
   * settled on the target. Set `afterIdle` only for the first tick after
   * the host resumes from idle, which caps the step at one 30fps frame.
   * Runs every frame for every consumer, so it loops in place and
   * allocates nothing.
   */
  tick(delta: number, afterIdle = false): boolean {
    // Raising `smoothing` to the power of elapsed frames-worth-of-time means
    // the same fraction of the remaining gap closes per real second whether
    // the display runs 30, 60, or 144 fps. A plain per-frame lerp would
    // chase faster on faster screens.
    const smoothingDelta = afterIdle ? Math.min(delta, MAX_WAKE_TICK_DELTA) : delta;
    const frames = smoothingDelta * 60;
    const factor = this.smoothing === 0 ? 1 : 1 - Math.pow(this.smoothing, frames);
    const count = this.values.length;

    // First pass: is every component within the threshold of its target
    // after this step? If so the whole value lands exactly, so the next
    // tick reports settled and the host can stop drawing.
    let withinThreshold = true;

    for (let index = 0; index < count; index += 1) {
      const target = this.targets[index] ?? 0;
      const stepped = lerp(this.values[index] ?? 0, target, factor);

      if (Math.abs(target - stepped) >= this.settleThreshold) {
        withinThreshold = false;
        break;
      }
    }

    // Second pass: write the step, or the target itself when landing.
    let moved = false;

    for (let index = 0; index < count; index += 1) {
      const target = this.targets[index] ?? 0;
      const previous = this.values[index] ?? 0;
      const next = withinThreshold ? target : lerp(previous, target, factor);

      if (next !== previous) {
        this.values[index] = next;
        moved = true;
      }
    }

    return moved;
  }
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const lerp = (startValue: number, endValue: number, blendFactor: number) =>
  startValue + (endValue - startValue) * blendFactor;

// Eases CursorTrail's brush size with the pointer's speed, for `grow`: a
// fast stroke grows the brush quickly, and a slower or stopped pointer
// lets it settle back to `radius` more slowly. Plain numbers, no GPU.
// Lives beside the component.
import type { PushStroke } from '../../engine.js';

// Pointer speed, in canvas heights per second, at which the brush reaches
// about two thirds of its full growth (1 - 1/e). Faster moves approach it.
// Higher needs a faster pointer to grow the brush; lower grows it sooner.
const GROW_SPEED = 1.5;
// Seconds the size takes to follow the speed: quick to grow, slower to
// settle, so the head eases back down after the pointer stops. Higher
// makes either change slower and smoother; lower makes it snappier.
const GROW_RISE = 0.08;
const GROW_SETTLE = 0.25;
// Below this share of full growth, snap to the base size, so the scene can
// stop drawing. Higher stops sooner with a visible last step; lower keeps
// drawing longer for a change no one can see.
const GROW_REST = 0.001;

export interface Growth {
  /**
   * Ease toward the growth this frame's stroke earns, and return how far
   * the brush has grown: 0 at the base radius, 1 at the full `grow`. A
   * frame with no stroke earns none, nor does a stroke whose brush is off
   * the canvas, and a disabled trail settles to 0.
   */
  step: (stroke: PushStroke | null, delta: number, aspect: number, disabled: boolean) => number;
  /** Drop to the base radius at once, for growth no one can see. */
  reset: () => void;
  /** How far the brush has grown, as step() last returned. */
  readonly share: number;
}

// How fast a stroke crossed the canvas, in canvas heights per second.
// Stroke points run 0..1 on both axes, so x is stretched by the aspect to
// measure in heights, as the brush is.
function strokeSpeed({ from, to }: PushStroke, delta: number, aspect: number): number {
  return Math.hypot((to[0] - from[0]) * aspect, to[1] - from[1]) / delta;
}

export function createGrowth(): Growth {
  let share = 0;

  return {
    step(stroke, delta, aspect, disabled) {
      // A frame with no time passed, after a pause or a resize, leaves the
      // size where it was.
      if (delta <= 0) return share;
      // A stroke with no presence draws no path, so it grows nothing.
      const speed = stroke && stroke.presence > 0 ? strokeSpeed(stroke, delta, aspect) : 0;
      const target = disabled ? 0 : 1 - Math.exp(-speed / GROW_SPEED);
      const ease = target > share ? GROW_RISE : GROW_SETTLE;

      share += (target - share) * (1 - Math.exp(-delta / ease));
      if (share < GROW_REST) share = 0;

      return share;
    },
    reset() {
      share = 0;
    },
    get share() {
      return share;
    },
  };
}

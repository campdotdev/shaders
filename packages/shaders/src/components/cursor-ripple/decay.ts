// CursorRipple's `decay` prop in the wave field's terms. The prop is an
// everyday 0..1 dial; the field wants the fraction of height and velocity
// that survives each substep. The dial maps onto a ring's lifetime on a log
// scale, because the useful range of feel runs over two orders of magnitude
// of time and a linear scale would spend most of its travel on the long end.
// Kept as pure functions so they have a unit test.
import { dampingForLifetime } from '../../engine.js';

/**
 * Lifetime, in seconds, at `decay` 0: rings keep spreading for as long as
 * a pool would let them. Longer keeps the scene awake for longer after the
 * last drag, since the field only rests once the wave has drained.
 */
const LONGEST_LIFETIME_SECONDS = 5;

/**
 * Lifetime at `decay` 1: a dent is gone within a few substeps, so the
 * water reads as thick and the wake stays tight to the pointer. Shorter
 * would stop the ring before it had spread a texel.
 */
const SHORTEST_LIFETIME_SECONDS = 0.05;

/**
 * A ring's lifetime for a `decay` dial, 0..1, clamped: log-spaced between
 * the two ends, so each step of the dial shortens the life by the same
 * factor. 0.5 is the geometric middle, half a second.
 */
export function lifetimeForDecay(decay: number): number {
  const clamped = Math.min(1, Math.max(0, decay));
  const ratio = SHORTEST_LIFETIME_SECONDS / LONGEST_LIFETIME_SECONDS;

  return LONGEST_LIFETIME_SECONDS * ratio ** clamped;
}

/**
 * The fraction the wave field keeps per substep for a `decay` dial. It is
 * applied to height and velocity alike: damping height alone leaves a slow
 * velocity mode the field's settle model has to wait out, which kept the
 * scene drawing for seconds after the ripple had visibly gone.
 */
export function dampingForDecay(decay: number): number {
  return dampingForLifetime(lifetimeForDecay(decay));
}

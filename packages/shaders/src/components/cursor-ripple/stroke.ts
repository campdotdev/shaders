// The stroke CursorRipple hands its wave field each frame: the segment the
// pointer swept since the previous frame, with the presence that gates it.
// Kept as a pure function so it has a unit test; the wrapper (./cursor-
// ripple.tsx) calls it from the scene's scheduler tick and the field turns
// the segment's length over the frame's delta into pointer speed.
import type { Vector2, WaveFieldStroke } from '../../engine.js';

/**
 * The most a pointer can move in one frame, per axis, in 0..1 canvas units,
 * before the move counts as a jump rather than a stroke. A quarter of the
 * canvas in one 60Hz frame is 15 canvas widths a second, well past a real
 * flick. Jumps come from a finger lifted and put down elsewhere, or a mouse
 * leaving the window and coming back somewhere else: the input sends no
 * move in between, so the next one spans the gap. Lower it and very fast
 * swipes on a low-refresh display start dropping frames of wake; raise it
 * and those jumps stamp a streak of water across the canvas.
 */
const MAX_STROKE_TRAVEL = 0.25;

/**
 * The segment from `previous` to `current` as a stroke, or nothing when
 * there is no segment to push: before the first frame that had a position,
 * while the pointer is still, while presence is 0 (the pointer has never
 * entered the canvas, or has left and faded out), or when the move is a
 * jump rather than a stroke (see MAX_STROKE_TRAVEL). A segment that runs
 * past the canvas edge is kept, so a ring started near the edge keeps
 * spreading until presence fades.
 */
export function deriveStroke(
  previous: Vector2 | null,
  current: Vector2,
  presence: number,
): WaveFieldStroke | undefined {
  if (previous === null || presence <= 0) return undefined;
  if (previous[0] === current[0] && previous[1] === current[1]) return undefined;

  const travel = Math.max(Math.abs(current[0] - previous[0]), Math.abs(current[1] - previous[1]));

  if (travel > MAX_STROKE_TRAVEL) return undefined;

  return { from: previous, to: current, presence };
}

// The arithmetic behind NumberField, kept separate from the component so it
// can be unit tested -- the editor app has no DOM test environment (no jsdom,
// no testing-library), so anything worth asserting has to be reachable as a
// plain function. The component owns pointers and focus; this file owns "what
// number does that gesture mean".

/** A param's numeric bounds. Structurally what a slider ParamSpec carries. */
export interface NumericRange {
  min: number;
  max: number;
  step: number;
}

/**
 * Pointer travel, in CSS pixels, that sweeps a dial across its entire range.
 * Smaller means a twitchier dial. 160 is roughly the width the old slider
 * occupied, so a full drag costs about what it used to -- a feel constant,
 * settled by eye at the dev server.
 */
export const SCRUB_SWEEP_PX = 160;

/** Decimal places implied by a step size: 1 -> 0, 0.1 -> 1, 0.01 -> 2. */
export function decimalsOf(step: number): number {
  if (Number.isInteger(step)) return 0;

  return (step.toString().split('.')[1] ?? '').length;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Rounds to the nearest step boundary and clamps into range.
 *
 * Boundaries are measured from `min`, not from zero: a dial running 0.5-10 on
 * 0.1 steps should offer 0.5, 0.6, 0.7 rather than the 0.5, 0.6 sequence you
 * would get by snapping absolute multiples. The final round-trip through
 * `toFixed` is what clears binary float dust -- 0.5 + 3 * 0.1 evaluates to
 * 0.8000000000000001, and that value would be written into a preset verbatim.
 */
export function snapToStep(value: number, { min, max, step }: NumericRange): number {
  const steps = Math.round((value - min) / step);
  const snapped = min + steps * step;

  return clamp(Number(snapped.toFixed(decimalsOf(step))), min, max);
}

/**
 * The value a scrub lands on: `deltaX` pixels of horizontal travel from
 * `startValue`, scaled so one `SCRUB_SWEEP_PX` sweep covers the whole range.
 * Anchoring on the value the gesture STARTED at (rather than accumulating
 * per-move deltas) is what keeps a drag reversible -- dragging out and back
 * returns exactly where you began, with no drift from repeated snapping.
 */
export function valueFromScrub(
  startValue: number,
  deltaX: number,
  range: NumericRange,
  sweepPx: number = SCRUB_SWEEP_PX,
): number {
  const span = range.max - range.min;

  return snapToStep(startValue + (deltaX / sweepPx) * span, range);
}

/**
 * Reads a typed entry. Returns null for anything that isn't a finite number
 * so the caller can revert to the committed value rather than guess; a number
 * that's merely out of range is clamped instead, since the intent is clear.
 */
export function parseTyped(text: string, range: NumericRange): number | null {
  const trimmed = text.trim();

  if (trimmed === '') return null;

  const parsed = Number(trimmed);

  if (!Number.isFinite(parsed)) return null;

  return snapToStep(parsed, range);
}

/**
 * Formats a value for display. Deliberately keyed off `step < 1` rather than
 * the step's own decimal count, to match exactly what the slider readout this
 * control replaces used to show -- a 0.1-step dial still reads "3.00".
 */
export function formatValue(value: number, { step }: NumericRange): string {
  return value.toFixed(step < 1 ? 2 : 0);
}

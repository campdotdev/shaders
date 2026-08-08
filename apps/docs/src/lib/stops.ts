// Shared "Add stop" logic for the demo panels whose stop lists carry explicit
// positions (linear, radial, conic, aurora). Those lists end with a stop at
// position 1, and colorRamp drops segments whose span isn't positive, so a stop
// appended after the last one could never render. New stops slot in just before
// the last stop instead, keeping it terminal and the list ascending by position.

/** The stop shape every positioned list shares; pages keep their own aliases. */
export interface PositionedStop {
  color: string;
  position: number;
}

/** Index the panel's "Add stop" button inserts at: just before the last stop. */
export const newStopIndex = (stops: readonly PositionedStop[]): number =>
  Math.max(stops.length - 1, 0);

/**
 * Builds the stop that lands at {@link newStopIndex}: it duplicates the color
 * of the stop it follows and sits halfway between that stop and the last one,
 * so the new row changes the gradient immediately and its position slider
 * works from the first drag.
 */
export const createStop = (stops: readonly PositionedStop[]): PositionedStop => {
  const last = stops[stops.length - 1];
  const preceding = stops[stops.length - 2];

  return {
    color: (preceding ?? last)?.color ?? 'oklch(0.6 0 0)',
    position: ((preceding?.position ?? 0) + (last?.position ?? 1)) / 2,
  };
};

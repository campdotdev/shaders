// Guards the panels' "Add stop" flow. Positioned stop lists end with a stop at
// position 1, and colorRamp drops any segment whose span isn't positive — so a
// stop appended after the last one would never render. These tests pin the fix:
// new stops slot in before the last stop and the list stays in ascending
// position order, including after a position edit.
import { describe, expect, it } from 'vitest';

import { createStop, newStopIndex, type PositionedStop } from './stops';

// Mirrors the conic-gradient panel's shape: a closing stop at 1 repeating the
// first color, which is exactly the case an appended stop could never outrun.
const RAMP: PositionedStop[] = [
  { color: 'oklch(0.55 0.25 340)', position: 0 },
  { color: 'oklch(0.5 0.2 300)', position: 1 / 3 },
  { color: 'oklch(0.7 0.15 250)', position: 2 / 3 },
  { color: 'oklch(0.55 0.25 340)', position: 1 },
];

/** Mirrors ListInput's add flow: build the stop, splice it in at the index. */
function addStop(stops: PositionedStop[]): { stops: PositionedStop[]; index: number } {
  const index = newStopIndex(stops);
  const next = [...stops];

  next.splice(index, 0, createStop(stops));

  return { stops: next, index };
}

function positionsAscending(stops: PositionedStop[]): boolean {
  return stops.every(
    (stop, index) => index === 0 || (stops[index - 1]?.position ?? 0) <= stop.position,
  );
}

describe('adding a color stop', () => {
  it('slots in before the last stop, halfway to it, with the preceding color', () => {
    const { stops, index } = addStop(RAMP);

    expect(index).toBe(RAMP.length - 1);
    expect(stops[index]).toEqual({
      color: RAMP[2]?.color,
      position: (2 / 3 + 1) / 2,
    });
    // The closing stop is still last, so a looping ramp still closes cleanly.
    expect(stops[stops.length - 1]).toEqual(RAMP[RAMP.length - 1]);
    expect(positionsAscending(stops)).toBe(true);
  });

  it('stays ascending after the new stop is dragged below 1', () => {
    const { stops, index } = addStop(RAMP);
    const edited = stops.map((stop, stopIndex) =>
      stopIndex === index ? { ...stop, position: 0.8 } : stop,
    );

    expect(positionsAscending(edited)).toBe(true);
  });

  it('slots in below a lone stop', () => {
    const only: PositionedStop[] = [{ color: 'oklch(0.6 0.1 300)', position: 1 }];
    const { stops, index } = addStop(only);

    expect(index).toBe(0);
    expect(stops[0]).toEqual({ color: only[0]?.color, position: 0.5 });
    expect(positionsAscending(stops)).toBe(true);
  });
});

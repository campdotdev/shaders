import { describe, expect, it } from 'vitest';

import type { AnimatableSignal } from '../../react/hooks/animatable-signal/animatable-signal.js';
import { isLedWallStatic } from './static.js';

// Two correctly-typed mocks: one for the number-typed fields (`progress`,
// `flicker`, `swell`), one for the tuple-typed `focus`.
const numberSignal: AnimatableSignal<number> = { get: () => 0.5, on: () => () => undefined };
const pointSignal: AnimatableSignal<readonly [number, number]> = {
  get: () => [0.5, 0.5] as const,
  on: () => () => undefined,
};

// The wall may tell the scene to stop drawing only when nothing on it can
// change between frames: no flicker, no swell, and no live signal on the
// reveal or the focus position.
describe('isLedWallStatic', () => {
  it('is static when flicker and swell are off and nothing is a signal', () => {
    expect(isLedWallStatic({ flicker: 0, progress: 1, focus: [0.5, 0.5], swell: 0 })).toBe(true);
  });

  it('is live when flicker is on', () => {
    expect(isLedWallStatic({ flicker: 0.3, progress: 1, focus: [0.5, 0.5], swell: 0 })).toBe(false);
  });

  it('is live when swell is on', () => {
    expect(isLedWallStatic({ flicker: 0, progress: 1, focus: [0.5, 0.5], swell: 0.5 })).toBe(false);
  });

  it('is live when progress or the focus position is a signal', () => {
    expect(
      isLedWallStatic({
        flicker: 0,
        progress: numberSignal,
        focus: [0.5, 0.5],
        swell: 0,
      }),
    ).toBe(false);
    expect(isLedWallStatic({ flicker: 0, progress: 1, focus: pointSignal, swell: 0 })).toBe(false);
  });

  it('is live when flicker itself is a signal, even one currently at 0', () => {
    expect(
      isLedWallStatic({
        flicker: { get: () => 0, on: () => () => undefined },
        progress: 1,
        focus: [0.5, 0.5],
        swell: 0,
      }),
    ).toBe(false);
  });
});

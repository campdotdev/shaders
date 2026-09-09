import { describe, expect, it } from 'vitest';

import type { AnimatableSignal } from '../../react/hooks/animatable-signal/animatable-signal.js';
import { isLedWallStatic } from './static.js';

// Typed as AnimatableSignal<never> so this one mock satisfies both the
// number-typed `progress` field and the tuple-typed `spotlight` field below:
// isSignal only inspects get/on's shape and never reads the return value, so
// the cast changes nothing the tests observe.
const signal = { get: () => 0.5, on: () => () => undefined } as unknown as AnimatableSignal<never>;

// The wall may tell the scene to stop drawing only when nothing on it can
// change between frames: no flicker, no spotlight, and no live signal on
// the reveal or the spotlight position.
describe('isLedWallStatic', () => {
  it('is static when flicker and spotlight are off and nothing is a signal', () => {
    expect(
      isLedWallStatic({ flicker: 0, progress: 1, spotlight: [0.5, 0.5], spotlightIntensity: 0 }),
    ).toBe(true);
  });

  it('is live when flicker is on', () => {
    expect(
      isLedWallStatic({ flicker: 0.3, progress: 1, spotlight: [0.5, 0.5], spotlightIntensity: 0 }),
    ).toBe(false);
  });

  it('is live when the spotlight is on', () => {
    expect(
      isLedWallStatic({ flicker: 0, progress: 1, spotlight: [0.5, 0.5], spotlightIntensity: 0.5 }),
    ).toBe(false);
  });

  it('is live when progress or the spotlight position is a signal', () => {
    expect(
      isLedWallStatic({
        flicker: 0,
        progress: signal,
        spotlight: [0.5, 0.5],
        spotlightIntensity: 0,
      }),
    ).toBe(false);
    expect(
      isLedWallStatic({ flicker: 0, progress: 1, spotlight: signal, spotlightIntensity: 0 }),
    ).toBe(false);
  });

  it('is live when flicker itself is a signal, even one currently at 0', () => {
    expect(
      isLedWallStatic({
        flicker: { get: () => 0, on: () => () => undefined },
        progress: 1,
        spotlight: [0.5, 0.5],
        spotlightIntensity: 0,
      }),
    ).toBe(false);
  });
});

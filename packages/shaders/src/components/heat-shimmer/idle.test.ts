import { describe, expect, it } from 'vitest';

import type { AnimatableSignal } from '../../react/hooks/animatable-signal/animatable-signal.js';
import { isHeatShimmerIdle } from './idle.js';

/** A signal that reads `value` now and never changes in the test. */
const signalAt = (value: number): AnimatableSignal<number> => ({
  get: () => value,
  on: () => () => undefined,
});

// The shimmer votes idle only when nothing it draws can change between
// frames: it moves the image by nothing, or its clock holds still. A signal
// counts as moving whatever it reads right now, because it can change
// between renders.
describe('isHeatShimmerIdle', () => {
  it('is idle at a strength of 0, at any speed', () => {
    expect(isHeatShimmerIdle({ strength: 0, speed: 1 })).toBe(true);
    expect(isHeatShimmerIdle({ strength: 0, speed: -2 })).toBe(true);
  });

  it('is idle below a strength of 0, which clamps to 0', () => {
    expect(isHeatShimmerIdle({ strength: -0.5, speed: 1 })).toBe(true);
  });

  it('is idle at a speed of 0, at any strength', () => {
    expect(isHeatShimmerIdle({ strength: 0.5, speed: 0 })).toBe(true);
    expect(isHeatShimmerIdle({ strength: 1, speed: 0 })).toBe(true);
  });

  it('is animated when it pushes and its clock runs, rising or sinking', () => {
    expect(isHeatShimmerIdle({ strength: 0.5, speed: 1 })).toBe(false);
    expect(isHeatShimmerIdle({ strength: 0.5, speed: -1 })).toBe(false);
  });

  it('is animated when strength or speed is a signal, even beside a 0', () => {
    expect(isHeatShimmerIdle({ strength: signalAt(0), speed: 1 })).toBe(false);
    expect(isHeatShimmerIdle({ strength: 0.5, speed: signalAt(0) })).toBe(false);
    expect(isHeatShimmerIdle({ strength: 0, speed: signalAt(1) })).toBe(false);
    expect(isHeatShimmerIdle({ strength: signalAt(1), speed: 0 })).toBe(false);
    expect(isHeatShimmerIdle({ strength: signalAt(0.5), speed: signalAt(1) })).toBe(false);
  });
});

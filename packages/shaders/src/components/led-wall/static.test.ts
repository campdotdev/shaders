import { describe, expect, it } from 'vitest';

import type { AnimatableSignal } from '../../react/hooks/animatable-signal/animatable-signal.js';
import { isLedWallStatic } from './static.js';

// Two correctly-typed mocks: one for the number-typed fields (`flicker`,
// `speed`, `swell`), one for the tuple-typed `focus`.
const numberSignal: AnimatableSignal<number> = { get: () => 0.5, on: () => () => undefined };
const pointSignal: AnimatableSignal<readonly [number, number]> = {
  get: () => [0.5, 0.5] as const,
  on: () => () => undefined,
};

const still = { flicker: 0, focus: [0.5, 0.5] as const, speed: 2.4, swell: 0.85 };

// The wall may tell the scene to stop drawing only when nothing on it can
// change between frames. Only the breath moves on its own, and it needs
// both a flicker depth and a speed; the swell reads static inputs, so it
// draws the same dots every frame however strong it is. A live signal on
// any of the four counts as motion whatever it reads right now.
describe('isLedWallStatic', () => {
  it('is static when the flicker depth is 0, whatever the swell', () => {
    expect(isLedWallStatic(still)).toBe(true);
    expect(isLedWallStatic({ ...still, swell: 0 })).toBe(true);
  });

  it('is static when the speed is 0, whatever the flicker depth', () => {
    expect(isLedWallStatic({ ...still, flicker: 0.5, speed: 0 })).toBe(true);
  });

  it('is live when the dots breathe: flicker and speed both nonzero', () => {
    expect(isLedWallStatic({ ...still, flicker: 0.3 })).toBe(false);
  });

  it('is live when the focus position or swell is a signal', () => {
    expect(isLedWallStatic({ ...still, focus: pointSignal })).toBe(false);
    expect(isLedWallStatic({ ...still, swell: numberSignal })).toBe(false);
  });

  it('is live when flicker or speed is a signal, even one currently at 0', () => {
    const zeroSignal: AnimatableSignal<number> = { get: () => 0, on: () => () => undefined };

    expect(isLedWallStatic({ ...still, flicker: zeroSignal })).toBe(false);
    expect(isLedWallStatic({ ...still, speed: zeroSignal })).toBe(false);
  });
});

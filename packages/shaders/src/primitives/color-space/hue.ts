import { mod, sign, step } from 'three/tsl';

import type { ArcHueFn, HueInterpolation } from './types.js';

// Below this sweep (radians or turns) two hues count as equal, so `decreasing`
// doesn't fire a full backward spin between identical-hued stops.
const EQUAL_HUE_EPSILON = 1e-6;

/**
 * `shorter` — travel the SHORTER arc (CSS Color 4 default). The signed delta is
 * wrapped into [-period/2, period/2) so the lerp never goes the long way.
 */
export const shortestArcHue: ArcHueFn = (h1, h2, t, period) => {
  const half = period / 2;
  const delta = mod(h2.sub(h1).add(half), period).sub(half);

  return h1.add(delta.mul(t));
};

/**
 * `longer` — travel the LONGER arc: take the shorter signed delta and step a
 * full period the other way. At exactly-equal hues `sign` is 0, so the delta
 * stays 0 (no surprise full-circle spin) rather than looping the wheel.
 */
export const longestArcHue: ArcHueFn = (h1, h2, t, period) => {
  const half = period / 2;
  const short = mod(h2.sub(h1).add(half), period).sub(half);
  const delta = short.sub(sign(short).mul(period));

  return h1.add(delta.mul(t));
};

/**
 * `increasing` — hue counts strictly UP (wrapping period→0). Delta in [0, period),
 * so a multi-stop ramp marches one way around the wheel without reversing.
 */
export const increasingArcHue: ArcHueFn = (h1, h2, t, period) => {
  const delta = mod(h2.sub(h1), period);

  return h1.add(delta.mul(t));
};

/**
 * `decreasing` — hue counts strictly DOWN. The upward delta in [0, period) has a
 * full period subtracted (unless the hues are equal, guarded by the epsilon), so
 * the result lands in (-period, 0].
 */
export const decreasingArcHue: ArcHueFn = (h1, h2, t, period) => {
  const up = mod(h2.sub(h1), period);
  const delta = up.sub(step(EQUAL_HUE_EPSILON, up).mul(period));

  return h1.add(delta.mul(t));
};

/** Resolves a `HueInterpolation` keyword to its arc function. */
export const hueArcInterpolators: Record<HueInterpolation, ArcHueFn> = {
  shorter: shortestArcHue,
  longer: longestArcHue,
  increasing: increasingArcHue,
  decreasing: decreasingArcHue,
};

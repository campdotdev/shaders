import { describe, expect, it } from 'vitest';

import { linearChannelToSrgb, srgbChannelToLinear } from './cpu-transfer.js';

describe('srgbChannelToLinear', () => {
  it('maps endpoints exactly', () => {
    expect(srgbChannelToLinear(0)).toBe(0);
    expect(srgbChannelToLinear(1)).toBeCloseTo(1, 6);
  });

  it('matches the known sRGB midpoint (0.5 -> ~0.214041)', () => {
    expect(srgbChannelToLinear(0.5)).toBeCloseTo(0.21404114, 6);
  });

  it('uses the linear segment below the 0.04045 knee', () => {
    expect(srgbChannelToLinear(0.04)).toBeCloseTo(0.04 / 12.92, 6);
  });
});

describe('linearChannelToSrgb', () => {
  it('inverts srgbChannelToLinear across the piecewise boundary', () => {
    for (const encoded of [0, 0.01, 0.04045, 0.2, 0.5, 1]) {
      expect(linearChannelToSrgb(srgbChannelToLinear(encoded))).toBeCloseTo(encoded, 3);
    }
  });
});

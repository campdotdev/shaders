import { uv } from 'three/tsl';
import { describe, expect, it } from 'vitest';

import { linearToSrgb, srgbChannelToLinear, srgbToLinear } from './transfer.js';

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

describe('TSL transfer nodes', () => {
  it('build without throwing', () => {
    expect(srgbToLinear(uv())).toBeDefined();
    expect(linearToSrgb(uv())).toBeDefined();
  });
});

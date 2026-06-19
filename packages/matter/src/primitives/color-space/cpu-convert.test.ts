import { describe, expect, it } from 'vitest';

import { oklabToLinearSrgb, oklchToLinearSrgb, parseColorString } from './cpu-convert.js';
import { srgbChannelToLinear } from './transfer.js';

const closeTo = (value: number, target: number, tolerance = 1e-3) =>
  Math.abs(value - target) <= tolerance;

describe('oklabToLinearSrgb', () => {
  it('maps the OKLab white point to linear-sRGB white', () => {
    const [r, g, b] = oklabToLinearSrgb(1, 0, 0);

    expect(closeTo(r, 1)).toBe(true);
    expect(closeTo(g, 1)).toBe(true);
    expect(closeTo(b, 1)).toBe(true);
  });
});

describe('oklchToLinearSrgb', () => {
  it('a high-chroma green lands outside sRGB (a channel goes negative or >1)', () => {
    // P3-ish vivid green: chroma 0.34 exceeds sRGB green's max chroma (~0.295 at
    // this hue), so it must fall outside the sRGB cube.
    const [r, g, b] = oklchToLinearSrgb(0.87, 0.34, 142);
    const outOfGamut = r < -1e-4 || g > 1 + 1e-4 || b < -1e-4 || r > 1 + 1e-4;

    expect(outOfGamut).toBe(true);
  });

  it('an in-gamut color stays within [0,1]', () => {
    // Mid grey-ish: low chroma.
    const channels = oklchToLinearSrgb(0.6, 0.02, 120);

    for (const channel of channels) {
      expect(channel).toBeGreaterThanOrEqual(-1e-3);
      expect(channel).toBeLessThanOrEqual(1 + 1e-3);
    }
  });
});

describe('parseColorString', () => {
  it('parses hex identical to the per-channel sRGB decode', () => {
    const [r, g, b] = parseColorString('#8c0067');

    expect(closeTo(r, srgbChannelToLinear(0x8c / 255))).toBe(true);
    expect(closeTo(g, srgbChannelToLinear(0x00 / 255))).toBe(true);
    expect(closeTo(b, srgbChannelToLinear(0x67 / 255))).toBe(true);
  });

  it('parses oklch() with degrees', () => {
    const fromString = parseColorString('oklch(0.86 0.28 142)');
    const direct = oklchToLinearSrgb(0.86, 0.28, 142);

    expect(closeTo(fromString[0], direct[0])).toBe(true);
    expect(closeTo(fromString[1], direct[1])).toBe(true);
    expect(closeTo(fromString[2], direct[2])).toBe(true);
  });

  it('parses oklch() percentage lightness and a deg suffix and a dropped alpha', () => {
    const fromString = parseColorString('oklch(86% 0.28 142deg / 0.5)');
    const direct = oklchToLinearSrgb(0.86, 0.28, 142);

    expect(closeTo(fromString[0], direct[0])).toBe(true);
    expect(closeTo(fromString[1], direct[1])).toBe(true);
    expect(closeTo(fromString[2], direct[2])).toBe(true);
  });

  it('parses oklab()', () => {
    const fromString = parseColorString('oklab(0.7 0.15 -0.1)');
    const direct = oklabToLinearSrgb(0.7, 0.15, -0.1);

    expect(closeTo(fromString[0], direct[0])).toBe(true);
  });

  it('throws on unrecognized syntax', () => {
    expect(() => parseColorString('rebeccapurple')).toThrow();
  });
});

import { describe, expect, it } from 'vitest';

import {
  linearSrgbToOklab,
  linearSrgbToOklch,
  oklabToLinearSrgb,
  oklchToLinearSrgb,
  parseColorString,
} from './cpu-convert.js';
import { linearChannelToSrgb, srgbChannelToLinear } from './transfer.js';

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

describe('linearSrgbToOklab', () => {
  it('maps linear-sRGB white back to the OKLab white point', () => {
    const [lightness, greenRed, blueYellow] = linearSrgbToOklab(1, 1, 1);

    expect(closeTo(lightness, 1)).toBe(true);
    expect(closeTo(greenRed, 0)).toBe(true);
    expect(closeTo(blueYellow, 0)).toBe(true);
  });

  it('round-trips through oklabToLinearSrgb', () => {
    const [red, green, blue] = oklabToLinearSrgb(0.7, 0.15, -0.1);
    const [lightness, greenRed, blueYellow] = linearSrgbToOklab(red, green, blue);

    expect(closeTo(lightness, 0.7)).toBe(true);
    expect(closeTo(greenRed, 0.15)).toBe(true);
    expect(closeTo(blueYellow, -0.1)).toBe(true);
  });
});

describe('linearSrgbToOklch', () => {
  it('round-trips an in-gamut color through oklchToLinearSrgb', () => {
    const [red, green, blue] = oklchToLinearSrgb(0.6, 0.12, 250);
    const [lightness, chroma, hueDegrees] = linearSrgbToOklch(red, green, blue);

    expect(closeTo(lightness, 0.6)).toBe(true);
    expect(closeTo(chroma, 0.12)).toBe(true);
    expect(closeTo(hueDegrees, 250, 1e-2)).toBe(true);
  });

  it('round-trips a color outside the sRGB gamut', () => {
    // Negative and >1 channels must survive the trip — the picker has to place
    // the handle for wide-gamut palette colors, not just displayable ones.
    const [red, green, blue] = oklchToLinearSrgb(0.87, 0.34, 142);
    const [lightness, chroma, hueDegrees] = linearSrgbToOklch(red, green, blue);

    expect(closeTo(lightness, 0.87)).toBe(true);
    expect(closeTo(chroma, 0.34)).toBe(true);
    expect(closeTo(hueDegrees, 142, 1e-2)).toBe(true);
  });

  it('reports hue in [0, 360)', () => {
    const [red, green, blue] = oklchToLinearSrgb(0.5, 0.1, 350);
    const [, , hueDegrees] = linearSrgbToOklch(red, green, blue);

    expect(hueDegrees).toBeGreaterThanOrEqual(0);
    expect(hueDegrees).toBeLessThan(360);
    expect(closeTo(hueDegrees, 350, 1e-2)).toBe(true);
  });

  it('round-trips a hex color through parseColorString', () => {
    const [red, green, blue] = parseColorString('#8c0067');
    const [lightness, chroma, hueDegrees] = linearSrgbToOklch(red, green, blue);
    const [backRed, backGreen, backBlue] = oklchToLinearSrgb(lightness, chroma, hueDegrees);

    expect(closeTo(backRed, red)).toBe(true);
    expect(closeTo(backGreen, green)).toBe(true);
    expect(closeTo(backBlue, blue)).toBe(true);
  });
});

describe('linearChannelToSrgb', () => {
  it('inverts srgbChannelToLinear across the piecewise boundary', () => {
    for (const encoded of [0, 0.01, 0.04045, 0.2, 0.5, 1]) {
      expect(closeTo(linearChannelToSrgb(srgbChannelToLinear(encoded)), encoded)).toBe(true);
    }
  });
});

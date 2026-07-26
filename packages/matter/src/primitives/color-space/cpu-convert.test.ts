import { describe, expect, it } from 'vitest';

import {
  linearSrgbToLinearDisplayP3,
  linearSrgbToOklab,
  linearSrgbToOklch,
  oklabToLinearSrgb,
  oklchToGamut,
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

describe('linearSrgbToLinearDisplayP3', () => {
  const inGamut = (channels: [number, number, number]) =>
    channels.every((channel) => channel >= -1e-4 && channel <= 1 + 1e-4);

  it('leaves the shared white point alone, to float precision', () => {
    // Not just "close to" white: the picker tests gamut membership with a 1e-9
    // epsilon so the boundary stays honest near black, and white has to survive
    // that. This holds only because each matrix row sums to exactly 1.
    const [red, green, blue] = linearSrgbToLinearDisplayP3(1, 1, 1);

    expect(closeTo(red, 1, 1e-9)).toBe(true);
    expect(closeTo(green, 1, 1e-9)).toBe(true);
    expect(closeTo(blue, 1, 1e-9)).toBe(true);
  });

  it('pulls the sRGB red primary inside the P3 cube', () => {
    // P3's red primary sits further out than sRGB's, so full sRGB red is no
    // longer a primary in P3 — it needs less red and a little green and blue.
    const [red, green, blue] = linearSrgbToLinearDisplayP3(1, 0, 0);

    expect(closeTo(red, 0.8225)).toBe(true);
    expect(closeTo(green, 0.0332)).toBe(true);
    expect(closeTo(blue, 0.0171)).toBe(true);
  });

  it('brings a palette color that sRGB clips inside the P3 gamut', () => {
    // paletteOklch.red.base. Its linear-sRGB red lands just past 1, so an sRGB
    // framebuffer clips it; P3 holds it comfortably. This is the whole reason
    // the picker draws its tracks against P3 rather than sRGB.
    const srgb = oklchToLinearSrgb(0.628, 0.258, 25);

    expect(inGamut(srgb)).toBe(false);
    expect(inGamut(linearSrgbToLinearDisplayP3(...srgb))).toBe(true);
  });

  it('keeps an in-sRGB color in gamut', () => {
    // P3 contains sRGB, so nothing displayable can leave the cube in transit.
    const srgb = oklchToLinearSrgb(0.6, 0.2, 264);

    expect(inGamut(srgb)).toBe(true);
    expect(inGamut(linearSrgbToLinearDisplayP3(...srgb))).toBe(true);
  });

  it('leaves a color outside both gamuts outside P3 too', () => {
    // Vivid green past P3's reach: the conversion must not quietly clamp.
    const outside = linearSrgbToLinearDisplayP3(...oklchToLinearSrgb(0.87, 0.34, 142));

    expect(inGamut(outside)).toBe(false);
  });
});

describe('oklchToGamut', () => {
  const fitsSrgb = (lightness: number, chroma: number, hue: number) =>
    oklchToLinearSrgb(lightness, chroma, hue).every(
      (channel) => channel >= -1e-6 && channel <= 1 + 1e-6,
    );

  it('leaves a color that already fits alone, to the bit', () => {
    const [lightness, chroma, hue] = oklchToGamut(0.6, 0.02, 120, 'srgb');

    expect(lightness).toBe(0.6);
    expect(chroma).toBe(0.02);
    expect(hue).toBe(120);
  });

  it('sheds chroma only — lightness and hue survive exactly', () => {
    // paletteOklch.red.light, which sRGB cannot hold. Clipping channels
    // independently would drag lightness down ~0.03 and shift hue; the whole
    // point of mapping is that neither moves, since the palette's design rules
    // are written in lightness deltas and hue spans.
    const [lightness, chroma, hue] = oklchToGamut(0.748, 0.2, 25, 'srgb');

    expect(lightness).toBe(0.748);
    expect(hue).toBe(25);
    expect(chroma).toBeLessThan(0.2);
    expect(fitsSrgb(lightness, chroma, hue)).toBe(true);
  });

  it('lands just inside the boundary, not far short of it', () => {
    // A lazy implementation could return chroma 0 and still be "in gamut".
    const [lightness, chroma, hue] = oklchToGamut(0.628, 0.258, 25, 'srgb');

    expect(chroma).toBeGreaterThan(0.25);
    expect(fitsSrgb(lightness, chroma, hue)).toBe(true);
    // One bisection step past the answer must leave the gamut.
    expect(fitsSrgb(lightness, chroma + 0.002, hue)).toBe(false);
  });

  it('keeps more chroma for P3 than for sRGB', () => {
    const [, toSrgb] = oklchToGamut(0.628, 0.258, 25, 'srgb');
    const [, toP3] = oklchToGamut(0.628, 0.258, 25, 'p3');

    expect(toP3).toBeGreaterThan(toSrgb);
    // This one is inside P3 to begin with, so P3 should not touch it at all.
    expect(toP3).toBe(0.258);
  });

  it('maps a color outside both gamuts down to each of them', () => {
    const [, beyondP3] = oklchToGamut(0.87, 0.34, 142, 'p3');

    expect(beyondP3).toBeLessThan(0.34);
  });

  it('handles the achromatic poles without inventing chroma', () => {
    expect(oklchToGamut(0, 0.2, 120, 'srgb')[1]).toBeCloseTo(0, 2);
    expect(oklchToGamut(1, 0.2, 120, 'srgb')[1]).toBeCloseTo(0, 2);
  });
});

describe('linearChannelToSrgb', () => {
  it('inverts srgbChannelToLinear across the piecewise boundary', () => {
    for (const encoded of [0, 0.01, 0.04045, 0.2, 0.5, 1]) {
      expect(closeTo(linearChannelToSrgb(srgbChannelToLinear(encoded)), encoded)).toBe(true);
    }
  });
});

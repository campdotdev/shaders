// Guards the brand palette against the two mistakes that produced the 2026-07-26
// correction: colors no display can show, and neutral scales drifting off their
// intended tint. Reads L/C/h back through @lovo/matter's own conversions rather
// than parsing strings, so the assertions use the same math the renderer does.
import { linearSrgbToOklch, oklchInGamut, parseColorString } from '@lovo/matter';
import { describe, expect, it } from 'vitest';

import { palette, paletteOklch } from './palette';

/** Every color in the palette as a flat list, labelled by where it lives. */
export function flattenPalette(): Array<{ label: string; value: string }> {
  const entries: Array<{ label: string; value: string }> = [];

  for (const [name, group] of Object.entries(paletteOklch)) {
    if (typeof group === 'string') {
      entries.push({ label: name, value: group });
    } else if (Array.isArray(group)) {
      group.forEach((value, index) => entries.push({ label: `${name}[${index}]`, value }));
    } else {
      for (const [step, value] of Object.entries(group)) {
        entries.push({ label: `${name}.${step}`, value });
      }
    }
  }

  return entries;
}

/**
 * OKLch components of a palette string. The round trip through linear-sRGB is
 * exact for real colors, but chroma 0 leaves hue undefined — atan2(0, 0) returns
 * floating-point noise (about 89.88), so callers must not assert hue on a
 * neutral.
 */
function componentsOf(value: string): { lightness: number; chroma: number; hue: number } {
  const [lightness, chroma, hue] = linearSrgbToOklch(...parseColorString(value));

  return { lightness, chroma, hue };
}

describe('brand palette', () => {
  it('keeps every color inside Display-P3', () => {
    const outside = flattenPalette().filter(({ value }) => {
      const { lightness, chroma, hue } = componentsOf(value);

      return !oklchInGamut(lightness, chroma, hue, 'p3');
    });

    expect(outside.map((entry) => `${entry.label} ${entry.value}`)).toEqual([]);
  });

  it('keeps each hex form on the same lightness and hue as its oklch form', () => {
    // The hex is the sRGB-fitted twin of the oklch: it may shed chroma, but
    // lightness and hue must survive. Channel clipping, the thing this guards
    // against, moves hue instead — it once put sky.dark 14.7 degrees off.
    // Tolerances sit just above the real worst case (0.0016 and 1.84 degrees),
    // which is 8-bit quantization, not drift.
    const drifted: string[] = [];

    for (const [name, group] of Object.entries(palette)) {
      const oklchGroup = paletteOklch[name as keyof typeof paletteOklch];
      let pairs: Array<[string, string, string]>;

      if (typeof group === 'string') {
        pairs = [[name, group, oklchGroup as string]];
      } else if (Array.isArray(group)) {
        pairs = group.map((hex, index) => [
          `${name}[${index}]`,
          hex,
          (oklchGroup as readonly string[])[index] ?? '',
        ]);
      } else {
        pairs = Object.entries(group).map(([step, hex]) => [
          `${name}.${step}`,
          hex,
          (oklchGroup as Record<string, string>)[step] ?? '',
        ]);
      }

      for (const [label, hex, oklch] of pairs) {
        const fromHex = componentsOf(hex);
        const fromOklch = componentsOf(oklch);

        if (Math.abs(fromHex.lightness - fromOklch.lightness) > 0.005) {
          drifted.push(`${label} lightness`);
        }

        // Hue is meaningless without chroma, so near-neutrals are exempt.
        if (fromHex.chroma > 0.015 && fromOklch.chroma > 0.015) {
          const gap = Math.abs(fromHex.hue - fromOklch.hue);

          if (Math.min(gap, 360 - gap) > 3) {
            drifted.push(`${label} hue`);
          }
        }
      }
    }

    expect(drifted).toEqual([]);
  });
});

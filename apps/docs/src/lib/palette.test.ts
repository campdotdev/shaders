// Guards the brand palette against the two mistakes that produced the 2026-07-26
// correction: colors no display can show, and neutral scales drifting off their
// intended tint. Reads L/C/h back through @lovo/matter's own conversions rather
// than parsing strings, so the assertions use the same math the renderer does.
import { linearSrgbToOklch, oklchInGamut, parseColorString } from '@lovo/matter';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { INITIAL as auroraParams } from '../app/components/aurora/params';
import { INITIAL as dotFieldParams } from '../app/components/dot-field/params';
import { INITIAL as linearGradientParams } from '../app/components/linear-gradient/params';
import { INITIAL as meshGradientParams } from '../app/components/mesh-gradient/params';
import { INITIAL as simplexNoiseParams } from '../app/components/simplex-noise/params';
import { INITIAL as vignetteParams } from '../app/components/vignette/params';
import { INITIAL as waveLinesParams } from '../app/components/wave-lines/params';
import { palette, paletteOklch } from './palette';

/** Every color in the palette as a flat list, labelled by where it lives. */
function flattenPalette(): Array<{ label: string; value: string }> {
  const entries: Array<{ label: string; value: string }> = [];

  for (const [name, group] of Object.entries(paletteOklch)) {
    if (typeof group === 'string') {
      entries.push({ label: name, value: group });
    } else {
      group.forEach((value, index) => entries.push({ label: `${name}[${index}]`, value }));
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

/**
 * Every color a demo params module hand-authors, flattened and labelled by
 * where it lives. These never flow through `palette.ts`, so `flattenPalette`
 * above can't see them — this is the walk that would have caught the three
 * wave-lines colors that started this hardening effort.
 */
function flattenDemoColors(): Array<{ label: string; value: string }> {
  const entries: Array<{ label: string; value: string }> = [];

  auroraParams.stops.forEach(({ color }, index) => {
    entries.push({ label: `aurora stops[${index}]`, value: color });
  });

  entries.push({ label: 'dot-field color', value: dotFieldParams.color });

  linearGradientParams.stops.forEach(({ color }, index) => {
    entries.push({ label: `linear-gradient stops[${index}]`, value: color });
  });

  meshGradientParams.palettes.forEach((colors, paletteIndex) => {
    colors.forEach((color, index) => {
      entries.push({ label: `mesh-gradient palettes[${paletteIndex}][${index}]`, value: color });
    });
  });

  simplexNoiseParams.stops.forEach(({ color }, index) => {
    entries.push({ label: `simplex-noise stops[${index}]`, value: color });
  });

  entries.push({ label: 'vignette color', value: vignetteParams.color });

  waveLinesParams.lines.forEach((line, lineIndex) => {
    line.color.forEach((color, stopIndex) => {
      entries.push({
        label: `wave-lines lines[${lineIndex}].color[${stopIndex}]`,
        value: color,
      });
    });
  });

  return entries;
}

/**
 * The twelve accent hues. Every one is a twelve-step scale on the same ladder
 * the neutrals use, so they can all be walked the same way.
 */
const ACCENT_NAMES = [
  'red',
  'orange',
  'amber',
  'lime',
  'green',
  'teal',
  'cyan',
  'sky',
  'blue',
  'violet',
  'purple',
  'magenta',
] as const;

describe('brand palette', () => {
  it('keeps every color inside Display-P3', () => {
    const outside = flattenPalette().filter(({ value }) => {
      const { lightness, chroma, hue } = componentsOf(value);

      return !oklchInGamut(lightness, chroma, hue, 'p3');
    });

    expect(outside.map((entry) => `${entry.label} ${entry.value}`)).toEqual([]);
  });

  it('keeps every demo params color inside Display-P3', () => {
    const outside = flattenDemoColors().filter(({ value }) => {
      const { lightness, chroma, hue } = componentsOf(value);

      return !oklchInGamut(lightness, chroma, hue, 'p3');
    });

    expect(outside.map((entry) => `${entry.label} ${entry.value}`)).toEqual([]);
  });

  it('keeps each hex form on the same lightness and hue as its oklch form', () => {
    // The hex is the sRGB-fitted twin of the oklch: it may shed chroma, but
    // lightness and hue must survive. Channel clipping, the thing this guards
    // against, moves hue instead — it once put sky.dark 14.7 degrees off.
    // The real worst case today (see the tolerance comments below) is 8-bit
    // quantization, not drift.
    const drifted: string[] = [];

    for (const [name, group] of Object.entries(palette)) {
      const oklchGroup = paletteOklch[name as keyof typeof paletteOklch];
      let pairs: Array<[string, string, string]>;

      if (typeof group === 'string') {
        pairs = [[name, group, oklchGroup as string]];
      } else {
        pairs = group.map((hex, index) => [
          `${name}[${index}]`,
          hex,
          (oklchGroup as readonly string[])[index] ?? '',
        ]);
      }

      for (const [label, hex, oklch] of pairs) {
        const fromHex = componentsOf(hex);
        const fromOklch = componentsOf(oklch);

        if (Math.abs(fromHex.lightness - fromOklch.lightness) > 0.005) {
          drifted.push(`${label} lightness`);
        }

        // Hue is meaningless without chroma, so near-neutrals are exempt. This
        // floor sits exactly on moss[9]'s chroma (0.015), so that step is
        // currently exempt by a hair too — nudging its chroma up would pull it
        // into the checked set, where 8-bit quantization noise, not real
        // drift, could fail it.
        if (fromHex.chroma > 0.015 && fromOklch.chroma > 0.015) {
          const gap = Math.abs(fromHex.hue - fromOklch.hue);
          // Near black, one 8-bit step is a large slice of a low-chroma color,
          // so quantization alone swings hue further than it does higher up the
          // ladder — the worst accent entry at L=0.196 lands 3.79 degrees off,
          // and nothing at L>=0.303 exceeds 1.75. Loosening the dark end beats
          // exempting it. Channel clipping, the failure this guards against,
          // once moved an accent 14.7 degrees, so 5 still catches it.
          const tolerance = fromOklch.lightness <= 0.3 ? 5 : 3;

          if (Math.min(gap, 360 - gap) > tolerance) {
            drifted.push(`${label} hue`);
          }
        }
      }
    }

    expect(drifted).toEqual([]);
  });

  it('keeps gray free of any tint', () => {
    const tinted = paletteOklch.gray.filter((value) => componentsOf(value).chroma > 0.0005);

    expect(tinted).toEqual([]);
  });

  it('holds moss on the brand hue wherever it carries tint', () => {
    // Chroma 0 leaves hue undefined, so the lightest step is exempt by design.
    const offHue = paletteOklch.moss.filter((value) => {
      const { chroma, hue } = componentsOf(value);

      return chroma > 0.0005 && Math.abs(hue - 120) > 0.5;
    });

    expect(offHue).toEqual([]);
  });

  it('gives both neutral scales the same lightness ladder', () => {
    const lightnessOf = (value: string) => componentsOf(value).lightness.toFixed(3);

    expect(paletteOklch.moss.map(lightnessOf)).toEqual(paletteOklch.gray.map(lightnessOf));
  });

  it('puts every accent on the shared neutral ladder', () => {
    // The whole point of the twelve-step rework: red[8] and gray[8] are the
    // same brightness, so swapping one for the other never shifts a layout's
    // weight. Comparing at 3 decimals matches how the values are authored.
    const lightnessOf = (value: string) => componentsOf(value).lightness.toFixed(3);
    const ladder = paletteOklch.gray.map(lightnessOf);

    for (const name of ACCENT_NAMES) {
      expect(paletteOklch[name].map(lightnessOf), name).toEqual(ladder);
    }
  });

  it('raises each accent chroma monotonically to its peak rung', () => {
    // Each hue reaches the most saturated version of itself that P3 can show
    // at one rung, and climbs to it without wobbling. Past the peak the curve
    // is allowed to fall steeply — that is the gamut ceiling collapsing toward
    // white, not a mistake, so nothing is asserted about the descent.
    const breaks: string[] = [];

    for (const name of ACCENT_NAMES) {
      const chromas = paletteOklch[name].map((value) => componentsOf(value).chroma);
      const peak = chromas.indexOf(Math.max(...chromas));

      for (let rung = 1; rung <= peak; rung += 1) {
        if ((chromas[rung] ?? 0) <= (chromas[rung - 1] ?? 0)) {
          breaks.push(`${name}[${rung}]`);
        }
      }
    }

    expect(breaks).toEqual([]);
  });

  it('keeps globals.css hex literals in sync with the palette steps they cite', () => {
    // CSS cannot import palette.ts, so globals.css hand-copies hex literals and
    // names their source step in a trailing comment, e.g. `#a4c102; /*
    // limeScale[9], brand chartreuse */`. This walks every such annotation and
    // checks the literal still matches the step it claims to be.
    const globalsCssPath = join(dirname(fileURLToPath(import.meta.url)), '../app/globals.css');
    const globalsCss = readFileSync(globalsCssPath, 'utf-8');

    const annotationPattern = /#([0-9a-f]{6});\s*\/\*\s*([a-zA-Z]+)\[(\d+)\][^*]*\*\//gi;
    const mismatches: string[] = [];
    let annotationCount = 0;
    let match: RegExpExecArray | null;

    while ((match = annotationPattern.exec(globalsCss)) !== null) {
      const [, hex, scaleName, indexText] = match;

      // noUncheckedIndexedAccess types every capture group as possibly
      // undefined, even though the regex requires all three groups to match --
      // narrow explicitly rather than asserting.
      if (hex === undefined || scaleName === undefined || indexText === undefined) {
        continue;
      }

      annotationCount += 1;

      const scale = palette[scaleName as keyof typeof palette];

      if (!Array.isArray(scale)) {
        mismatches.push(`${scaleName}[${indexText}] does not name a known palette scale`);
        continue;
      }

      const step = scale[Number(indexText)];

      if (step === undefined || step.toLowerCase() !== `#${hex.toLowerCase()}`) {
        mismatches.push(
          `${scaleName}[${indexText}] is #${hex} in globals.css but ${step ?? 'undefined'} in the palette`,
        );
      }
    }

    // A regex that silently stops matching would let this test pass on zero
    // annotations, so pin a floor: globals.css annotates well over a dozen
    // values today, and this only needs to prove the pattern still fires.
    expect(annotationCount).toBeGreaterThanOrEqual(8);
    expect(mismatches).toEqual([]);
  });
});

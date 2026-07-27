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

        // Hue is meaningless without chroma, so near-neutrals are exempt. This
        // floor sits exactly on moss[9]'s chroma (0.015), so that step is
        // currently exempt by a hair too — nudging its chroma up would pull it
        // into the checked set, where 8-bit quantization noise, not real
        // drift, could fail it.
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

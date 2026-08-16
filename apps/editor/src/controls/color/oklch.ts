/**
 * The color model behind the ramp editor's color picker. Every color in this
 * codebase is authored as an oklch() string, and everything the picker writes
 * back is one too — the engine's parseColorString accepts only #rrggbb,
 * oklch(), and oklab(), and throws on anything else, so emitting rgb() or
 * hsl() would crash the shader.
 *
 * Ported from apps/docs/src/components/controls/color/oklch.ts (docs demo
 * panels) — the color math is identical; only the docs' path-addressed store
 * wiring around it was left behind (ColorInput/ColorPopoverContents here take
 * plain value/onChange/onCommit props instead).
 */
import { linearSrgbToOklch, parseColorString } from '@lovo/matter/color';

/**
 * OKLCH in one line: lightness is how bright (0 black, 1 white), chroma is how
 * colorful (0 grey, and there is no fixed maximum — it depends on hue and
 * lightness), hue is the angle around the color wheel in degrees. Unlike HSL it
 * is perceptually uniform, so equal steps look equal, and unlike hex it can
 * describe colors outside the sRGB gamut that a P3 display can actually show.
 */
export interface OklchColor {
  /** 0 = black, 1 = white. */
  lightness: number;
  /** 0 = grey. The picker's axis tops out at MAX_CHROMA. */
  chroma: number;
  /** Degrees around the color wheel, [0, 360). */
  hue: number;
}

/**
 * The right edge of the chroma axis. No real color reaches 0.4 at every hue —
 * sRGB tops out near 0.32 and P3 a little past that — so the axis deliberately
 * runs past the gamut, and out-of-gamut territory is drawn dimmed.
 */
export const MAX_CHROMA = 0.4;

const round = (value: number, places: number) => {
  const factor = 10 ** places;

  return Math.round(value * factor) / factor;
};

/**
 * Any color string the engine accepts -> L/C/H numbers for the sliders.
 * oklch() input is read directly rather than round-tripped through linear light,
 * so a value the user typed comes back byte-identical instead of drifting in
 * the last decimal place.
 */
export function parseToOklch(input: string): OklchColor {
  const value = input.trim();

  if (value.startsWith('oklch(')) {
    const closeIndex = value.lastIndexOf(')');

    // Without this check, lastIndexOf's -1 would feed slice as "drop the last
    // character" — "oklch(0.5 0.1 200" would silently parse with hue 20. An
    // unterminated string is invalid, same as a non-numeric token below.
    if (closeIndex === -1) {
      throw new Error(`Invalid oklch() color: "${input}"`);
    }

    const inner = value.slice('oklch('.length, closeIndex);
    const [lightnessToken, chromaToken, hueToken] = (inner.split('/')[0] ?? '')
      .trim()
      .split(/[\s,]+/)
      .filter((token) => token.length > 0);

    if (lightnessToken !== undefined && chromaToken !== undefined && hueToken !== undefined) {
      const readComponent = (token: string, percentScale: number) =>
        token.endsWith('%') ? (parseFloat(token) / 100) * percentScale : parseFloat(token);

      const lightness = readComponent(lightnessToken, 1);
      const chroma = readComponent(chromaToken, MAX_CHROMA);
      const hue = parseFloat(hueToken.replace(/deg$/, ''));

      // parseFloat silently returns NaN for a non-numeric token ("abc") rather
      // than throwing, which would otherwise let a broken value ride all the
      // way to formatOklch and come out as the unparseable "oklch(NaN NaN NaN)".
      if (!Number.isFinite(lightness) || !Number.isFinite(chroma) || !Number.isFinite(hue)) {
        throw new Error(`Invalid oklch() color: "${input}"`);
      }

      return {
        lightness,
        chroma,
        // Wraps into [0, 360) so a pasted out-of-range hue (420deg, -30deg)
        // matches the type's documented range instead of passing straight through.
        hue: ((hue % 360) + 360) % 360,
      };
    }
  }

  const [red, green, blue] = parseColorString(value);
  const [lightness, chroma, hue] = linearSrgbToOklch(red, green, blue);

  return { lightness, chroma, hue };
}

/** L/C/H -> the canonical string written to the store and copied into JSX. */
export function formatOklch({ lightness, chroma, hue }: OklchColor): string {
  return `oklch(${round(lightness, 3)} ${round(chroma, 3)} ${round(hue, 1)})`;
}

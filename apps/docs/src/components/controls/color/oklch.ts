/**
 * The color model behind the color picker. Every color in this codebase is
 * authored as an oklch() string, and everything the picker writes back is one
 * too — the engine's parseColorString accepts only #rrggbb, oklch(), and
 * oklab(), and throws on anything else, so emitting rgb() or hsl() would crash
 * the shader.
 */
import { linearSrgbToOklch, parseColorString, parseOklchString } from '@camp-dev/shaders/color';

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
 * oklch() input is read by the engine's own parser rather than round-tripped
 * through linear light, so a value the user typed comes back byte-identical
 * instead of drifting in the last decimal place.
 */
export function parseToOklch(input: string): OklchColor {
  if (input.trim().startsWith('oklch(')) {
    const [lightness, chroma, hue] = parseOklchString(input);

    return {
      lightness,
      chroma,
      // Wraps into [0, 360) so a pasted out-of-range hue (420deg, -30deg)
      // matches the type's documented range instead of passing straight through.
      hue: ((hue % 360) + 360) % 360,
    };
  }

  const [lightness, chroma, hue] = linearSrgbToOklch(...parseColorString(input));

  return { lightness, chroma, hue };
}

/** L/C/H -> the canonical string written to the store and copied into JSX. */
export function formatOklch({ lightness, chroma, hue }: OklchColor): string {
  return `oklch(${round(lightness, 3)} ${round(chroma, 3)} ${round(hue, 1)})`;
}

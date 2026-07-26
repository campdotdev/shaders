// CPU-side color conversion: decode and encode. Props arrive as color strings
// ('#8b5cf6', 'oklch(0.7 0.15 280)') and get parsed to linear-rgb HERE in
// JavaScript, once — the GPU only ever sees the resulting numbers. The reverse
// direction, linear-rgb back to OKLab/OKLch, lets the docs color picker know
// where to place its sliders. Matrices mirror the TSL versions in oklab.ts exactly.
import { srgbChannelToLinear } from './transfer.js';

/**
 * OKLab (L, a, b) -> extended linear-sRGB. CPU mirror of the TSL `oklabToLinear`
 * in `oklab.ts` (same M2^-1 / cube / M1^-1 matrices). The result is NOT clamped:
 * colors outside sRGB return channels below 0 or above 1, which a wide-gamut
 * output can render and an sRGB output clamps at the framebuffer.
 */
export function oklabToLinearSrgb(
  lightness: number,
  greenRed: number,
  blueYellow: number,
): [number, number, number] {
  const longRoot = lightness + 0.3963377774 * greenRed + 0.2158037573 * blueYellow;
  const mediumRoot = lightness - 0.1055613458 * greenRed - 0.0638541728 * blueYellow;
  const shortRoot = lightness - 0.0894841775 * greenRed - 1.291485548 * blueYellow;

  const longCone = longRoot * longRoot * longRoot;
  const mediumCone = mediumRoot * mediumRoot * mediumRoot;
  const shortCone = shortRoot * shortRoot * shortRoot;

  const red = 4.0767416621 * longCone - 3.3077115913 * mediumCone + 0.2309699292 * shortCone;
  const green = -1.2684380046 * longCone + 2.6097574011 * mediumCone - 0.3413193965 * shortCone;
  const blue = -0.0041960863 * longCone - 0.7034186147 * mediumCone + 1.707614701 * shortCone;

  return [red, green, blue];
}

/** OKLch (L, C, h-in-degrees) -> extended linear-sRGB. */
export function oklchToLinearSrgb(
  lightness: number,
  chroma: number,
  hueDegrees: number,
): [number, number, number] {
  const hueRadians = (hueDegrees * Math.PI) / 180;
  const greenRed = chroma * Math.cos(hueRadians);
  const blueYellow = chroma * Math.sin(hueRadians);

  return oklabToLinearSrgb(lightness, greenRed, blueYellow);
}

/**
 * Extended linear-sRGB -> extended linear Display-P3. Both spaces share the D65
 * white point, so this is one 3x3 matrix and no chromatic adaptation. P3's
 * primaries sit further out, so the same physical color needs smaller
 * coordinates here: a color whose sRGB channels overshoot [0,1] can land inside
 * the P3 cube, which is what "wide gamut" means in practice.
 *
 * Nothing is clamped. A color outside P3 as well returns channels outside
 * [0,1], so callers can test gamut membership on the result. The coefficients
 * carry ten digits so each row sums to exactly 1, which keeps white landing on
 * white rather than a rounding step past it — a gamut test tight enough to be
 * useful near black would otherwise call white out of gamut.
 *
 * Used by the docs color picker, which asks where the sRGB and P3 gamut
 * boundaries fall so it can draw them. The renderer's own P3 output path
 * doesn't come through here — that goes through three's ColorSpaces addon (see
 * `runtime/create-renderer/gamut.ts`).
 */
export function linearSrgbToLinearDisplayP3(
  red: number,
  green: number,
  blue: number,
): [number, number, number] {
  return [
    0.8224619687 * red + 0.1775380313 * green,
    0.0331941989 * red + 0.9668058011 * green,
    0.0170826307 * red + 0.0723974407 * green + 0.9105199286 * blue,
  ];
}

// -------------------------------------------------
// Fitting a color into a gamut it doesn't fit in
// -------------------------------------------------

/** A set of colors a display can show. P3 contains sRGB entirely. */
export type OutputGamut = 'srgb' | 'p3';

/** Slack on the [0,1] channel test. Small enough to keep the boundary honest near black. */
const GAMUT_EPSILON = 1e-9;

/** 24 halvings resolves chroma to well under a part in a million. */
const GAMUT_BISECTION_STEPS = 24;

/**
 * Whether a display of this gamut can show the color at all.
 *
 * The epsilon is deliberately tiny. A loose tolerance accepts colors whose
 * channels are merely small, and because a narrower gamut maps a given OKLCH
 * color to smaller channel values, sRGB would then appear to "contain" more
 * chroma than P3 down near black — a boundary that bulges exactly where it
 * should taper.
 */
export function oklchInGamut(
  lightness: number,
  chroma: number,
  hueDegrees: number,
  gamut: OutputGamut,
): boolean {
  const [red, green, blue] = oklchToLinearSrgb(lightness, chroma, hueDegrees);
  const channels =
    gamut === 'p3' ? linearSrgbToLinearDisplayP3(red, green, blue) : [red, green, blue];

  return channels.every((channel) => channel >= -GAMUT_EPSILON && channel <= 1 + GAMUT_EPSILON);
}

/**
 * The nearest color `gamut` can actually show — what CSS calls a fallback.
 * Chroma is reduced until the color fits; **lightness and hue come back
 * untouched**. Colors that already fit are returned exactly as given.
 *
 * That restraint is the entire point, and it is what separates this from the
 * channel clipping a narrow framebuffer does on its own. Clipping clamps red,
 * green, and blue independently, which changes the ratios between them and so
 * moves the color: `oklch(0.748 0.2 25)` clips to lightness 0.717, and
 * `oklch(0.585 0.205 120)` clips 2.5 degrees off its hue. Shedding chroma along
 * a constant lightness and hue gives up saturation and nothing else, which is
 * the one axis a viewer on a narrow display cannot see anyway.
 *
 * Found by bisection rather than solved: chroma 0 is grey and always fits, the
 * requested chroma does not, so halving walks onto the boundary from inside.
 */
export function oklchToGamut(
  lightness: number,
  chroma: number,
  hueDegrees: number,
  gamut: OutputGamut,
): [number, number, number] {
  if (oklchInGamut(lightness, chroma, hueDegrees, gamut)) {
    return [lightness, chroma, hueDegrees];
  }

  let inside = 0;
  let outside = chroma;

  for (let step = 0; step < GAMUT_BISECTION_STEPS; step += 1) {
    const middle = (inside + outside) / 2;

    if (oklchInGamut(lightness, middle, hueDegrees, gamut)) {
      inside = middle;
    } else {
      outside = middle;
    }
  }

  return [lightness, inside, hueDegrees];
}

// -------------------------------------------------
// The other direction: colors back into OKLch
// -------------------------------------------------
// The picker needs the reverse trip. Given a color the user pasted, where do
// the lightness / chroma / hue sliders sit? These are the same two matrices as
// above, applied forwards rather than inverted, with a cube root where the
// forward path cubes.

/**
 * Extended linear-sRGB -> OKLab (L, a, b). Inverse of `oklabToLinearSrgb`.
 * Inputs outside [0,1] are fine and expected — wide-gamut palette colors decode
 * to channels below 0 or above 1, and `Math.cbrt` handles negatives correctly,
 * so those colors round-trip instead of collapsing to the gamut edge.
 */
export function linearSrgbToOklab(
  red: number,
  green: number,
  blue: number,
): [number, number, number] {
  const longCone = 0.4122214708 * red + 0.5363325363 * green + 0.0514459929 * blue;
  const mediumCone = 0.2119034982 * red + 0.6806995451 * green + 0.1073969566 * blue;
  const shortCone = 0.0883024619 * red + 0.2817188376 * green + 0.6299787005 * blue;

  const longRoot = Math.cbrt(longCone);
  const mediumRoot = Math.cbrt(mediumCone);
  const shortRoot = Math.cbrt(shortCone);

  return [
    0.2104542553 * longRoot + 0.793617785 * mediumRoot - 0.0040720468 * shortRoot,
    1.9779984951 * longRoot - 2.428592205 * mediumRoot + 0.4505937099 * shortRoot,
    0.0259040371 * longRoot + 0.7827717662 * mediumRoot - 0.808675766 * shortRoot,
  ];
}

/**
 * Extended linear-sRGB -> OKLch (L, C, h-in-degrees). Chroma is the distance
 * from the neutral axis and hue is the angle around it, so this is just OKLab's
 * (a, b) pair read in polar form. Hue is normalized to [0, 360) because a
 * slider can't sit at -110.
 */
export function linearSrgbToOklch(
  red: number,
  green: number,
  blue: number,
): [number, number, number] {
  const [lightness, greenRed, blueYellow] = linearSrgbToOklab(red, green, blue);

  const chroma = Math.sqrt(greenRed * greenRed + blueYellow * blueYellow);
  const hueDegrees = (Math.atan2(blueYellow, greenRed) * 180) / Math.PI;

  return [lightness, chroma, (hueDegrees + 360) % 360];
}

/** Parse `50%` -> 0.5 or a bare number. `scale` is the value of 100% (default 1). */
function parseComponent(token: string, scale: number): number {
  const trimmed = token.trim();

  if (trimmed.endsWith('%')) {
    return (parseFloat(trimmed.slice(0, -1)) / 100) * scale;
  }

  return parseFloat(trimmed);
}

/** Split `oklch(...)`/`oklab(...)` inner text into component tokens, dropping `/ alpha`. */
function functionArgs(input: string, prefix: string): string[] {
  const inner = input.slice(prefix.length, input.lastIndexOf(')'));
  const beforeAlpha = inner.split('/')[0] ?? '';

  return beforeAlpha
    .trim()
    .split(/[\s,]+/)
    .filter((token) => token.length > 0);
}

/**
 * Parse a color string to **extended** linear-sRGB. Accepts `#rrggbb`,
 * `oklab(L a b)`, and `oklch(L C H)` (CSS Color 4 syntax: L/C may be percentages,
 * H may carry a `deg` suffix, an optional `/ alpha` is parsed and dropped).
 * Throws on any other syntax.
 */
export function parseColorString(input: string): [number, number, number] {
  const value = input.trim();

  if (value.startsWith('#')) {
    const hex = value.slice(1);

    return [
      srgbChannelToLinear(parseInt(hex.slice(0, 2), 16) / 255),
      srgbChannelToLinear(parseInt(hex.slice(2, 4), 16) / 255),
      srgbChannelToLinear(parseInt(hex.slice(4, 6), 16) / 255),
    ];
  }

  if (value.startsWith('oklch(')) {
    const [lightnessToken, chromaToken, hueToken] = functionArgs(value, 'oklch(');

    if (lightnessToken === undefined || chromaToken === undefined || hueToken === undefined) {
      throw new Error(`Invalid oklch() color: "${input}"`);
    }

    const lightness = parseComponent(lightnessToken, 1);
    const chroma = parseComponent(chromaToken, 0.4);
    const hueDegrees = parseFloat(hueToken.replace(/deg$/, ''));

    return oklchToLinearSrgb(lightness, chroma, hueDegrees);
  }

  if (value.startsWith('oklab(')) {
    const [lightnessToken, aToken, bToken] = functionArgs(value, 'oklab(');

    if (lightnessToken === undefined || aToken === undefined || bToken === undefined) {
      throw new Error(`Invalid oklab() color: "${input}"`);
    }

    return oklabToLinearSrgb(
      parseComponent(lightnessToken, 1),
      parseComponent(aToken, 0.4),
      parseComponent(bToken, 0.4),
    );
  }

  throw new Error(`Unsupported color syntax: "${input}". Use #rrggbb, oklch(...), or oklab(...).`);
}

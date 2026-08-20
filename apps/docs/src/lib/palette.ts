/**
 * Brand palette, defined once per color and grouped by color space.
 *
 * Each color const holds its `hex` (sRGB) and `oklch` (wide-gamut) forms side by
 * side, so both live in one place and a new color space is just another key.
 * The `palette` and `paletteOklch` exports at the bottom are thin projections
 * that expose one space at a time — `palette.red[8]` and `paletteOklch.red[8]`
 * are the same color at two saturations. The twelve accent scales themselves
 * live in `./accents`, which is only large enough to be worth its own file.
 *
 * The two forms are the same color at two saturations, not two different colors.
 * Every `oklch` value sits inside Display-P3; each `hex` is that same color
 * refitted to sRGB by shedding chroma at constant lightness and hue. The oklch
 * scales still reach past sRGB (see `limeScale`) — that is the whole point of
 * the wide-gamut demo pickers — they just no longer reach past what a display
 * can actually produce. `ColorInput` always writes `oklch()` strings, so a demo
 * that wants wide-gamut input must bind an `oklch()` string (e.g.
 * `paletteOklch.moss[8]`), not the hex form.
 *
 * Two rules when editing, both load-bearing. Chroma has a ceiling that varies
 * with lightness and hue, and asking for more does not make a color more vivid —
 * the framebuffer clips each channel independently, which drags hue along with
 * it. Before the 2026-07-26 pass, the accent then called `sky.dark` asked for
 * 0.145 chroma where P3 allows 0.109, and clipping landed it 14.7 degrees off
 * its stated hue. So: keep every oklch value inside P3 (`oklchInGamut` from
 * `@mattermix/shaders` is the check), and derive the hex from it with
 * `oklchToGamut(..., 'srgb')` rather than by clipping.
 */
import { accents } from './accents';

/**
 * Untinted neutral. This is the scale shaders reach for: a tint here would bias
 * gradient mixing and drag a brand cast into output that should read as neutral.
 * Shares its lightness ladder with `moss`, so `gray[n]` and `moss[n]` are the
 * same brightness and swapping between them never shifts a layout's weight.
 */
const gray = {
  hex: [
    '#0E0E0E',
    '#151515',
    '#232323',
    '#2E2E2E',
    '#393939',
    '#464646',
    '#585858',
    '#717171',
    '#8F8F8F',
    '#A4A4A4',
    '#D2D2D2',
    '#E8E8E8',
  ],
  oklch: [
    'oklch(0.163 0 0)',
    'oklch(0.196 0 0)',
    'oklch(0.255 0 0)',
    'oklch(0.303 0 0)',
    'oklch(0.346 0 0)',
    'oklch(0.395 0 0)',
    'oklch(0.460 0 0)',
    'oklch(0.549 0 0)',
    'oklch(0.650 0 0)',
    'oklch(0.720 0 0)',
    'oklch(0.863 0 0)',
    'oklch(0.932 0 0)',
  ],
} as const;

/**
 * Brand neutral: the same ladder as `gray`, rotated onto the brand hue (120,
 * matching `limeScale`) and given just enough chroma to read as green-tinted
 * without behaving like a color. This is what docs chrome and marketing
 * surfaces use.
 *
 * Chroma holds at 0.020 through the dark and mid range, then tapers to 0 by the
 * lightest step — near white, any chroma reads as a cast rather than a neutral.
 * 0.020 is far inside sRGB everywhere on this ladder (the tightest headroom is
 * 0.039, at the darkest step), so the hex and oklch forms are the same color
 * with no gamut fitting between them.
 */
const moss = {
  hex: [
    '#0D0F06',
    '#14170C',
    '#212419',
    '#2D3025',
    '#383B30',
    '#45483C',
    '#565A4D',
    '#6F7366',
    '#8D9184',
    '#A3A69C',
    '#D1D2CF',
    '#E8E8E8',
  ],
  oklch: [
    'oklch(0.163 0.020 120)',
    'oklch(0.196 0.020 120)',
    'oklch(0.255 0.020 120)',
    'oklch(0.303 0.020 120)',
    'oklch(0.346 0.020 120)',
    'oklch(0.395 0.020 120)',
    'oklch(0.460 0.020 120)',
    'oklch(0.549 0.020 120)',
    'oklch(0.650 0.020 120)',
    'oklch(0.720 0.015 120)',
    'oklch(0.863 0.005 120)',
    'oklch(0.932 0.000 120)',
  ],
} as const;

/** Page anchor: the brand's green-black. The darkest step of `moss`. */
const black = {
  hex: moss.hex[0],
  oklch: moss.oklch[0],
} as const;

/** Page anchor: the brand's off-white. The lightest step of `moss`. */
const white = {
  hex: moss.hex[11],
  oklch: moss.oklch[11],
} as const;

const limeScale = {
  hex: [
    '#111505',
    '#171C04',
    '#252D00',
    '#313B00',
    '#3C4800',
    '#485700',
    '#5A6B01',
    '#728701',
    '#93AD02',
    '#A4C102',
    '#CCE288',
    '#E3F0BD',
  ],
  oklch: [
    'oklch(0.185 0.031 120)',
    'oklch(0.216 0.043 120)',
    'oklch(0.280 0.077 120)',
    'oklch(0.331 0.091 120)',
    'oklch(0.377 0.104 120)',
    'oklch(0.428 0.118 120)',
    'oklch(0.496 0.136 120)',
    'oklch(0.585 0.161 120)',
    'oklch(0.703 0.194 120)',
    'oklch(0.761 0.186 120)',
    'oklch(0.875 0.117 120)',
    'oklch(0.933 0.068 120)',
  ],
} as const;

/** Brand chartreuse: the mid-high step of `limeScale`. */
const brandLime = {
  hex: limeScale.hex[9],
  oklch: limeScale.oklch[9],
} as const;

/** sRGB / hex projection. Keys match `paletteOklch`. */
export const palette = {
  black: black.hex,
  white: white.hex,
  gray: gray.hex,
  moss: moss.hex,
  limeScale: limeScale.hex,
  brandLime: brandLime.hex,
  red: accents.red.hex,
  orange: accents.orange.hex,
  amber: accents.amber.hex,
  lime: accents.lime.hex,
  green: accents.green.hex,
  teal: accents.teal.hex,
  cyan: accents.cyan.hex,
  sky: accents.sky.hex,
  blue: accents.blue.hex,
  violet: accents.violet.hex,
  purple: accents.purple.hex,
  magenta: accents.magenta.hex,
} as const;

/** OKLCH / wide-gamut projection. Keys match `palette`. */
export const paletteOklch = {
  black: black.oklch,
  white: white.oklch,
  gray: gray.oklch,
  moss: moss.oklch,
  limeScale: limeScale.oklch,
  brandLime: brandLime.oklch,
  red: accents.red.oklch,
  orange: accents.orange.oklch,
  amber: accents.amber.oklch,
  lime: accents.lime.oklch,
  green: accents.green.oklch,
  teal: accents.teal.oklch,
  cyan: accents.cyan.oklch,
  sky: accents.sky.oklch,
  blue: accents.blue.oklch,
  violet: accents.violet.oklch,
  purple: accents.purple.oklch,
  magenta: accents.magenta.oklch,
} as const;

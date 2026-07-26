/**
 * Brand palette, defined once per color and grouped by color space.
 *
 * Each color const holds its `hex` (sRGB) and `oklch` (wide-gamut) forms side by
 * side, so both live in one place and a new color space is just another key.
 * The `palette` and `paletteOklch` exports at the bottom are thin projections
 * that expose one space at a time — consumers keep referencing `palette.red.base`
 * / `paletteOklch.red.base` exactly as before.
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
 * it. Before this pass `sky.dark` asked for 0.145 chroma where P3 allows 0.109,
 * and clipping landed it 14.7 degrees off its stated hue. So: keep every oklch
 * value inside P3 (`oklchInGamut` from `@lovo/matter` is the check), and derive
 * the hex from it with `oklchToGamut(..., 'srgb')` rather than by clipping.
 */

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

/** Accent: red (h=25). */
const red = {
  hex: { light: '#ff837c', base: '#fe022b', dark: '#b0011b' },
  oklch: {
    light: 'oklch(0.748 0.194 25)',
    base: 'oklch(0.628 0.258 25)',
    dark: 'oklch(0.478 0.210 25)',
  },
} as const;

/** Accent: orange (h=55). */
const orange = {
  hex: { light: '#ff9f5a', base: '#df7301', dark: '#9e5001' },
  oklch: {
    light: 'oklch(0.788 0.155 55)',
    base: 'oklch(0.668 0.188 55)',
    dark: 'oklch(0.518 0.145 55)',
  },
} as const;

/** Accent: amber (h=85). */
const amber = {
  hex: { light: '#ffd67d', base: '#eab102', dark: '#b18501' },
  oklch: {
    light: 'oklch(0.892 0.120 85)',
    base: 'oklch(0.792 0.168 85)',
    dark: 'oklch(0.642 0.140 85)',
  },
} as const;

/** Accent: lime (h=120, brand hue). Sits at the brand's chartreuse hue angle. */
const lime = {
  hex: { light: '#d9f384', base: '#bcdc33', dark: '#90a913' },
  oklch: {
    light: 'oklch(0.922 0.140 120)',
    base: 'oklch(0.842 0.185 120)',
    dark: 'oklch(0.692 0.160 120)',
  },
} as const;

/** Accent: green (h=145.897). Base matches Aurora's original spring green. */
const green = {
  hex: { light: '#84fa90', base: '#0ae24b', dark: '#02ab36' },
  oklch: {
    light: 'oklch(0.892 0.180 145.897)',
    base: 'oklch(0.795 0.242 145.897)',
    dark: 'oklch(0.645 0.200 145.897)',
  },
} as const;

/** Accent: teal (h=175). */
const teal = {
  hex: { light: '#77ebce', base: '#03c8a7', dark: '#01947b' },
  oklch: {
    light: 'oklch(0.865 0.115 175)',
    base: 'oklch(0.745 0.165 175)',
    dark: 'oklch(0.595 0.140 175)',
  },
} as const;

/** Accent: cyan (h=205). */
const cyan = {
  hex: { light: '#5abfca', base: '#029ba7', dark: '#016a73' },
  oklch: {
    light: 'oklch(0.748 0.095 205)',
    base: 'oklch(0.628 0.135 205)',
    dark: 'oklch(0.478 0.108 205)',
  },
} as const;

/** Accent: sky (h=235). */
const sky = {
  hex: { light: '#1b9fda', base: '#0179a9', dark: '#004d6c' },
  oklch: {
    light: 'oklch(0.665 0.135 235)',
    base: 'oklch(0.545 0.151 235)',
    dark: 'oklch(0.395 0.109 235)',
  },
} as const;

/** Accent: blue (h=265.847). Base matches Aurora's original cobalt. */
const blue = {
  hex: { light: '#4370f0', base: '#1837e6', dark: '#0b1e9e' },
  oklch: {
    light: 'oklch(0.585 0.200 265.847)',
    base: 'oklch(0.465 0.258 265.847)',
    dark: 'oklch(0.345 0.200 265.847)',
  },
} as const;

/** Accent: violet (h=293.328). Base matches Aurora's original violet. */
const violet = {
  hex: { light: '#825ddb', base: '#661acc', dark: '#43008d' },
  oklch: {
    light: 'oklch(0.580 0.185 293.328)',
    base: 'oklch(0.460 0.238 293.328)',
    dark: 'oklch(0.340 0.190 293.328)',
  },
} as const;

/** Accent: purple (h=320). */
const purple = {
  hex: { light: '#ba5bcf', base: '#9e01b9', dark: '#610073' },
  oklch: {
    light: 'oklch(0.630 0.190 320)',
    base: 'oklch(0.510 0.245 320)',
    dark: 'oklch(0.360 0.185 320)',
  },
} as const;

/** Accent: magenta (h=343.895). Base matches Aurora's original magenta. */
const magenta = {
  hex: { light: '#e765b8', base: '#cc1a99', dark: '#8a0165' },
  oklch: {
    light: 'oklch(0.693 0.185 343.895)',
    base: 'oklch(0.573 0.232 343.895)',
    dark: 'oklch(0.423 0.190 343.895)',
  },
} as const;

/** sRGB / hex projection. Keys match `paletteOklch`. */
export const palette = {
  black: black.hex,
  white: white.hex,
  gray: gray.hex,
  moss: moss.hex,
  limeScale: limeScale.hex,
  brandLime: brandLime.hex,
  red: red.hex,
  orange: orange.hex,
  amber: amber.hex,
  lime: lime.hex,
  green: green.hex,
  teal: teal.hex,
  cyan: cyan.hex,
  sky: sky.hex,
  blue: blue.hex,
  violet: violet.hex,
  purple: purple.hex,
  magenta: magenta.hex,
} as const;

/** OKLCH / wide-gamut projection. Keys match `palette`. */
export const paletteOklch = {
  black: black.oklch,
  white: white.oklch,
  gray: gray.oklch,
  moss: moss.oklch,
  limeScale: limeScale.oklch,
  brandLime: brandLime.oklch,
  red: red.oklch,
  orange: orange.oklch,
  amber: amber.oklch,
  lime: lime.oklch,
  green: green.oklch,
  teal: teal.oklch,
  cyan: cyan.oklch,
  sky: sky.oklch,
  blue: blue.oklch,
  violet: violet.oklch,
  purple: purple.oklch,
  magenta: magenta.oklch,
} as const;

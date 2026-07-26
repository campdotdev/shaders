/**
 * Brand palette, defined once per color and grouped by color space.
 *
 * Each color const holds its `hex` (sRGB) and `oklch` (wide-gamut) forms side by
 * side, so both live in one place and a new color space is just another key.
 * The `palette` and `paletteOklch` exports at the bottom are thin projections
 * that expose one space at a time — consumers keep referencing `palette.red.base`
 * / `paletteOklch.red.base` exactly as before.
 *
 * The two spaces are hand-maintained and NOT mechanical conversions of each
 * other: the oklch scales push chroma beyond the sRGB gamut (see `limeScale`),
 * which is the whole point of the wide-gamut demo pickers. `ColorInput` always
 * writes `oklch()` strings, so a demo that wants wide-gamut input must bind an
 * `oklch()` string (e.g. `paletteOklch.gray[8]`), not the hex form. Keep
 * the two forms visually paired when editing, but expect the numbers to diverge.
 */

const black = {
  hex: '#0B0F0D',
  oklch: 'oklch(0.163 0.008 163.8)',
} as const;

const white = {
  hex: '#E7E9E7',
  oklch: 'oklch(0.932 0.003 145.5)',
} as const;

const gray = {
  hex: [
    '#0B0F0D',
    '#131614',
    '#202421',
    '#2B302D',
    '#363B38',
    '#424844',
    '#535A55',
    '#6D736E',
    '#8B918C',
    '#A1A6A1',
    '#D0D3CF',
    '#E7E9E7',
  ],
  oklch: [
    'oklch(0.163 0.008 163.8)',
    'oklch(0.196 0.006 156.6)',
    'oklch(0.255 0.008 153.3)',
    'oklch(0.303 0.009 159.6)',
    'oklch(0.346 0.008 159.7)',
    'oklch(0.395 0.010 156.7)',
    'oklch(0.460 0.012 154.8)',
    'oklch(0.549 0.011 150.6)',
    'oklch(0.650 0.010 150.6)',
    'oklch(0.720 0.009 145.5)',
    'oklch(0.863 0.006 137.8)',
    'oklch(0.932 0.003 145.5)',
  ],
} as const;

const limeScale = {
  hex: [
    '#111505',
    '#171C04',
    '#242E00',
    '#2F3C00',
    '#3A4A00',
    '#465900',
    '#576E00',
    '#6E8A00',
    '#91AF00',
    '#A3C100',
    '#CCE288',
    '#E3F0BD',
  ],
  oklch: [
    'oklch(0.185 0.031 120)',
    'oklch(0.216 0.043 120)',
    'oklch(0.280 0.080 120)',
    'oklch(0.331 0.111 120)',
    'oklch(0.377 0.137 120)',
    'oklch(0.428 0.161 120)',
    'oklch(0.496 0.184 120)',
    'oklch(0.585 0.205 120)',
    'oklch(0.703 0.205 120)',
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
  hex: { light: '#ff6f6a', base: '#ff0029', dark: '#b60010' },
  oklch: {
    light: 'oklch(0.748 0.200 25)',
    base: 'oklch(0.628 0.258 25)',
    dark: 'oklch(0.478 0.210 25)',
  },
} as const;

/** Accent: orange (h=55). */
const orange = {
  hex: { light: '#ff9c4d', base: '#ee6600', dark: '#ac4400' },
  oklch: {
    light: 'oklch(0.788 0.155 55)',
    base: 'oklch(0.668 0.205 55)',
    dark: 'oklch(0.518 0.165 55)',
  },
} as const;

/** Accent: amber (h=85). */
const amber = {
  hex: { light: '#ffd57a', base: '#ecb100', dark: '#b38400' },
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
  hex: { light: '#84fa90', base: '#0ae24b', dark: '#00ab34' },
  oklch: {
    light: 'oklch(0.892 0.180 145.897)',
    base: 'oklch(0.795 0.242 145.897)',
    dark: 'oklch(0.645 0.200 145.897)',
  },
} as const;

/** Accent: teal (h=175). */
const teal = {
  hex: { light: '#77ebce', base: '#00cda6', dark: '#00987a' },
  oklch: {
    light: 'oklch(0.865 0.115 175)',
    base: 'oklch(0.745 0.165 175)',
    dark: 'oklch(0.595 0.140 175)',
  },
} as const;

/** Accent: cyan (h=205). */
const cyan = {
  hex: { light: '#5abfca', base: '#009eaf', dark: '#006e7c' },
  oklch: {
    light: 'oklch(0.748 0.095 205)',
    base: 'oklch(0.628 0.135 205)',
    dark: 'oklch(0.478 0.115 205)',
  },
} as const;

/** Accent: sky (h=235). */
const sky = {
  hex: { light: '#1b9fda', base: '#007bc6', dark: '#004d87' },
  oklch: {
    light: 'oklch(0.665 0.135 235)',
    base: 'oklch(0.545 0.175 235)',
    dark: 'oklch(0.395 0.145 235)',
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
  hex: { light: '#825ddb', base: '#661acc', dark: '#43008e' },
  oklch: {
    light: 'oklch(0.580 0.185 293.328)',
    base: 'oklch(0.460 0.238 293.328)',
    dark: 'oklch(0.340 0.190 293.328)',
  },
} as const;

/** Accent: purple (h=320). */
const purple = {
  hex: { light: '#ba5bcf', base: '#9e00ba', dark: '#66007b' },
  oklch: {
    light: 'oklch(0.630 0.190 320)',
    base: 'oklch(0.510 0.245 320)',
    dark: 'oklch(0.360 0.200 320)',
  },
} as const;

/** Accent: magenta (h=343.895). Base matches Aurora's original magenta. */
const magenta = {
  hex: { light: '#e765b8', base: '#cc1a99', dark: '#8c0067' },
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

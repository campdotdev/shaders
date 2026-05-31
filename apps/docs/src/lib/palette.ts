// Matter example color palette.
//
// Brand foundation (gray + lime full 12-step scales) defines the chrome.
// Accent palette (12 hues × light/base/dark) is hand-tuned in OKLCH so that
// `base` lands at or near Aurora's vibrancy. Hues at 25/55/85/115/146/175/
// 205/235/266/293/320/344° around the wheel.
//
// Hex values for the accent palette are sRGB conversions of OKLCH definitions;
// see `palette.gen.ts` for the conversion script. Brand gray and lime hex are
// the canonical brand source (not derived from OKLCH).
//
// Spec: docs/superpowers/specs/2026-05-30-example-palette-design.md

/** Brand black. Equal to gray[0]; aliased for clarity at usage sites. */
export const black = '#0B0F0D'

/** Brand white. Equal to gray[11]; aliased for clarity at usage sites. */
export const white = '#E7E9E7'

/** Brand gray scale. 12 steps, deep ink at index 0 → paper at index 11. */
export const gray = [
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
] as const

/**
 * Brand lime full 12-step scale (h=120). Index 9 (#A3C100) is the canonical
 * brand lime. Used for chrome/foundation contexts that need fine-grained
 * lightness control across the lime hue.
 */
export const limeScale = [
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
] as const

/** Canonical brand lime alias. Equivalent to `limeScale[9]`. */
export const brandLime = limeScale[9]

// Accent palette — { light, base, dark } per hue. All values are OKLCH-derived
// (see palette.gen.ts). `base` is the vibrant peak — at the Aurora-anchored
// hues (green/blue/violet/magenta) it lands within 1 byte of Aurora's
// original hexes, by design.

/** Accent: red (h=25). */
export const red = {
  /** oklch(0.748 0.200 25) */
  light: '#ff6f6a',
  /** oklch(0.628 0.258 25) */
  base: '#ff0029',
  /** oklch(0.478 0.210 25) */
  dark: '#b60010',
} as const

/** Accent: orange (h=55). */
export const orange = {
  /** oklch(0.788 0.155 55) */
  light: '#ff9c4d',
  /** oklch(0.668 0.205 55) */
  base: '#ee6600',
  /** oklch(0.518 0.165 55) */
  dark: '#ac4400',
} as const

/** Accent: amber (h=85). */
export const amber = {
  /** oklch(0.892 0.120 85) */
  light: '#ffd57a',
  /** oklch(0.792 0.168 85) */
  base: '#ecb100',
  /** oklch(0.642 0.140 85) */
  dark: '#b38400',
} as const

/** Accent: lime (h=120, brand hue). Sits at the brand's chartreuse hue angle. */
export const lime = {
  /** oklch(0.922 0.140 120) */
  light: '#d9f384',
  /** oklch(0.842 0.185 120) */
  base: '#bcdc33',
  /** oklch(0.692 0.160 120) */
  dark: '#90a913',
} as const

/** Accent: green (h=145.897). Base matches Aurora's original spring green. */
export const green = {
  /** oklch(0.892 0.180 145.897) */
  light: '#84fa90',
  /** oklch(0.795 0.242 145.897) — Aurora-anchored vibrant */
  base: '#0ae24b',
  /** oklch(0.645 0.200 145.897) */
  dark: '#00ab34',
} as const

/** Accent: teal (h=175). */
export const teal = {
  /** oklch(0.865 0.115 175) */
  light: '#77ebce',
  /** oklch(0.745 0.165 175) */
  base: '#00cda6',
  /** oklch(0.595 0.140 175) */
  dark: '#00987a',
} as const

/** Accent: cyan (h=205). */
export const cyan = {
  /** oklch(0.748 0.095 205) */
  light: '#5abfca',
  /** oklch(0.628 0.135 205) */
  base: '#009eaf',
  /** oklch(0.478 0.115 205) */
  dark: '#006e7c',
} as const

/** Accent: sky (h=235). */
export const sky = {
  /** oklch(0.665 0.135 235) */
  light: '#1b9fda',
  /** oklch(0.545 0.175 235) */
  base: '#007bc6',
  /** oklch(0.395 0.145 235) */
  dark: '#004d87',
} as const

/** Accent: blue (h=265.847). Base matches Aurora's original cobalt. */
export const blue = {
  /** oklch(0.585 0.200 265.847) */
  light: '#4370f0',
  /** oklch(0.465 0.258 265.847) — Aurora-anchored vibrant */
  base: '#1837e6',
  /** oklch(0.345 0.200 265.847) */
  dark: '#0b1e9e',
} as const

/** Accent: violet (h=293.328). Base matches Aurora's original violet. */
export const violet = {
  /** oklch(0.580 0.185 293.328) */
  light: '#825ddb',
  /** oklch(0.460 0.238 293.328) — Aurora-anchored vibrant */
  base: '#661acc',
  /** oklch(0.340 0.190 293.328) */
  dark: '#43008e',
} as const

/** Accent: purple (h=320). */
export const purple = {
  /** oklch(0.630 0.190 320) */
  light: '#ba5bcf',
  /** oklch(0.510 0.245 320) */
  base: '#9e00ba',
  /** oklch(0.360 0.200 320) */
  dark: '#66007b',
} as const

/** Accent: magenta (h=343.895). Base matches Aurora's original magenta. */
export const magenta = {
  /** oklch(0.693 0.185 343.895) */
  light: '#e765b8',
  /** oklch(0.573 0.232 343.895) — Aurora-anchored vibrant */
  base: '#cc1a99',
  /** oklch(0.423 0.190 343.895) */
  dark: '#8c0067',
} as const

/** Convenience grouping for iteration. */
export const palette = {
  black,
  white,
  gray,
  limeScale,
  brandLime,
  red,
  orange,
  amber,
  lime,
  green,
  teal,
  cyan,
  sky,
  blue,
  violet,
  purple,
  magenta,
} as const

/**
 * OKLCH source-of-truth strings for the reference page to render with full
 * fidelity (CSS `oklch()` is more precise than the sRGB hex conversion).
 * Order matches the `palette` export.
 */
export const paletteOklch = {
  // Brand sources are defined as hex; keep them as hex here (browsers render fine).
  black: '#0B0F0D',
  white: '#E7E9E7',
  gray, // hex array — brand source
  // Brand lime scale's canonical form: OKLCH at h=120 (12-step).
  limeScale: [
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
  ] as const,
  // Accent lime triad at h=120 (3-step).
  lime: {
    light: 'oklch(0.922 0.140 120)',
    base: 'oklch(0.842 0.185 120)',
    dark: 'oklch(0.692 0.160 120)',
  },
  red: {
    light: 'oklch(0.748 0.200 25)',
    base: 'oklch(0.628 0.258 25)',
    dark: 'oklch(0.478 0.210 25)',
  },
  orange: {
    light: 'oklch(0.788 0.155 55)',
    base: 'oklch(0.668 0.205 55)',
    dark: 'oklch(0.518 0.165 55)',
  },
  amber: {
    light: 'oklch(0.892 0.120 85)',
    base: 'oklch(0.792 0.168 85)',
    dark: 'oklch(0.642 0.140 85)',
  },
  green: {
    light: 'oklch(0.892 0.180 145.897)',
    base: 'oklch(0.795 0.242 145.897)',
    dark: 'oklch(0.645 0.200 145.897)',
  },
  teal: {
    light: 'oklch(0.865 0.115 175)',
    base: 'oklch(0.745 0.165 175)',
    dark: 'oklch(0.595 0.140 175)',
  },
  cyan: {
    light: 'oklch(0.748 0.095 205)',
    base: 'oklch(0.628 0.135 205)',
    dark: 'oklch(0.478 0.115 205)',
  },
  sky: {
    light: 'oklch(0.665 0.135 235)',
    base: 'oklch(0.545 0.175 235)',
    dark: 'oklch(0.395 0.145 235)',
  },
  blue: {
    light: 'oklch(0.585 0.200 265.847)',
    base: 'oklch(0.465 0.258 265.847)',
    dark: 'oklch(0.345 0.200 265.847)',
  },
  violet: {
    light: 'oklch(0.580 0.185 293.328)',
    base: 'oklch(0.460 0.238 293.328)',
    dark: 'oklch(0.340 0.190 293.328)',
  },
  purple: {
    light: 'oklch(0.630 0.190 320)',
    base: 'oklch(0.510 0.245 320)',
    dark: 'oklch(0.360 0.200 320)',
  },
  magenta: {
    light: 'oklch(0.693 0.185 343.895)',
    base: 'oklch(0.573 0.232 343.895)',
    dark: 'oklch(0.423 0.190 343.895)',
  },
} as const

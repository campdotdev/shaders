// Matter example color palette.
//
// Brand foundation (gray + lime full 12-step scales) defines the chrome.
// Accent palette (4 hues × dark/mid/light) gives example components 12 vibrant
// picks sampled from a shared OKLCH master at perceptually-equivalent steps.
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
  '#0B0F0D', '#131614', '#202421', '#2B302D', '#363B38', '#424844',
  '#535A55', '#6D736E', '#8B918C', '#A1A6A1', '#D0D3CF', '#E7E9E7',
] as const

/** Brand lime scale (h=120). Index 9 (#A3C100) is the canonical brand lime. */
export const lime = [
  '#111505', '#171C04', '#242E00', '#2F3C00', '#3A4A00', '#465900',
  '#576E00', '#6E8A00', '#91AF00', '#A3C100', '#CCE288', '#E3F0BD',
] as const

/** Canonical brand lime alias. Equivalent to `lime[9]`. */
export const brandLime = lime[9]

/** Accent: amber (h=75, warm). */
export const amber = {
  /** oklch(0.338 0.100 75) */
  dark:  '#542d00',
  /** oklch(0.788 0.177 75) — vibrant peak */
  mid:   '#fba600',
  /** oklch(0.894 0.110 75) — soft tint */
  light: '#ffd287',
} as const

/** Accent: blue (h=252, cool primary). */
export const blue = {
  /** oklch(0.328 0.107 252) */
  dark:  '#003569',
  /** oklch(0.682 0.176 252) — vibrant peak */
  mid:   '#359bff',
  /** oklch(0.849 0.107 252) — soft tint */
  light: '#9ad2ff',
} as const

/** Accent: violet (h=295, deep). */
export const violet = {
  /** oklch(0.330 0.105 295) */
  dark:  '#3b2664',
  /** oklch(0.690 0.174 295) — vibrant peak */
  mid:   '#a581fa',
  /** oklch(0.853 0.107 295) — soft tint */
  light: '#d3c1ff',
} as const

/** Accent: pink (h=343, accent / contrast). */
export const pink = {
  /** oklch(0.333 0.103 343) */
  dark:  '#581b44',
  /** oklch(0.694 0.174 343) — vibrant peak */
  mid:   '#e36ab9',
  /** oklch(0.857 0.107 343) — soft tint */
  light: '#ffb4e3',
} as const

/** Convenience grouping for iteration. */
export const palette = { black, white, gray, lime, brandLime, amber, blue, violet, pink } as const

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
  // Lime scale's canonical form: OKLCH at h=120.
  lime: [
    'oklch(0.185 0.031 120)', 'oklch(0.216 0.043 120)', 'oklch(0.280 0.080 120)',
    'oklch(0.331 0.111 120)', 'oklch(0.377 0.137 120)', 'oklch(0.428 0.161 120)',
    'oklch(0.496 0.184 120)', 'oklch(0.585 0.205 120)', 'oklch(0.703 0.205 120)',
    'oklch(0.761 0.186 120)', 'oklch(0.875 0.117 120)', 'oklch(0.933 0.068 120)',
  ] as const,
  amber: {
    dark:  'oklch(0.338 0.100 75)',
    mid:   'oklch(0.788 0.177 75)',
    light: 'oklch(0.894 0.110 75)',
  },
  blue: {
    dark:  'oklch(0.328 0.107 252)',
    mid:   'oklch(0.682 0.176 252)',
    light: 'oklch(0.849 0.107 252)',
  },
  violet: {
    dark:  'oklch(0.330 0.105 295)',
    mid:   'oklch(0.690 0.174 295)',
    light: 'oklch(0.853 0.107 295)',
  },
  pink: {
    dark:  'oklch(0.333 0.103 343)',
    mid:   'oklch(0.694 0.174 343)',
    light: 'oklch(0.857 0.107 343)',
  },
} as const

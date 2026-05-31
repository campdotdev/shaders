// Matter example color palette.
//
// Brand foundation (gray + lime full 12-step scales) defines the chrome.
// Accent palette (13 hues × dark/mid/light) gives example components 39 vibrant
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

/** Accent: crimson (h=17, deep red). */
export const crimson = {
  /** oklch(0.348 0.111 17) */
  dark:  '#681924',
  /** oklch(0.699 0.166 17) — vibrant peak */
  mid:   '#f36c78',
  /** oklch(0.863 0.102 17) — soft tint */
  light: '#ffb7ba',
} as const

/** Accent: red (h=25, warm red). */
export const red = {
  /** oklch(0.338 0.106 25) */
  dark:  '#631919',
  /** oklch(0.712 0.172 25) — vibrant peak */
  mid:   '#fb7069',
  /** oklch(0.866 0.107 25) — soft tint */
  light: '#ffb7af',
} as const

/** Accent: orange (h=55, warm). */
export const orange = {
  /** oklch(0.335 0.103 55) */
  dark:  '#5d2300',
  /** oklch(0.725 0.175 55) — vibrant peak */
  mid:   '#f78313',
  /** oklch(0.869 0.108 55) — soft tint */
  light: '#ffc18e',
} as const

/** Accent: amber (h=75, warm). */
export const amber = {
  /** oklch(0.338 0.100 75) */
  dark:  '#542d00',
  /** oklch(0.788 0.177 75) — vibrant peak */
  mid:   '#fba600',
  /** oklch(0.894 0.110 75) — soft tint */
  light: '#ffd287',
} as const

/** Accent: gold (h=91, yellow-gold). */
export const gold = {
  /** oklch(0.336 0.097 91) */
  dark:  '#4a3300',
  /** oklch(0.780 0.171 91) — vibrant peak */
  mid:   '#e0b100',
  /** oklch(0.892 0.108 91) — soft tint */
  light: '#f6d986',
} as const

/** Accent: green (h=145). */
export const green = {
  /** oklch(0.322 0.103 145) */
  dark:  '#00400a',
  /** oklch(0.676 0.167 145) — vibrant peak */
  mid:   '#47b150',
  /** oklch(0.843 0.107 145) — soft tint */
  light: '#9fdea0',
} as const

/** Accent: emerald (h=165, blue-leaning green). */
export const emerald = {
  /** oklch(0.318 0.113 165) */
  dark:  '#004323',
  /** oklch(0.662 0.178 165) — vibrant peak */
  mid:   '#00b377',
  /** oklch(0.831 0.115 165) — soft tint */
  light: '#78dfb5',
} as const

/** Accent: teal (h=180, cyan). */
export const teal = {
  /** oklch(0.319 0.106 180) */
  dark:  '#004235',
  /** oklch(0.671 0.170 180) — vibrant peak */
  mid:   '#00b599',
  /** oklch(0.839 0.109 180) — soft tint */
  light: '#70e2cd',
} as const

/** Accent: sky (h=210, sky blue). */
export const sky = {
  /** oklch(0.322 0.103 210) */
  dark:  '#003f50',
  /** oklch(0.676 0.167 210) — vibrant peak */
  mid:   '#00b0cf',
  /** oklch(0.843 0.107 210) — soft tint */
  light: '#6cdff2',
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

/** Accent: indigo (h=275). */
export const indigo = {
  /** oklch(0.329 0.104 275) */
  dark:  '#272d69',
  /** oklch(0.685 0.173 275) — vibrant peak */
  mid:   '#7d8dff',
  /** oklch(0.850 0.107 275) — soft tint */
  light: '#b9c8ff',
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
export const palette = {
  black, white, gray, lime, brandLime,
  crimson, red, orange, amber, gold,
  green, emerald, teal, sky, blue,
  indigo, violet, pink,
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
  // Lime scale's canonical form: OKLCH at h=120.
  lime: [
    'oklch(0.185 0.031 120)', 'oklch(0.216 0.043 120)', 'oklch(0.280 0.080 120)',
    'oklch(0.331 0.111 120)', 'oklch(0.377 0.137 120)', 'oklch(0.428 0.161 120)',
    'oklch(0.496 0.184 120)', 'oklch(0.585 0.205 120)', 'oklch(0.703 0.205 120)',
    'oklch(0.761 0.186 120)', 'oklch(0.875 0.117 120)', 'oklch(0.933 0.068 120)',
  ] as const,
  crimson: {
    dark:  'oklch(0.348 0.111 17)',
    mid:   'oklch(0.699 0.166 17)',
    light: 'oklch(0.863 0.102 17)',
  },
  red: {
    dark:  'oklch(0.338 0.106 25)',
    mid:   'oklch(0.712 0.172 25)',
    light: 'oklch(0.866 0.107 25)',
  },
  orange: {
    dark:  'oklch(0.335 0.103 55)',
    mid:   'oklch(0.725 0.175 55)',
    light: 'oklch(0.869 0.108 55)',
  },
  amber: {
    dark:  'oklch(0.338 0.100 75)',
    mid:   'oklch(0.788 0.177 75)',
    light: 'oklch(0.894 0.110 75)',
  },
  gold: {
    dark:  'oklch(0.336 0.097 91)',
    mid:   'oklch(0.780 0.171 91)',
    light: 'oklch(0.892 0.108 91)',
  },
  green: {
    dark:  'oklch(0.322 0.103 145)',
    mid:   'oklch(0.676 0.167 145)',
    light: 'oklch(0.843 0.107 145)',
  },
  emerald: {
    dark:  'oklch(0.318 0.113 165)',
    mid:   'oklch(0.662 0.178 165)',
    light: 'oklch(0.831 0.115 165)',
  },
  teal: {
    dark:  'oklch(0.319 0.106 180)',
    mid:   'oklch(0.671 0.170 180)',
    light: 'oklch(0.839 0.109 180)',
  },
  sky: {
    dark:  'oklch(0.322 0.103 210)',
    mid:   'oklch(0.676 0.167 210)',
    light: 'oklch(0.843 0.107 210)',
  },
  blue: {
    dark:  'oklch(0.328 0.107 252)',
    mid:   'oklch(0.682 0.176 252)',
    light: 'oklch(0.849 0.107 252)',
  },
  indigo: {
    dark:  'oklch(0.329 0.104 275)',
    mid:   'oklch(0.685 0.173 275)',
    light: 'oklch(0.850 0.107 275)',
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

// Matter example color palette.
//
// Brand foundation (gray + lime full 12-step scales) defines the chrome.
// Accent palette (12 hues × dark/mid/light) gives example components 36 vibrant
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

// Accent palette — dark/light are OKLCH-derived (steps 4 and 11); mid uses
// max-chroma OKLCH step 8 for most hues. The four Aurora-anchored hues
// (green, blue, violet, pink) override mid with Aurora's exact original
// hexes — these exceed OKLCH's sRGB gamut (chroma ~0.27) and are the
// canonical "vibrant" for those hues. Aurora's defaults pull from this set.

/** Accent: red (h=25, warm red). */
export const red = {
  /** oklch(0.338 0.106 25) */
  dark:  '#631919',
  /** oklch(0.591 0.192 25) — vibrant peak (max chroma) */
  mid:   '#d83d3e',
  /** oklch(0.866 0.107 25) — soft tint */
  light: '#ffb7af',
} as const

/** Accent: orange (h=55, warm). */
export const orange = {
  /** oklch(0.335 0.103 55) */
  dark:  '#5d2300',
  /** oklch(0.588 0.189 55) — vibrant peak (max chroma) */
  mid:   '#cc5200',
  /** oklch(0.869 0.108 55) — soft tint */
  light: '#ffc18e',
} as const

/** Accent: amber (h=75, warm). */
export const amber = {
  /** oklch(0.338 0.100 75) */
  dark:  '#542d00',
  /** oklch(0.592 0.188 75) — vibrant peak (max chroma) */
  mid:   '#bc6600',
  /** oklch(0.894 0.110 75) — soft tint */
  light: '#ffd287',
} as const

/** Accent: gold (h=91, yellow-gold). */
export const gold = {
  /** oklch(0.336 0.097 91) */
  dark:  '#4a3300',
  /** oklch(0.588 0.183 91) — vibrant peak (max chroma) */
  mid:   '#a57400',
  /** oklch(0.892 0.108 91) — soft tint */
  light: '#f6d986',
} as const

/** Accent: green (h=145). Aurora-anchored: mid is Aurora's original spring green. */
export const green = {
  /** oklch(0.322 0.103 145) */
  dark:  '#00400a',
  /** Aurora original — exceeds OKLCH sRGB gamut (~L 0.81, C 0.27) */
  mid:   '#09e24b',
  /** oklch(0.843 0.107 145) — soft tint */
  light: '#9fdea0',
} as const

/** Accent: emerald (h=165, blue-leaning green). */
export const emerald = {
  /** oklch(0.318 0.113 165) */
  dark:  '#004323',
  /** oklch(0.566 0.202 165) — vibrant peak (max chroma) */
  mid:   '#009857',
  /** oklch(0.831 0.115 165) — soft tint */
  light: '#78dfb5',
} as const

/** Accent: teal (h=180, cyan). */
export const teal = {
  /** oklch(0.319 0.106 180) */
  dark:  '#004235',
  /** oklch(0.567 0.187 180) — vibrant peak (max chroma) */
  mid:   '#00977b',
  /** oklch(0.839 0.109 180) — soft tint */
  light: '#70e2cd',
} as const

/** Accent: sky (h=210, sky blue). */
export const sky = {
  /** oklch(0.322 0.103 210) */
  dark:  '#003f50',
  /** oklch(0.571 0.181 210) — vibrant peak (max chroma) */
  mid:   '#0090b2',
  /** oklch(0.843 0.107 210) — soft tint */
  light: '#6cdff2',
} as const

/** Accent: blue (h=252, cool primary). Aurora-anchored: mid is Aurora's original cobalt. */
export const blue = {
  /** oklch(0.328 0.107 252) */
  dark:  '#003569',
  /** Aurora original — exceeds OKLCH sRGB gamut (~L 0.48, C 0.27) */
  mid:   '#1837e6',
  /** oklch(0.849 0.107 252) — soft tint */
  light: '#9ad2ff',
} as const

/** Accent: indigo (h=275). */
export const indigo = {
  /** oklch(0.329 0.104 275) */
  dark:  '#272d69',
  /** oklch(0.580 0.190 275) — vibrant peak (max chroma) */
  mid:   '#5e69e8',
  /** oklch(0.850 0.107 275) — soft tint */
  light: '#b9c8ff',
} as const

/** Accent: violet (h=295, deep). Aurora-anchored: mid is Aurora's original violet. */
export const violet = {
  /** oklch(0.330 0.105 295) */
  dark:  '#3b2664',
  /** Aurora original — exceeds OKLCH sRGB gamut (~L 0.45, C 0.26) */
  mid:   '#661acc',
  /** oklch(0.853 0.107 295) — soft tint */
  light: '#d3c1ff',
} as const

/** Accent: pink (h=343, accent / contrast). Aurora-anchored: mid is Aurora's original magenta. */
export const pink = {
  /** oklch(0.333 0.103 343) */
  dark:  '#581b44',
  /** Aurora original — exceeds OKLCH sRGB gamut (~L 0.56, C 0.24) */
  mid:   '#cc1a99',
  /** oklch(0.857 0.107 343) — soft tint */
  light: '#ffb4e3',
} as const

/** Convenience grouping for iteration. */
export const palette = {
  black, white, gray, lime, brandLime,
  red, orange, amber, gold,
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
  red: {
    dark:  'oklch(0.338 0.106 25)',
    mid:   'oklch(0.591 0.192 25)',
    light: 'oklch(0.866 0.107 25)',
  },
  orange: {
    dark:  'oklch(0.335 0.103 55)',
    mid:   'oklch(0.588 0.189 55)',
    light: 'oklch(0.869 0.108 55)',
  },
  amber: {
    dark:  'oklch(0.338 0.100 75)',
    mid:   'oklch(0.592 0.188 75)',
    light: 'oklch(0.894 0.110 75)',
  },
  gold: {
    dark:  'oklch(0.336 0.097 91)',
    mid:   'oklch(0.588 0.183 91)',
    light: 'oklch(0.892 0.108 91)',
  },
  green: {
    dark:  'oklch(0.322 0.103 145)',
    // Aurora original — exceeds OKLCH sRGB gamut, so render as hex.
    mid:   '#09e24b',
    light: 'oklch(0.843 0.107 145)',
  },
  emerald: {
    dark:  'oklch(0.318 0.113 165)',
    mid:   'oklch(0.566 0.202 165)',
    light: 'oklch(0.831 0.115 165)',
  },
  teal: {
    dark:  'oklch(0.319 0.106 180)',
    mid:   'oklch(0.567 0.187 180)',
    light: 'oklch(0.839 0.109 180)',
  },
  sky: {
    dark:  'oklch(0.322 0.103 210)',
    mid:   'oklch(0.571 0.181 210)',
    light: 'oklch(0.843 0.107 210)',
  },
  blue: {
    dark:  'oklch(0.328 0.107 252)',
    // Aurora original — exceeds OKLCH sRGB gamut, so render as hex.
    mid:   '#1837e6',
    light: 'oklch(0.849 0.107 252)',
  },
  indigo: {
    dark:  'oklch(0.329 0.104 275)',
    mid:   'oklch(0.580 0.190 275)',
    light: 'oklch(0.850 0.107 275)',
  },
  violet: {
    dark:  'oklch(0.330 0.105 295)',
    // Aurora original — exceeds OKLCH sRGB gamut, so render as hex.
    mid:   '#661acc',
    light: 'oklch(0.853 0.107 295)',
  },
  pink: {
    dark:  'oklch(0.333 0.103 343)',
    // Aurora original — exceeds OKLCH sRGB gamut, so render as hex.
    mid:   '#cc1a99',
    light: 'oklch(0.857 0.107 343)',
  },
} as const

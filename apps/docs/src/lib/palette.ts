const black = '#0B0F0D';

const white = '#E7E9E7';

const gray = [
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
] as const;

const limeScale = [
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
] as const;

const brandLime = limeScale[9];

/** Accent: red (h=25). */
const red = {
  light: '#ff6f6a',
  base: '#ff0029',
  dark: '#b60010',
} as const;

/** Accent: orange (h=55). */
const orange = {
  light: '#ff9c4d',
  base: '#ee6600',
  dark: '#ac4400',
} as const;

/** Accent: amber (h=85). */
const amber = {
  light: '#ffd57a',
  base: '#ecb100',
  dark: '#b38400',
} as const;

/** Accent: lime (h=120, brand hue). Sits at the brand's chartreuse hue angle. */
const lime = {
  light: '#d9f384',
  base: '#bcdc33',
  dark: '#90a913',
} as const;

/** Accent: green (h=145.897). Base matches Aurora's original spring green. */
const green = {
  light: '#84fa90',
  base: '#0ae24b',
  dark: '#00ab34',
} as const;

/** Accent: teal (h=175). */
const teal = {
  light: '#77ebce',
  base: '#00cda6',
  dark: '#00987a',
} as const;

/** Accent: cyan (h=205). */
const cyan = {
  light: '#5abfca',
  base: '#009eaf',
  dark: '#006e7c',
} as const;

/** Accent: sky (h=235). */
const sky = {
  light: '#1b9fda',
  base: '#007bc6',
  dark: '#004d87',
} as const;

/** Accent: blue (h=265.847). Base matches Aurora's original cobalt. */
const blue = {
  light: '#4370f0',
  base: '#1837e6',
  dark: '#0b1e9e',
} as const;

/** Accent: violet (h=293.328). Base matches Aurora's original violet. */
const violet = {
  light: '#825ddb',
  base: '#661acc',
  dark: '#43008e',
} as const;

/** Accent: purple (h=320). */
const purple = {
  light: '#ba5bcf',
  base: '#9e00ba',
  dark: '#66007b',
} as const;

/** Accent: magenta (h=343.895). Base matches Aurora's original magenta. */
const magenta = {
  light: '#e765b8',
  base: '#cc1a99',
  dark: '#8c0067',
} as const;

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
} as const;

export const paletteOklch = {
  black: '#0B0F0D',
  white: '#E7E9E7',
  gray,
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
} as const;

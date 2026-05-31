// One-shot generator. Run via `pnpm tsx apps/docs/src/lib/palette.gen.ts`.
// Output is hand-copied into apps/docs/src/lib/palette.ts. Committed for reproducibility.
//
// NOTE on mid step: 8 hues use OKLCH step 8 (L≈0.58, max chroma C≈0.20).
// The 4 hues that are Aurora-anchored (green, blue, violet, pink) override
// mid with Aurora's exact original hexes — those exceed OKLCH's sRGB gamut
// (chroma ~0.27) and are the canonical vibrant for those hues.
import { formatHex, parse } from 'culori'

const OKLCH = {
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
  indigo: {
    dark:  'oklch(0.329 0.104 275)',
    mid:   'oklch(0.580 0.190 275)',
    light: 'oklch(0.850 0.107 275)',
  },
  // Aurora-anchored hues — only dark+light are generated; mid is overridden
  // in palette.ts with Aurora's exact original hex (see header note).
  green: {
    dark:  'oklch(0.322 0.103 145)',
    light: 'oklch(0.843 0.107 145)',
  },
  blue: {
    dark:  'oklch(0.328 0.107 252)',
    light: 'oklch(0.849 0.107 252)',
  },
  violet: {
    dark:  'oklch(0.330 0.105 295)',
    light: 'oklch(0.853 0.107 295)',
  },
  pink: {
    dark:  'oklch(0.333 0.103 343)',
    light: 'oklch(0.857 0.107 343)',
  },
} as const

for (const [hue, steps] of Object.entries(OKLCH)) {
  console.log(`\n${hue}:`)
  for (const [step, oklch] of Object.entries(steps)) {
    const parsed = parse(oklch)
    if (!parsed) throw new Error(`culori failed to parse ${oklch}`)
    const hex = formatHex(parsed)
    console.log(`  ${step.padEnd(6)} ${oklch.padEnd(28)} -> ${hex}`)
  }
}

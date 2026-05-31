// One-shot generator. Run via `pnpm tsx apps/docs/src/lib/palette.gen.ts`.
// Output is hand-copied into apps/docs/src/lib/palette.ts. Committed for reproducibility.
import { formatHex, parse } from 'culori'

const OKLCH = {
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

for (const [hue, steps] of Object.entries(OKLCH)) {
  console.log(`\n${hue}:`)
  for (const [step, oklch] of Object.entries(steps)) {
    const parsed = parse(oklch)
    if (!parsed) throw new Error(`culori failed to parse ${oklch}`)
    const hex = formatHex(parsed)
    console.log(`  ${step.padEnd(6)} ${oklch.padEnd(28)} -> ${hex}`)
  }
}

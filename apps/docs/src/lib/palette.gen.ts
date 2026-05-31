// One-shot generator. Run via `pnpm tsx apps/docs/src/lib/palette.gen.ts`.
// Output is hand-copied into apps/docs/src/lib/palette.ts. Committed for reproducibility.
import { formatHex, parse } from 'culori'

const OKLCH = {
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

for (const [hue, steps] of Object.entries(OKLCH)) {
  console.log(`\n${hue}:`)
  for (const [step, oklch] of Object.entries(steps)) {
    const parsed = parse(oklch)
    if (!parsed) throw new Error(`culori failed to parse ${oklch}`)
    const hex = formatHex(parsed)
    console.log(`  ${step.padEnd(6)} ${oklch.padEnd(28)} -> ${hex}`)
  }
}

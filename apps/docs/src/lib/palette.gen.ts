import { formatHex, parse } from 'culori';

const OKLCH = {
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
  lime: {
    light: 'oklch(0.922 0.140 120)',
    base: 'oklch(0.842 0.185 120)',
    dark: 'oklch(0.692 0.160 120)',
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

for (const [hue, steps] of Object.entries(OKLCH)) {
  console.log(`\n${hue}:`);
  for (const [step, oklch] of Object.entries(steps)) {
    const parsed = parse(oklch);

    if (!parsed) throw new Error(`culori failed to parse ${oklch}`);
    const hex = formatHex(parsed);

    console.log(`  ${step.padEnd(6)} ${oklch.padEnd(32)} -> ${hex}`);
  }
}

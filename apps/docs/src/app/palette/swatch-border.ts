// Swatch borders for the palette page. A swatch whose colour is close to the
// surface behind it has no visible edge otherwise — near-black chips vanish on
// the dark background, near-white ones on light. The border tracks the SURFACE,
// not the swatch, so it works for every colour on the scale.
import { palette } from '@/lib/palette';

/**
 * A 1px border that reads against `surface`. Mid-neutrals rather than extremes:
 * strong enough to draw an edge, weak enough not to compete with the colour it
 * frames.
 */
export function swatchBorder(surface: 'dark' | 'light'): string {
  return `1px solid ${surface === 'dark' ? palette.gray[6] : palette.gray[9]}`;
}

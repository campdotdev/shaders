/**
 * FractalNoise's style dials for a composition's All props section. The dial
 * table comes from the package's three-free subpath, so the golden test can
 * run this seed in Node.
 */
import { type FractalNoiseStyle, STYLE_DIAL_DEFAULTS } from '@camp-dev/shaders/defaults';

export const isFractalNoiseStyle = (value: unknown): value is FractalNoiseStyle =>
  typeof value === 'string' && value in STYLE_DIAL_DEFAULTS;

/**
 * Fills in contrast and balance from the style's dial defaults where the
 * props leave them out. A composition's store starts from the library
 * defaults, which have none for these two, because the component picks them
 * by style; the Contrast and Balance sliders need a value to show.
 */
export function seedStyleDials(props: Record<string, unknown>): Record<string, unknown> {
  const dials = STYLE_DIAL_DEFAULTS[isFractalNoiseStyle(props.style) ? props.style : 'clouds'];

  return { contrast: dials.contrast, balance: dials.balance, ...props };
}

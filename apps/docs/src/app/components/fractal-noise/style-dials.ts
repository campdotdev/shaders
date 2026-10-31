'use client';

/**
 * FractalNoise's style dials for a composition's All props section. A client
 * module, because the dial table comes from the package root, and the demo
 * registry, which a server route also reads, only hands this function to the
 * Customize panel. On the server it stays a reference and never runs.
 */
import { type FractalNoiseStyle, STYLE_DIAL_DEFAULTS } from '@camp-dev/shaders';

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

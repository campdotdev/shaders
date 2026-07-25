/**
 * Option lists shared by the demo panels. colorSpace and hueInterpolation are
 * engine-wide unions, so every page that exposes them offers the same choices
 * in the same order.
 */
import type { SelectOption } from './SelectInput';

/** Interpolation space — how two colors are mixed, not what gets displayed. */
export const COLOR_SPACE_OPTIONS: readonly SelectOption[] = [
  { label: 'OKLab', value: 'oklab' },
  { label: 'OKLch', value: 'oklch' },
  { label: 'Linear', value: 'linear' },
  { label: 'LCH', value: 'lch' },
  { label: 'HSL', value: 'hsl' },
  { label: 'HSV', value: 'hsv' },
];

/** Which way around the color wheel a hue interpolation travels. */
export const HUE_ARC_OPTIONS: readonly SelectOption[] = [
  { label: 'Shorter', value: 'shorter' },
  { label: 'Longer', value: 'longer' },
  { label: 'Increasing', value: 'increasing' },
  { label: 'Decreasing', value: 'decreasing' },
];

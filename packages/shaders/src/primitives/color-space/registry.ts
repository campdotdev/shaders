import { hslSpace } from './hsl.js';
import { hsvSpace } from './hsv.js';
import { lchSpace } from './lch.js';
import { linearSpace } from './linear.js';
import { oklabSpace } from './oklab.js';
import { oklchSpace } from './oklch.js';
import type { ColorSpace, ColorSpaceImpl } from './types.js';

/** Maps each ColorSpace to its TSL implementation. */
export const colorSpaces: Record<ColorSpace, ColorSpaceImpl> = {
  linear: linearSpace,
  oklab: oklabSpace,
  oklch: oklchSpace,
  lch: lchSpace,
  hsl: hslSpace,
  hsv: hsvSpace,
};

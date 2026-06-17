import { mix, vec3 } from 'three/tsl';

import type { ColorSpaceImpl } from './types.js';

/** Identity space: interpolate raw linear-sRGB values with no conversion. */
export const linearSpace: ColorSpaceImpl = {
  fromLinear: (rgb) => vec3(rgb),
  toLinear: (coords) => vec3(coords),
  lerp: (a, b, t) => mix(a, b, t),
};

import type { ShaderNodeObject } from 'three/tsl';
import { clamp, vec3 } from 'three/tsl';
import type { Node } from 'three/webgpu';

import type { TSLNode } from '../color-ramp/color-ramp.js';
import { hueArcInterpolators } from './hue.js';
import { colorSpaces } from './registry.js';
import type { ColorSpace, HueInterpolation } from './types.js';

/**
 * Blend two linear-sRGB colors in `colorSpace`: convert both endpoints into the
 * space, interpolate, convert back to linear-sRGB. `hueInterpolation` chooses
 * the hue-wheel direction for cylindrical spaces (default `'shorter'`; inert for
 * rectangular spaces). Result is clamped to [0,1] (out-of-gamut colors clipped).
 */
export function mixColor(
  colorA: TSLNode,
  colorB: TSLNode,
  t: TSLNode,
  colorSpace: ColorSpace = 'oklab',
  hueInterpolation: HueInterpolation = 'shorter',
): ShaderNodeObject<Node> {
  const space = colorSpaces[colorSpace];
  const hue = hueArcInterpolators[hueInterpolation];
  const a = space.fromLinear(vec3(colorA));
  const b = space.fromLinear(vec3(colorB));

  return clamp(space.toLinear(space.lerp(a, b, t, hue)), 0, 1);
}

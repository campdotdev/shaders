import type { ShaderNodeObject } from 'three/tsl';
import { vec3 } from 'three/tsl';
import type { Node } from 'three/webgpu';

import type { TSLNode } from '../color-ramp/color-ramp.js';
import { hueArcInterpolators } from './hue.js';
import { colorSpaces } from './registry.js';
import type { ColorSpace, HueInterpolation } from './types.js';

/**
 * Blend two linear-sRGB colors in `colorSpace`: convert both endpoints into the
 * space, interpolate, convert back to linear-sRGB. `hueInterpolation` chooses
 * the hue-wheel direction for cylindrical spaces (default `'shorter'`; inert for
 * rectangular spaces). The result is NOT clamped — extended (out-of-sRGB) values
 * are preserved so a wide-gamut (P3) output can display them; an sRGB output
 * clamps per-channel at the framebuffer, identical to the prior behavior.
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

  return space.toLinear(space.lerp(a, b, t, hue));
}

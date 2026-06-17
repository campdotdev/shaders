import type { ShaderNodeObject } from 'three/tsl';
import { clamp, vec3 } from 'three/tsl';
import type { Node } from 'three/webgpu';

import type { TSLNode } from '../color-ramp/color-ramp.js';
import { colorSpaces } from './registry.js';
import type { ColorSpace } from './types.js';

/**
 * Blend two linear-sRGB colors in `colorSpace`: convert both endpoints into the
 * space, interpolate (shortest-arc hue for cylindrical spaces), convert back to
 * linear-sRGB. Result is clamped to [0,1] (out-of-gamut colors are clipped).
 */
export function mixColor(
  colorA: TSLNode,
  colorB: TSLNode,
  t: TSLNode,
  colorSpace: ColorSpace = 'oklab',
): ShaderNodeObject<Node> {
  const space = colorSpaces[colorSpace];
  const a = space.fromLinear(vec3(colorA));
  const b = space.fromLinear(vec3(colorB));

  return clamp(space.toLinear(space.lerp(a, b, t)), 0, 1);
}

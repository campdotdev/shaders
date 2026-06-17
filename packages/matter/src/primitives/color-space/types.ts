import type { ShaderNodeObject } from 'three/tsl';
import type { Node } from 'three/webgpu';

import type { TSLNode } from '../color-ramp/color-ramp.js';

/** Interpolation space for blending colors. Always converts via linear-sRGB. */
export type ColorSpace = 'linear' | 'oklab' | 'oklch' | 'lch' | 'hsl' | 'hsv';

/**
 * One color space's TSL implementation. `fromLinear`/`toLinear` convert between
 * linear-sRGB and the space's coordinates; `lerp` interpolates two in-space
 * coordinates (with shortest-arc hue for cylindrical spaces).
 */
export interface ColorSpaceImpl {
  fromLinear(rgb: ShaderNodeObject<Node>): ShaderNodeObject<Node>;
  toLinear(coords: ShaderNodeObject<Node>): ShaderNodeObject<Node>;
  lerp(a: ShaderNodeObject<Node>, b: ShaderNodeObject<Node>, t: TSLNode): ShaderNodeObject<Node>;
}

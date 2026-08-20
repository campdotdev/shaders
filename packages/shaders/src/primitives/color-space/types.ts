// The color-space module's contract, and the map of the module:
//   - types.ts (this file): the interface every space implements
//   - registry.ts: ColorSpace keyword -> implementation lookup
//   - transfer.ts: sRGB gamma encode/decode
//   - linear/oklab/oklch/lch/hsl/hsv.ts: the six space implementations
//   - hue.ts: which way around the color wheel cylindrical spaces travel
//   - mix-color.ts + ../color-ramp: the consumers (2-color blend, N-stop ramp)
//   - cpu-convert.ts: CPU-side color-string parsing for prop decode
//
// "Rectangular" spaces (linear, oklab) store a color as three independent
// axes, so blending is a plain per-axis mix. "Cylindrical" spaces (oklch,
// lch, hsl, hsv) store hue as an ANGLE on a wheel — blending needs to pick
// an arc around that wheel, which is hue.ts's whole job.
import type { ShaderNodeObject } from 'three/tsl';
import type { Node } from 'three/webgpu';

import type { TSLNode } from '../color-ramp/color-ramp.js';

/** Interpolation space for blending colors. Always converts via linear-sRGB. */
export type ColorSpace = 'linear' | 'oklab' | 'oklch' | 'lch' | 'hsl' | 'hsv';

/**
 * Which way around the hue wheel cylindrical spaces (oklch/lch/hsl/hsv)
 * interpolate — the CSS Color 4 `hue-interpolation-method` keywords.
 * `shorter`/`longer` pick the arc by length; `increasing`/`decreasing` pick it
 * by direction (and keep multi-stop ramps marching one way around the wheel).
 */
export type HueInterpolation = 'shorter' | 'longer' | 'increasing' | 'decreasing';

/**
 * Interpolates a hue from `h1` to `h2` at `t` along some arc of a `period`-wide
 * wheel (2π for radians, 1 for turns). Rectangular spaces ignore it.
 */
export type ArcHueFn = (
  h1: ShaderNodeObject<Node>,
  h2: ShaderNodeObject<Node>,
  t: TSLNode,
  period: number,
) => ShaderNodeObject<Node>;

/**
 * One color space's TSL implementation. `fromLinear`/`toLinear` convert between
 * linear-sRGB and the space's coordinates; `lerp` interpolates two in-space
 * coordinates, taking the hue-arc strategy `hue` (cylindrical spaces use it,
 * rectangular spaces ignore it).
 */
export interface ColorSpaceImpl {
  fromLinear(rgb: ShaderNodeObject<Node>): ShaderNodeObject<Node>;
  toLinear(coords: ShaderNodeObject<Node>): ShaderNodeObject<Node>;
  lerp(
    a: ShaderNodeObject<Node>,
    b: ShaderNodeObject<Node>,
    t: TSLNode,
    hue: ArcHueFn,
  ): ShaderNodeObject<Node>;
}

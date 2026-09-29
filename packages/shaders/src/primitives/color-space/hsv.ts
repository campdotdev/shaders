// HSV — HSL's sibling picker space (hue, saturation, value/brightness);
// value 1 is the pure hue where HSL needs lightness 0.5. Like HSL it's a
// geometric construction on gamma-encoded sRGB (round-trips through
// transfer.ts, sRGB-only, not perceptually uniform), offered for its
// characteristic mixing look rather than correctness. The hue wheel is
// shared with HSL, in hue-wheel.ts; this file adds value.
import type { ShaderNodeObject } from 'three/tsl';
import { clamp, max, min, mix, vec3 } from 'three/tsl';
import type { Node } from 'three/webgpu';

import { DIVISION_EPSILON, gammaRgbHue, lerpHueFirst, pureHueRgb } from './hue-wheel.js';
import { linearToSrgb, srgbToLinear } from './transfer.js';
import type { ColorSpaceImpl } from './types.js';

/**
 * gamma sRGB -> HSV (h, s, v). Value is the largest channel, and saturation
 * is how far the smallest sits below it, as a fraction of value: 0 for a
 * gray, 1 when some channel is 0.
 */
function gammaRgbToHsv(c: ShaderNodeObject<Node>): ShaderNodeObject<Node> {
  const value = max(c.r, max(c.g, c.b));
  const chroma = value.sub(min(c.r, min(c.g, c.b)));
  const saturation = chroma.div(value.add(DIVISION_EPSILON));

  return vec3(gammaRgbHue(c), saturation, value);
}

/**
 * HSV (h, s, v) -> gamma sRGB. Saturation fades the pure hue toward white,
 * then value scales the result toward black.
 */
function hsvToGammaRgb(hsv: ShaderNodeObject<Node>): ShaderNodeObject<Node> {
  const hue = hsv.x;
  const saturation = hsv.y;
  const value = hsv.z;

  return mix(vec3(1), pureHueRgb(hue), saturation).mul(value);
}

export const hsvSpace: ColorSpaceImpl = {
  // Clamp into sRGB before the gamma transfer: HSV is an sRGB-gamut concept, and
  // the sRGB OETF's pow() can't be WGSL const-evaluated on the negative channels
  // of an out-of-sRGB (wide-gamut) stop color — that crashed the shader compile.
  fromLinear: (rgb) => gammaRgbToHsv(linearToSrgb(clamp(rgb, 0, 1))),
  toLinear: (hsv) => srgbToLinear(hsvToGammaRgb(hsv)),
  lerp: lerpHueFirst,
};

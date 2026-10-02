// HSL — the classic color-picker space (hue wheel, saturation, lightness).
// Unlike oklab/oklch it is NOT perceptually uniform; it's defined
// geometrically on gamma-encoded sRGB values, so the conversion round-trips
// through transfer.ts and the space is inherently sRGB-only. Offered
// because its retro mixing behavior (rainbow sweeps, even lightness ramps
// in the numeric sense) is sometimes exactly the look wanted. The hue wheel
// is shared with HSV, in hue-wheel.ts; this file adds lightness.
import type { ShaderNodeObject } from 'three/tsl';
import { abs, clamp, max, min, vec3 } from 'three/tsl';
import type { Node } from 'three/webgpu';

import { DIVISION_EPSILON, gammaRgbHue, lerpHueFirst, pureHueRgb } from './hue-wheel.js';
import { linearToSrgb, srgbToLinear } from './transfer.js';
import type { ColorSpaceImpl } from './types.js';

/** gamma sRGB -> HSL (h, s, l). */
function gammaRgbToHsl(c: ShaderNodeObject<Node>): ShaderNodeObject<Node> {
  const maxChannel = max(c.r, max(c.g, c.b));
  const minChannel = min(c.r, min(c.g, c.b));
  const lightness = maxChannel.add(minChannel).mul(0.5);
  const chroma = maxChannel.sub(minChannel);
  // s = chroma / (1 - |2L - 1|)
  const saturation = chroma.div(abs(lightness.mul(2).sub(1)).oneMinus().add(DIVISION_EPSILON));

  return vec3(gammaRgbHue(c), saturation, lightness);
}

/** HSL (h, s, l) -> gamma sRGB. */
function hslToGammaRgb(hsl: ShaderNodeObject<Node>): ShaderNodeObject<Node> {
  const hue = hsl.x;
  const saturation = hsl.y;
  const lightness = hsl.z;

  const chroma = abs(lightness.mul(2).sub(1)).oneMinus().mul(saturation);

  return pureHueRgb(hue).sub(0.5).mul(chroma).add(lightness);
}

export const hslSpace: ColorSpaceImpl = {
  // Clamp into sRGB before the gamma transfer: HSL is an sRGB-gamut concept, and
  // the sRGB OETF's pow() can't be WGSL const-evaluated on the negative channels
  // of an out-of-sRGB (wide-gamut) stop color — that crashed the shader compile.
  fromLinear: (rgb) => gammaRgbToHsl(linearToSrgb(clamp(rgb, 0, 1))),
  toLinear: (hsl) => srgbToLinear(hslToGammaRgb(hsl)),
  lerp: lerpHueFirst,
};

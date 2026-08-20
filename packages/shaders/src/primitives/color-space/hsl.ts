// HSL — the classic color-picker space (hue wheel, saturation, lightness).
// Unlike oklab/oklch it is NOT perceptually uniform; it's defined
// geometrically on gamma-encoded sRGB values, so the conversion round-trips
// through transfer.ts and the space is inherently sRGB-only. Offered
// because its retro mixing behavior (rainbow sweeps, even lightness ramps
// in the numeric sense) is sometimes exactly the look wanted. The
// conversions use Sam Hocevar's branchless formulation — see hsv.ts for
// the reference GLSL.
import type { ShaderNodeObject } from 'three/tsl';
import { abs, clamp, fract, max, min, mix, step, vec3, vec4 } from 'three/tsl';
import type { Node } from 'three/webgpu';

import { linearToSrgb, srgbToLinear } from './transfer.js';
import type { ColorSpaceImpl } from './types.js';

const EPSILON = 1e-10;

/** Hocevar branchless hue (turns [0,1)) from gamma RGB — shared shape with HSV. */
function gammaRgbHue(c: ShaderNodeObject<Node>): ShaderNodeObject<Node> {
  const p = mix(vec4(c.b, c.g, -1 / 3, 2 / 3), vec4(c.g, c.b, 0, -1 / 3), step(c.b, c.g));
  const q = mix(vec4(p.x, p.y, p.w, c.r), vec4(c.r, p.y, p.z, p.x), step(p.x, c.r));
  const chroma = q.x.sub(min(q.w, q.y));

  return abs(q.z.add(q.w.sub(q.y).div(chroma.mul(6).add(EPSILON))));
}

/** gamma sRGB -> HSL (h, s, l). */
function gammaRgbToHsl(c: ShaderNodeObject<Node>): ShaderNodeObject<Node> {
  const maxChannel = max(c.r, max(c.g, c.b));
  const minChannel = min(c.r, min(c.g, c.b));
  const lightness = maxChannel.add(minChannel).mul(0.5);
  const chroma = maxChannel.sub(minChannel);
  // s = chroma / (1 - |2L - 1|)
  const saturation = chroma.div(abs(lightness.mul(2).sub(1)).oneMinus().add(EPSILON));

  return vec3(gammaRgbHue(c), saturation, lightness);
}

/** HSL (h, s, l) -> gamma sRGB. */
function hslToGammaRgb(hsl: ShaderNodeObject<Node>): ShaderNodeObject<Node> {
  const hue = hsl.x;
  const saturation = hsl.y;
  const lightness = hsl.z;

  const chroma = abs(lightness.mul(2).sub(1)).oneMinus().mul(saturation);
  // Per-channel triangle-wave hue ramp, same basis as Hocevar's hsv2rgb.
  const ramp = abs(
    fract(vec3(hue).add(vec3(1, 2 / 3, 1 / 3)))
      .mul(6)
      .sub(vec3(3)),
  );
  const hueRgb = clamp(ramp.sub(vec3(1)), 0, 1); // pure-hue color at full chroma

  return hueRgb.sub(0.5).mul(chroma).add(lightness);
}

export const hslSpace: ColorSpaceImpl = {
  // Clamp into sRGB before the gamma transfer: HSL is an sRGB-gamut concept, and
  // the sRGB OETF's pow() can't be WGSL const-evaluated on the negative channels
  // of an out-of-sRGB (wide-gamut) stop color — that crashed the shader compile.
  fromLinear: (rgb) => gammaRgbToHsl(linearToSrgb(clamp(rgb, 0, 1))),
  toLinear: (hsl) => srgbToLinear(hslToGammaRgb(hsl)),
  lerp: (a, b, t, hue) => vec3(hue(a.x, b.x, t, 1), mix(a.y, b.y, t), mix(a.z, b.z, t)),
};

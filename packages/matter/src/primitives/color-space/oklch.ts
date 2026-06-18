import type { ShaderNodeObject } from 'three/tsl';
import { atan2, cos, length, mix, sin, vec2, vec3 } from 'three/tsl';
import type { Node } from 'three/webgpu';

import { linearToOklab, oklabToLinear } from './oklab.js';
import type { ColorSpaceImpl } from './types.js';

const TWO_PI = Math.PI * 2;

/** linear-sRGB -> OKLch (L, C, h). h in radians [-π, π]. */
function linearToOklch(rgb: ShaderNodeObject<Node>): ShaderNodeObject<Node> {
  const lab = linearToOklab(rgb);
  const lightness = lab.x;
  const greenRed = lab.y;
  const blueYellow = lab.z;

  const chroma = length(vec2(greenRed, blueYellow));
  const hue = atan2(blueYellow, greenRed);

  return vec3(lightness, chroma, hue);
}

/** OKLch (L, C, h) -> linear-sRGB. */
function oklchToLinear(lch: ShaderNodeObject<Node>): ShaderNodeObject<Node> {
  const lightness = lch.x;
  const chroma = lch.y;
  const hue = lch.z;

  const greenRed = chroma.mul(cos(hue));
  const blueYellow = chroma.mul(sin(hue));

  return oklabToLinear(vec3(lightness, greenRed, blueYellow));
}

export const oklchSpace: ColorSpaceImpl = {
  fromLinear: linearToOklch,
  toLinear: oklchToLinear,
  lerp: (a, b, t, hue) => vec3(mix(a.x, b.x, t), mix(a.y, b.y, t), hue(a.z, b.z, t, TWO_PI)),
};

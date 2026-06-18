import type { ShaderNodeObject } from 'three/tsl';
import { abs, clamp, fract, min, mix, step, vec3, vec4 } from 'three/tsl';
import type { Node } from 'three/webgpu';

import { linearToSrgb, srgbToLinear } from './transfer.js';
import type { ColorSpaceImpl } from './types.js';

const EPSILON = 1e-10;

// Sam Hocevar's branchless RGB->HSV. Reference (GLSL):
//   vec4 K = vec4(0.0, -1.0/3.0, 2.0/3.0, -1.0);
//   vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
//   vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
//   float d = q.x - min(q.w, q.y);
//   return vec3(abs(q.z + (q.w - q.y)/(6.0*d + e)), d/(q.x + e), q.x);
function gammaRgbToHsv(c: ShaderNodeObject<Node>): ShaderNodeObject<Node> {
  const p = mix(vec4(c.b, c.g, -1 / 3, 2 / 3), vec4(c.g, c.b, 0, -1 / 3), step(c.b, c.g));
  const q = mix(vec4(p.x, p.y, p.w, c.r), vec4(c.r, p.y, p.z, p.x), step(p.x, c.r));
  const chroma = q.x.sub(min(q.w, q.y));
  const hue = abs(q.z.add(q.w.sub(q.y).div(chroma.mul(6).add(EPSILON))));
  const saturation = chroma.div(q.x.add(EPSILON));

  return vec3(hue, saturation, q.x);
}

// Hocevar's branchless HSV->RGB. Reference (GLSL):
//   vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
//   vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
//   return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
function hsvToGammaRgb(hsv: ShaderNodeObject<Node>): ShaderNodeObject<Node> {
  const hue = hsv.x;
  const saturation = hsv.y;
  const value = hsv.z;
  const ramp = abs(
    fract(vec3(hue).add(vec3(1, 2 / 3, 1 / 3)))
      .mul(6)
      .sub(vec3(3)),
  );

  return mix(vec3(1), clamp(ramp.sub(vec3(1)), 0, 1), saturation).mul(value);
}

export const hsvSpace: ColorSpaceImpl = {
  fromLinear: (rgb) => gammaRgbToHsv(linearToSrgb(rgb)),
  toLinear: (hsv) => srgbToLinear(hsvToGammaRgb(hsv)),
  lerp: (a, b, t, hue) => vec3(hue(a.x, b.x, t, 1), mix(a.y, b.y, t), mix(a.z, b.z, t)),
};

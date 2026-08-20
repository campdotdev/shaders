// CIELAB LCh — the older (1976) perceptual space that CSS `lch()` exposes;
// provided so Shaders' colorSpace options line up with CSS Color 4. Same
// polar idea as OKLch (lightness, chroma, hue-angle) but derived through
// CIE XYZ, the 1931 measurement space, with lightness on a 0..100 scale.
// The route: rgb -> XYZ (a weighted-sum matrix) -> Lab's f() nonlinearity
// relative to the D65 white point (the standard "daylight" white that sRGB
// assumes) -> polar coordinates. OKLch is usually the better-behaved pick;
// this exists for parity.
import type { ShaderNodeObject } from 'three/tsl';
import { atan2, cbrt, cos, length, mix, sin, step, vec2, vec3 } from 'three/tsl';
import type { Node } from 'three/webgpu';

import type { ColorSpaceImpl } from './types.js';

const TWO_PI = Math.PI * 2;

// D65 reference white (CIE 1931 2°).
const WHITE_X = 0.95047;
const WHITE_Y = 1.0;
const WHITE_Z = 1.08883;

// CIELAB nonlinearity constants.
const EPSILON = 216 / 24389; // ~0.008856
const KAPPA = 24389 / 27; // ~903.3

/** CIELAB forward nonlinearity f(t), branchless via step/mix. */
function labForward(ratio: ShaderNodeObject<Node>): ShaderNodeObject<Node> {
  const linearPart = ratio.mul(KAPPA).add(16).div(116);
  const cubeRootPart = cbrt(ratio);

  return mix(linearPart, cubeRootPart, step(EPSILON, ratio));
}

/** CIELAB inverse nonlinearity, branchless via step/mix on f^3. */
function labInverse(f: ShaderNodeObject<Node>): ShaderNodeObject<Node> {
  const cubed = f.mul(f).mul(f);
  const linearPart = f.mul(116).sub(16).div(KAPPA);

  return mix(linearPart, cubed, step(EPSILON, cubed));
}

/** linear-sRGB -> CIELAB LCh (L, C, h). h in radians. */
function linearToLch(rgb: ShaderNodeObject<Node>): ShaderNodeObject<Node> {
  const r = rgb.r;
  const g = rgb.g;
  const b = rgb.b;

  // linear-sRGB -> CIE XYZ (D65).
  const x = r.mul(0.4123907993).add(g.mul(0.3575843394)).add(b.mul(0.1804807884));
  const y = r.mul(0.2126390059).add(g.mul(0.7151686788)).add(b.mul(0.0721923154));
  const z = r.mul(0.0193308187).add(g.mul(0.1191947798)).add(b.mul(0.9505321522));

  const fx = labForward(x.div(WHITE_X));
  const fy = labForward(y.div(WHITE_Y));
  const fz = labForward(z.div(WHITE_Z));

  const lightness = fy.mul(116).sub(16);
  const greenRed = fx.sub(fy).mul(500);
  const blueYellow = fy.sub(fz).mul(200);

  const chroma = length(vec2(greenRed, blueYellow));
  const hue = atan2(blueYellow, greenRed);

  return vec3(lightness, chroma, hue);
}

/** CIELAB LCh (L, C, h) -> linear-sRGB. */
function lchToLinear(lch: ShaderNodeObject<Node>): ShaderNodeObject<Node> {
  const lightness = lch.x;
  const chroma = lch.y;
  const hue = lch.z;

  const greenRed = chroma.mul(cos(hue));
  const blueYellow = chroma.mul(sin(hue));

  const fy = lightness.add(16).div(116);
  const fx = fy.add(greenRed.div(500));
  const fz = fy.sub(blueYellow.div(200));

  const x = labInverse(fx).mul(WHITE_X);
  const y = labInverse(fy).mul(WHITE_Y);
  const z = labInverse(fz).mul(WHITE_Z);

  // CIE XYZ (D65) -> linear-sRGB.
  const r = x.mul(3.2409699419).sub(y.mul(1.5373831776)).sub(z.mul(0.4986107603));
  const g = x.mul(-0.9692436363).add(y.mul(1.8759675015)).add(z.mul(0.0415550574));
  const b = x.mul(0.0556300797).sub(y.mul(0.2039769589)).add(z.mul(1.0569715142));

  return vec3(r, g, b);
}

export const lchSpace: ColorSpaceImpl = {
  fromLinear: linearToLch,
  toLinear: lchToLinear,
  lerp: (a, b, t, hue) => vec3(mix(a.x, b.x, t), mix(a.y, b.y, t), hue(a.z, b.z, t, TWO_PI)),
};

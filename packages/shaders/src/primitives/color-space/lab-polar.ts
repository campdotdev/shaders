// The polar form of a Lab space, which OKLch and CIE LCh share. A Lab color
// stores two color axes, a (green to red) and b (blue to yellow). The polar
// form stores the same point as chroma, its distance from gray, and hue, its
// angle around the wheel. The conversion doesn't care which Lab it runs on,
// so oklch.ts pairs it with oklab.ts and lch.ts pairs it with CIELAB.
import type { ShaderNodeObject } from 'three/tsl';
import { atan2, cos, length, mix, sin, vec2, vec3 } from 'three/tsl';
import type { Node } from 'three/webgpu';

import type { ColorSpaceImpl } from './types.js';

// One full turn of the hue wheel, in radians, the unit atan2 returns. The
// hue-arc functions in hue.ts wrap around this period.
const TWO_PI = Math.PI * 2;

// ----------------------------------------------------------------------------
// Lab -> polar
// ----------------------------------------------------------------------------

/**
 * Lab (L, a, b) -> polar (L, C, h), with h in radians [-π, π].
 *
 * Chroma is the length of the (a, b) vector: 0 for a gray, and larger the
 * more vivid the color. Hue is that vector's angle, measured from the +a
 * (red) axis toward +b (yellow). atan2 takes both components, so it keeps
 * the quadrant that a plain atan(b / a) would lose. Lightness passes through.
 */
export function labToPolar(lab: ShaderNodeObject<Node>): ShaderNodeObject<Node> {
  const lightness = lab.x;
  const greenRed = lab.y;
  const blueYellow = lab.z;

  const chroma = length(vec2(greenRed, blueYellow));
  const hue = atan2(blueYellow, greenRed);

  return vec3(lightness, chroma, hue);
}

// ----------------------------------------------------------------------------
// Polar -> Lab
// ----------------------------------------------------------------------------

/**
 * Polar (L, C, h) -> Lab (L, a, b). cos(h) and sin(h) are the unit vector
 * pointing at angle h, and scaling it by chroma puts the color back at its
 * distance from gray.
 */
export function polarToLab(lch: ShaderNodeObject<Node>): ShaderNodeObject<Node> {
  const lightness = lch.x;
  const chroma = lch.y;
  const hue = lch.z;

  const greenRed = chroma.mul(cos(hue));
  const blueYellow = chroma.mul(sin(hue));

  return vec3(lightness, greenRed, blueYellow);
}

// ----------------------------------------------------------------------------
// Blending
// ----------------------------------------------------------------------------

/**
 * Blends two polar colors. Lightness and chroma mix straight, and the hue
 * travels the arc `hue` picks around a wheel 2π wide. HSL and HSV store hue
 * first instead, and blend through lerpHueFirst in hue-wheel.ts.
 */
export const lerpHueLast: ColorSpaceImpl['lerp'] = (a, b, t, hue) =>
  vec3(mix(a.x, b.x, t), mix(a.y, b.y, t), hue(a.z, b.z, t, TWO_PI));

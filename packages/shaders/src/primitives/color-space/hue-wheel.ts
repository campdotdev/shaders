// The hue wheel HSL and HSV share. Both are geometric constructions on
// gamma-encoded sRGB with the same wheel of pure hues: hsl.ts adds lightness
// and hsv.ts adds value. The math is Sam Hocevar's branchless formulation,
// which sorts the channels with step() and mix() instead of if/else, so the
// GPU runs one straight-line path for every pixel.
import type { ShaderNodeObject } from 'three/tsl';
import { abs, clamp, fract, min, mix, step, vec3, vec4 } from 'three/tsl';
import type { Node } from 'three/webgpu';

import type { ColorSpaceImpl } from './types.js';

// Added to a divisor that can reach 0, so the division stays finite: chroma
// on a gray, value on black, and HSL's 1 - |2L - 1| on black and white. Far
// too small to move any visible color.
export const DIVISION_EPSILON = 1e-10;

// ----------------------------------------------------------------------------
// RGB -> hue
// ----------------------------------------------------------------------------

/**
 * The hue of a gamma-sRGB color, in turns [0, 1): 0 red, 1/3 green, 2/3 blue.
 *
 * Reference GLSL:
 *   vec4 K = vec4(0.0, -1.0/3.0, 2.0/3.0, -1.0);
 *   vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
 *   vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
 *   float d = q.x - min(q.w, q.y);
 *   return abs(q.z + (q.w - q.y) / (6.0 * d + e));
 *
 * `p` sorts green against blue, and `q` sorts the winner against red, so
 * `q.x` is the largest channel. Each sort also carries a sector offset in its
 * z and w lanes: which third of the wheel the largest channel owns. `d` is
 * the chroma, the largest channel minus the smallest. The last line places
 * the hue inside that sector by how far the other two channels differ,
 * relative to the chroma.
 */
export function gammaRgbHue(c: ShaderNodeObject<Node>): ShaderNodeObject<Node> {
  const p = mix(vec4(c.b, c.g, -1 / 3, 2 / 3), vec4(c.g, c.b, 0, -1 / 3), step(c.b, c.g));
  const q = mix(vec4(p.x, p.y, p.w, c.r), vec4(c.r, p.y, p.z, p.x), step(p.x, c.r));
  const chroma = q.x.sub(min(q.w, q.y));

  return abs(q.z.add(q.w.sub(q.y).div(chroma.mul(6).add(DIVISION_EPSILON))));
}

// ----------------------------------------------------------------------------
// Hue -> RGB
// ----------------------------------------------------------------------------

/**
 * The fully saturated color at `hue` (in turns): each channel in [0, 1].
 *
 * Reference GLSL:
 *   vec3 p = abs(fract(h + vec3(1.0, 2.0/3.0, 1.0/3.0)) * 6.0 - 3.0);
 *   return clamp(p - 1.0, 0.0, 1.0);
 *
 * Each channel is a triangle wave over the wheel, shifted a third of a turn
 * from the next. `fract` wraps the shifted hue into [0, 1), `* 6 - 3` maps it
 * to [-3, 3], and `abs` folds that into a V running 3 -> 0 -> 3. Subtracting
 * 1 and clamping to [0, 1] cuts the V into a trapezoid: the channel is fully
 * on for a third of the wheel, fully off for a third, and ramps in between.
 * At hue 0 that gives red (1, 0, 0), and at 1/3 green (0, 1, 0).
 */
export function pureHueRgb(hue: ShaderNodeObject<Node>): ShaderNodeObject<Node> {
  const ramp = abs(
    fract(vec3(hue).add(vec3(1, 2 / 3, 1 / 3)))
      .mul(6)
      .sub(vec3(3)),
  );

  return clamp(ramp.sub(vec3(1)), 0, 1);
}

// ----------------------------------------------------------------------------
// Blending
// ----------------------------------------------------------------------------

/**
 * Blends two (hue, saturation, third-axis) colors. The hue travels the arc
 * `hue` picks around a wheel one turn wide, and the other two channels mix
 * straight.
 */
export const lerpHueFirst: ColorSpaceImpl['lerp'] = (a, b, t, hue) =>
  vec3(hue(a.x, b.x, t, 1), mix(a.y, b.y, t), mix(a.z, b.z, t));

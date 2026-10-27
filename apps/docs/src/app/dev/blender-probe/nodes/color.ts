// SPDX-License-Identifier: GPL-2.0-or-later
//
// Blender's color nodes, ported to TSL from Blender 5.2.3's
// gpu_shader_common_color_utils.glsl, gpu_shader_material_mix_color.glsl,
// gpu_shader_material_hue_sat_val.glsl, gpu_shader_material_gamma.glsl, and
// gpu_shader_material_bright_contrast.glsl. Colors are vec4 in Blender's
// scene-linear space; alpha rides along as the fourth channel.
import {
  abs,
  clamp,
  dot,
  float,
  floor,
  fract,
  If,
  max,
  min,
  mix,
  pow,
  select,
  vec3,
  vec4,
} from 'three/tsl';

import { gpuFunction, type TSLNode } from './gpu-function';

// The luma weights of Blender's default color config (config.ocio, `luma`),
// which its RGB to BW node and its color-to-float conversion both use.
const LUMINANCE = [0.2126, 0.7152, 0.0722] as const;

/** RGB to BW: the color's luminance. */
export function rgbToBw(color: TSLNode): TSLNode {
  return dot(color.rgb, vec3(...LUMINANCE));
}

// ----------------------------------------------------------------------------
// HSV
// ----------------------------------------------------------------------------

/** Blender's rgb_to_hsv: hue in [0, 1), saturation, and value, alpha kept. */
export const rgbToHsv = gpuFunction('blenderRgbToHsv', 'vec4', [['rgb', 'vec4']], ([rgb]) => {
  const cmax = max(rgb.x, max(rgb.y, rgb.z)).toVar();
  const cmin = min(rgb.x, min(rgb.y, rgb.z));
  const cdelta = cmax.sub(cmin).toVar();
  const s = float(0).toVar();
  const h = float(0).toVar();

  If(cmax.notEqual(0), () => {
    s.assign(cdelta.div(cmax));
  });
  If(s.notEqual(0), () => {
    const c = vec3(cmax).sub(rgb.xyz).div(cdelta).toVar();

    If(rgb.x.equal(cmax), () => {
      h.assign(c.z.sub(c.y));
    })
      .ElseIf(rgb.y.equal(cmax), () => {
        h.assign(float(2).add(c.x).sub(c.z));
      })
      .Else(() => {
        h.assign(float(4).add(c.y).sub(c.x));
      });
    h.divAssign(6);
    If(h.lessThan(0), () => {
      h.addAssign(1);
    });
  });

  return vec4(h, s, cmax, rgb.w);
});

/** Blender's hsv_to_rgb, the inverse of rgbToHsv. */
const hsvToRgb = gpuFunction('blenderHsvToRgb', 'vec4', [['hsv', 'vec4']], ([hsv]) => {
  const h = hsv.x.toVar();
  const s = hsv.y;
  const v = hsv.z;
  const rgb = vec3(v, v, v).toVar();

  If(s.notEqual(0), () => {
    If(h.equal(1), () => {
      h.assign(0);
    });
    h.mulAssign(6);
    // The hue's sextant picks which channel is full, which is empty, and
    // which ramps.
    const i = floor(h).toVar();
    const f = h.sub(i).toVar();
    const p = v.mul(float(1).sub(s)).toVar();
    const q = v.mul(float(1).sub(s.mul(f))).toVar();
    const t = v.mul(float(1).sub(s.mul(float(1).sub(f)))).toVar();

    If(i.equal(0), () => {
      rgb.assign(vec3(v, t, p));
    })
      .ElseIf(i.equal(1), () => {
        rgb.assign(vec3(q, v, p));
      })
      .ElseIf(i.equal(2), () => {
        rgb.assign(vec3(p, v, t));
      })
      .ElseIf(i.equal(3), () => {
        rgb.assign(vec3(p, q, v));
      })
      .ElseIf(i.equal(4), () => {
        rgb.assign(vec3(t, p, v));
      })
      .Else(() => {
        rgb.assign(vec3(v, p, q));
      });
  });

  return vec4(rgb, hsv.w);
});

/**
 * The Hue/Saturation/Value node. A hue of 0.5 leaves the hue unchanged.
 * The blend and the clamp at 0 follow Cycles' svm_node_hsv, which renders
 * the reference. Blender's GLSL leaves the clamp out.
 */
export function hueSaturationValue(
  color: TSLNode,
  hue: TSLNode,
  saturation: TSLNode,
  value: TSLNode,
  fac: TSLNode,
): TSLNode {
  const hsv = rgbToHsv(color).toVar();

  hsv.x.assign(fract(hsv.x.add(hue).add(0.5)));
  hsv.y.assign(clamp(hsv.y.mul(saturation), 0, 1));
  hsv.z.assign(hsv.z.mul(value));

  const blended = hsvToRgb(hsv)
    .rgb.mul(fac)
    .add(color.rgb.mul(float(1).sub(fac)));

  return vec4(max(blended, 0), color.a);
}

// ----------------------------------------------------------------------------
// Gamma and Bright/Contrast
// ----------------------------------------------------------------------------

/** Blender's compatible_pow: pow that accepts a negative base. */
export function compatiblePow(x: TSLNode, y: TSLNode): TSLNode {
  const magnitude = pow(abs(x), y);
  // An even exponent of a negative base is positive, an odd one negative.
  const negativeBase = select(y.negate().mod(2).equal(0), magnitude, magnitude.negate());

  return select(
    y.equal(0),
    float(1),
    select(x.lessThan(0), negativeBase, select(x.equal(0), float(0), magnitude)),
  );
}

export function gamma(color: TSLNode, exponent: TSLNode): TSLNode {
  const channel = (c: TSLNode) => select(c.greaterThan(0), compatiblePow(c, exponent), c);

  return vec4(channel(color.r), channel(color.g), channel(color.b), color.a);
}

export function brightContrast(color: TSLNode, brightness: TSLNode, contrast: TSLNode): TSLNode {
  const a = float(1).add(contrast);
  const b = brightness.sub(contrast.mul(0.5));

  return vec4(max(a.mul(color.rgb).add(b), 0), color.a);
}

// ----------------------------------------------------------------------------
// Mix Color blend modes
// ----------------------------------------------------------------------------
// col1 is the Mix node's A, col2 its B, and fac its already-clamped Factor.

type Blend = (fac: TSLNode, col1: TSLNode, col2: TSLNode) => TSLNode;

// Applies a per-channel rule to rgb and keeps col1's alpha.
function perChannel(col1: TSLNode, col2: TSLNode, rule: (c1: TSLNode, c2: TSLNode) => TSLNode) {
  return vec4(rule(col1.r, col2.r), rule(col1.g, col2.g), rule(col1.b, col2.b), col1.a);
}

function withAlpha(rgb: TSLNode, col1: TSLNode): TSLNode {
  return vec4(rgb.xyz, col1.a);
}

// Hue, Saturation, Value, and Color swap HSV components from col2 into col1.
const blendHue: Blend = (fac, col1, col2) => {
  const hsv2 = rgbToHsv(col2).toVar();
  const hsv = rgbToHsv(col1).toVar();

  hsv.x.assign(hsv2.x);

  return select(hsv2.y.notEqual(0), withAlpha(mix(col1, hsvToRgb(hsv), fac), col1), col1);
};

const blendSaturation: Blend = (fac, col1, col2) => {
  const hsv = rgbToHsv(col1).toVar();
  const hsv2 = rgbToHsv(col2);

  hsv.y.assign(float(1).sub(fac).mul(hsv.y).add(fac.mul(hsv2.y)));

  return select(rgbToHsv(col1).y.notEqual(0), hsvToRgb(hsv), col1);
};

const blendValue: Blend = (fac, col1, col2) => {
  const hsv = rgbToHsv(col1).toVar();
  const hsv2 = rgbToHsv(col2);

  hsv.z.assign(float(1).sub(fac).mul(hsv.z).add(fac.mul(hsv2.z)));

  return hsvToRgb(hsv);
};

const blendColor: Blend = (fac, col1, col2) => {
  const hsv2 = rgbToHsv(col2).toVar();
  const hsv = rgbToHsv(col1).toVar();

  hsv.x.assign(hsv2.x);
  hsv.y.assign(hsv2.y);

  return select(hsv2.y.notEqual(0), withAlpha(mix(col1, hsvToRgb(hsv), fac), col1), col1);
};

const BLENDS: Record<string, Blend> = {
  MIX: (fac, col1, col2) => mix(col1, col2, fac),
  ADD: (fac, col1, col2) => withAlpha(mix(col1, col1.add(col2), fac), col1),
  MULTIPLY: (fac, col1, col2) => withAlpha(mix(col1, col1.mul(col2), fac), col1),
  SUBTRACT: (fac, col1, col2) => withAlpha(mix(col1, col1.sub(col2), fac), col1),
  SCREEN: (fac, col1, col2) => {
    const facm = float(1).sub(fac);
    const one = vec4(1);

    return withAlpha(
      one.sub(
        vec4(facm)
          .add(fac.mul(one.sub(col2)))
          .mul(one.sub(col1)),
      ),
      col1,
    );
  },
  DIVIDE: (fac, col1, col2) =>
    perChannel(col1, col2, (c1, c2) =>
      select(c2.notEqual(0), float(1).sub(fac).mul(c1).add(fac.mul(c1).div(c2)), c1),
    ),
  DIFFERENCE: (fac, col1, col2) => withAlpha(mix(col1, abs(col1.sub(col2)), fac), col1),
  EXCLUSION: (fac, col1, col2) =>
    withAlpha(max(mix(col1, col1.add(col2).sub(float(2).mul(col1).mul(col2)), fac), 0), col1),
  DARKEN: (fac, col1, col2) => vec4(mix(col1.rgb, min(col1.rgb, col2.rgb), fac), col1.a),
  LIGHTEN: (fac, col1, col2) => vec4(mix(col1.rgb, max(col1.rgb, col2.rgb), fac), col1.a),
  OVERLAY: (fac, col1, col2) => {
    const facm = float(1).sub(fac);

    return perChannel(col1, col2, (c1, c2) =>
      select(
        c1.lessThan(0.5),
        c1.mul(facm.add(float(2).mul(fac).mul(c2))),
        float(1).sub(facm.add(float(2).mul(fac).mul(float(1).sub(c2))).mul(float(1).sub(c1))),
      ),
    );
  },
  DODGE: (fac, col1, col2) =>
    perChannel(col1, col2, (c1, c2) => {
      const tmp = float(1).sub(fac.mul(c2));
      const ratio = c1.div(tmp);

      return select(
        c1.notEqual(0),
        select(tmp.lessThanEqual(0), float(1), select(ratio.greaterThan(1), float(1), ratio)),
        c1,
      );
    }),
  BURN: (fac, col1, col2) =>
    perChannel(col1, col2, (c1, c2) => {
      const tmp = float(1).sub(fac).add(fac.mul(c2));
      const burned = float(1).sub(float(1).sub(c1).div(tmp));

      return select(tmp.lessThanEqual(0), float(0), clamp(burned, 0, 1));
    }),
  HUE: blendHue,
  SATURATION: blendSaturation,
  VALUE: blendValue,
  COLOR: blendColor,
  SOFT_LIGHT: (fac, col1, col2) => {
    const facm = float(1).sub(fac);
    const one = vec4(1);
    const screen = one.sub(one.sub(col2).mul(one.sub(col1)));

    return withAlpha(
      facm.mul(col1).add(fac.mul(one.sub(col1).mul(col2).mul(col1).add(col1.mul(screen)))),
      col1,
    );
  },
  LINEAR_LIGHT: (fac, col1, col2) =>
    withAlpha(col1.add(fac.mul(float(2).mul(col2.sub(vec4(0.5))))), col1),
};

/** The Mix node in Color mode. */
export function mixColor(
  blendType: string,
  fac: TSLNode,
  col1: TSLNode,
  col2: TSLNode,
  clampFactor: boolean,
  clampResult: boolean,
): TSLNode {
  const blend = BLENDS[blendType];

  if (!blend) throw new Error(`Mix blend type ${blendType} is not ported`);

  const factor = clampFactor ? clamp(fac, 0, 1) : fac;
  const result = blend(factor, col1, col2);

  return clampResult ? clamp(result, vec4(0), vec4(1)) : result;
}

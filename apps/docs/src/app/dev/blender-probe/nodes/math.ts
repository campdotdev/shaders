// SPDX-License-Identifier: GPL-2.0-or-later
//
// Blender's Math, Map Range, Clamp, Vector Math, and Vector Rotate nodes,
// ported to TSL from Blender 5.2.3's GLSL for each node and its safe helpers
// in gpu_shader_math_safe_lib.glsl. Blender's "safe" variants return 0 where
// plain GLSL would divide by zero or take a log of a negative, and the port
// keeps each guard.
import {
  abs,
  acos,
  asin,
  atan,
  atan2,
  ceil,
  clamp,
  cos,
  cross,
  degrees,
  distance,
  dot,
  exp,
  float,
  floor,
  fract,
  inverseSqrt,
  length,
  log2,
  max,
  min,
  normalize,
  radians,
  select,
  sign,
  sin,
  sqrt,
  tan,
  trunc,
  vec3,
} from 'three/tsl';

import { compatiblePow } from './color';
import type { TSLNode } from './gpu-function';

// ----------------------------------------------------------------------------
// Safe helpers
// ----------------------------------------------------------------------------

function safeDivide(a: TSLNode, b: TSLNode): TSLNode {
  return select(b.notEqual(0), a.div(b), float(0));
}

// C's fmod: the remainder after truncating the quotient toward zero.
function compatibleMod(a: TSLNode, b: TSLNode): TSLNode {
  return select(b.notEqual(0), a.sub(trunc(a.div(b)).mul(b)), float(0));
}

function wrap(a: TSLNode, b: TSLNode, c: TSLNode): TSLNode {
  const range = b.sub(c);
  const s = select(a.notEqual(b), floor(a.sub(c).div(range)), float(1));

  return select(range.notEqual(0), a.sub(range.mul(s)), c);
}

function smoothMin(a: TSLNode, b: TSLNode, c: TSLNode): TSLNode {
  const h = max(c.sub(abs(a.sub(b))), 0).div(c);

  return select(
    c.notEqual(0),
    min(a, b).sub(
      h
        .mul(h)
        .mul(h)
        .mul(c)
        .mul(1 / 6),
    ),
    min(a, b),
  );
}

// ----------------------------------------------------------------------------
// Math
// ----------------------------------------------------------------------------

type MathOp = (a: TSLNode, b: TSLNode, c: TSLNode) => TSLNode;

const MATH: Record<string, MathOp> = {
  ADD: (a, b) => a.add(b),
  SUBTRACT: (a, b) => a.sub(b),
  MULTIPLY: (a, b) => a.mul(b),
  DIVIDE: (a, b) => safeDivide(a, b),
  MULTIPLY_ADD: (a, b, c) => a.mul(b).add(c),
  POWER: (a, b) => {
    // A negative base takes only a near-integer exponent, rounded.
    const fraction = abs(b).sub(floor(abs(b)));
    const nearInteger = fraction.greaterThan(0.999).or(fraction.lessThan(0.001));

    return select(
      a.greaterThanEqual(0),
      compatiblePow(a, b),
      select(nearInteger, compatiblePow(a, floor(b.add(0.5))), float(0)),
    );
  },
  LOGARITHM: (a, b) =>
    select(a.greaterThan(0).and(b.greaterThan(0)), log2(a).div(log2(b)), float(0)),
  SQRT: (a) => select(a.greaterThan(0), sqrt(a), float(0)),
  INVERSE_SQRT: (a) => inverseSqrt(a),
  ABSOLUTE: (a) => abs(a),
  EXPONENT: (a) => exp(a),
  MINIMUM: (a, b) => min(a, b),
  MAXIMUM: (a, b) => max(a, b),
  LESS_THAN: (a, b) => select(a.lessThan(b), float(1), float(0)),
  GREATER_THAN: (a, b) => select(a.greaterThan(b), float(1), float(0)),
  SIGN: (a) => sign(a),
  COMPARE: (a, b, c) => select(abs(a.sub(b)).lessThanEqual(max(c, 1e-5)), float(1), float(0)),
  SMOOTH_MIN: (a, b, c) => smoothMin(a, b, c),
  SMOOTH_MAX: (a, b, c) => smoothMin(a.negate(), b.negate(), c).negate(),
  ROUND: (a) => floor(a.add(0.5)),
  FLOOR: (a) => floor(a),
  CEIL: (a) => ceil(a),
  TRUNC: (a) => trunc(a),
  FRACT: (a) => a.sub(floor(a)),
  MODULO: (a, b) => compatibleMod(a, b),
  FLOORED_MODULO: (a, b) => select(b.notEqual(0), a.sub(floor(a.div(b)).mul(b)), float(0)),
  WRAP: (a, b, c) => wrap(a, b, c),
  SNAP: (a, b) => floor(safeDivide(a, b)).mul(b),
  PINGPONG: (a, b) =>
    select(
      b.notEqual(0),
      abs(
        fract(a.sub(b).div(b.mul(2)))
          .mul(b)
          .mul(2)
          .sub(b),
      ),
      float(0),
    ),
  SINE: (a) => sin(a),
  COSINE: (a) => cos(a),
  TANGENT: (a) => tan(a),
  ARCSINE: (a) => select(a.lessThanEqual(1).and(a.greaterThanEqual(-1)), asin(a), float(0)),
  ARCCOSINE: (a) => select(a.lessThanEqual(1).and(a.greaterThanEqual(-1)), acos(a), float(0)),
  ARCTANGENT: (a) => atan(a),
  ARCTAN2: (a, b) => select(a.equal(0).and(b.equal(0)), float(0), atan2(a, b)),
  RADIANS: (a) => radians(a),
  DEGREES: (a) => degrees(a),
};

/** The Math node. With useClamp, the result is clamped to [0, 1]. */
export function mathNode(
  operation: string,
  a: TSLNode,
  b: TSLNode,
  c: TSLNode,
  useClamp: boolean,
): TSLNode {
  const op = MATH[operation];

  if (!op) throw new Error(`Math operation ${operation} is not ported`);

  const result = op(a, b, c);

  return useClamp ? clamp(result, 0, 1) : result;
}

// ----------------------------------------------------------------------------
// Map Range and Clamp
// ----------------------------------------------------------------------------

// Blender's smootherstep: Perlin's quintic fade over the edge range.
// GLSL's smoothstep, written out: 3t^2 - 2t^3 over the edge range. WGSL
// rejects a smoothstep() whose constant edges are equal, as the
// reversed-clamp gotcha in docs/agents/tsl.md describes, and a Map Range
// with From Min equal to From Max has them.
function smoothstepCurve(edge0: TSLNode, edge1: TSLNode, x: TSLNode): TSLNode {
  const t = clamp(x.sub(edge0).div(edge1.sub(edge0)), 0, 1);

  return t.mul(t).mul(float(3).sub(t.mul(2)));
}

function smootherstep(edge0: TSLNode, edge1: TSLNode, x: TSLNode): TSLNode {
  const t = clamp(safeDivide(x.sub(edge0), edge1.sub(edge0)), 0, 1);

  return t
    .mul(t)
    .mul(t)
    .mul(t.mul(t.mul(6).sub(15)).add(10));
}

export interface MapRangeInputs {
  value: TSLNode;
  fromMin: TSLNode;
  fromMax: TSLNode;
  toMin: TSLNode;
  toMax: TSLNode;
  steps: TSLNode;
}

/** The Map Range node in Float mode. */
export function mapRange(
  interpolation: string,
  inputs: MapRangeInputs,
  useClamp: boolean,
): TSLNode {
  const { value, fromMin, fromMax, toMin, toMax, steps } = inputs;
  const toRange = toMax.sub(toMin);
  const linearFactor = value.sub(fromMin).div(fromMax.sub(fromMin));
  let factor: TSLNode;

  switch (interpolation) {
    case 'LINEAR':
      factor = linearFactor;
      break;
    case 'STEPPED':
      factor = select(
        steps.greaterThan(0),
        floor(linearFactor.mul(steps.add(1))).div(steps),
        float(0),
      );
      break;
    case 'SMOOTHSTEP':
      factor = select(
        fromMin.greaterThan(fromMax),
        float(1).sub(smoothstepCurve(fromMax, fromMin, value)),
        smoothstepCurve(fromMin, fromMax, value),
      );
      break;
    case 'SMOOTHERSTEP':
      factor = select(
        fromMin.greaterThan(fromMax),
        float(1).sub(smootherstep(fromMax, fromMin, value)),
        smootherstep(fromMin, fromMax, value),
      );
      break;
    default:
      throw new Error(`Map Range interpolation ${interpolation} is not ported`);
  }

  const result = select(fromMax.notEqual(fromMin), toMin.add(factor.mul(toRange)), float(0));

  // Only Linear and Stepped clamp; the smooth curves already stay in range.
  if (useClamp && (interpolation === 'LINEAR' || interpolation === 'STEPPED')) {
    return clampNode('RANGE', result, toMin, toMax);
  }

  return result;
}

/** The Clamp node. Range mode accepts min and max in either order. */
export function clampNode(clampType: string, value: TSLNode, low: TSLNode, high: TSLNode): TSLNode {
  if (clampType === 'MINMAX') return min(max(value, low), high);

  // min(max()) rather than clamp(), because the unpicked branch has its
  // bounds backwards: the reversed-clamp gotcha in docs/agents/tsl.md.
  return select(high.greaterThan(low), min(max(value, low), high), min(max(value, high), low));
}

// ----------------------------------------------------------------------------
// Vector Math
// ----------------------------------------------------------------------------

type VectorOp = (a: TSLNode, b: TSLNode, c: TSLNode, scale: TSLNode) => TSLNode;

const VECTOR_OPS: Record<string, VectorOp> = {
  ADD: (a, b) => a.add(b),
  SUBTRACT: (a, b) => a.sub(b),
  MULTIPLY: (a, b) => a.mul(b),
  DIVIDE: (a, b) => vec3(safeDivide(a.x, b.x), safeDivide(a.y, b.y), safeDivide(a.z, b.z)),
  CROSS_PRODUCT: (a, b) => cross(a, b),
  SCALE: (a, _b, _c, scale) => a.mul(scale),
  NORMALIZE: (a) => select(dot(a, a).greaterThan(0), normalize(a), a),
  FLOOR: (a) => floor(a),
  CEIL: (a) => ceil(a),
  FRACTION: (a) => fract(a),
  ABSOLUTE: (a) => abs(a),
  MINIMUM: (a, b) => min(a, b),
  MAXIMUM: (a, b) => max(a, b),
  SNAP: (a, b) =>
    vec3(safeDivide(a.x, b.x), safeDivide(a.y, b.y), safeDivide(a.z, b.z)).floor().mul(b),
  MODULO: (a, b) => vec3(compatibleMod(a.x, b.x), compatibleMod(a.y, b.y), compatibleMod(a.z, b.z)),
  WRAP: (a, b, c) => vec3(wrap(a.x, b.x, c.x), wrap(a.y, b.y, c.y), wrap(a.z, b.z, c.z)),
  SINE: (a) => sin(a),
  COSINE: (a) => cos(a),
  TANGENT: (a) => tan(a),
};

const VECTOR_VALUE_OPS: Record<string, VectorOp> = {
  DOT_PRODUCT: (a, b) => dot(a, b),
  DISTANCE: (a, b) => distance(a, b),
  LENGTH: (a) => length(a),
};

/** The Vector Math node. Returns its Vector and Value outputs. */
export function vectorMath(
  operation: string,
  a: TSLNode,
  b: TSLNode,
  c: TSLNode,
  scale: TSLNode,
): { vector: TSLNode; value: TSLNode } {
  const vectorOp = VECTOR_OPS[operation];
  const valueOp = VECTOR_VALUE_OPS[operation];

  if (vectorOp) return { vector: vectorOp(a, b, c, scale), value: float(0) };
  if (valueOp) return { vector: vec3(0), value: valueOp(a, b, c, scale) };

  throw new Error(`Vector Math operation ${operation} is not ported`);
}

// ----------------------------------------------------------------------------
// Vector Rotate
// ----------------------------------------------------------------------------

// Rodrigues' rotation of p around a unit axis by angle radians, written out
// term by term as Blender's rotate_around_axis is.
function rotateAroundAxis(p: TSLNode, axis: TSLNode, angle: TSLNode): TSLNode {
  const cosTheta = cos(angle).toVar();
  const sinTheta = sin(angle).toVar();
  const oneMinusCos = float(1).sub(cosTheta).toVar();
  const { x, y, z } = { x: axis.x, y: axis.y, z: axis.z };

  return vec3(
    cosTheta
      .add(oneMinusCos.mul(x).mul(x))
      .mul(p.x)
      .add(oneMinusCos.mul(x).mul(y).sub(z.mul(sinTheta)).mul(p.y))
      .add(oneMinusCos.mul(x).mul(z).add(y.mul(sinTheta)).mul(p.z)),
    oneMinusCos
      .mul(x)
      .mul(y)
      .add(z.mul(sinTheta))
      .mul(p.x)
      .add(cosTheta.add(oneMinusCos.mul(y).mul(y)).mul(p.y))
      .add(oneMinusCos.mul(y).mul(z).sub(x.mul(sinTheta)).mul(p.z)),
    oneMinusCos
      .mul(x)
      .mul(z)
      .sub(y.mul(sinTheta))
      .mul(p.x)
      .add(oneMinusCos.mul(y).mul(z).add(x.mul(sinTheta)).mul(p.y))
      .add(cosTheta.add(oneMinusCos.mul(z).mul(z)).mul(p.z)),
  );
}

/** The Vector Rotate node, in its axis modes. */
export function vectorRotate(
  rotationType: string,
  vector: TSLNode,
  center: TSLNode,
  axis: TSLNode,
  angle: TSLNode,
  invert: boolean,
): TSLNode {
  const signedAngle = invert ? angle.negate() : angle;
  const fixedAxes: Record<string, TSLNode> = {
    X_AXIS: vec3(1, 0, 0),
    Y_AXIS: vec3(0, 1, 0),
    Z_AXIS: vec3(0, 0, 1),
  };
  const offset = vector.sub(center);

  if (rotationType === 'AXIS_ANGLE') {
    const rotated = rotateAroundAxis(offset, normalize(axis), signedAngle).add(center);

    return select(length(axis).notEqual(0), rotated, vector);
  }

  const fixedAxis = fixedAxes[rotationType];

  if (!fixedAxis) throw new Error(`Vector Rotate type ${rotationType} is not ported`);

  return rotateAroundAxis(offset, fixedAxis, signedAngle).add(center);
}

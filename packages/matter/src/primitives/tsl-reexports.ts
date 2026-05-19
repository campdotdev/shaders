// Stable surface for TSL primitives matter consumers reach for constantly.
// Re-exporting through @lovo/matter means user code has one import path
// and we can absorb three.js TSL renames without breaking downstream code.

export {
  uniform,
  vec2,
  vec3,
  vec4,
  mix,
  smoothstep,
  mod,
  sin,
  cos,
  length,
  dot,
  normalize,
  uv,
  max,
  min,
} from 'three/tsl';

import { time as _builtinTime } from 'three/tsl';
import { getReducedMotionTimeScale } from '../runtime/reducedMotion.js';
import type { ShaderNodeObject } from 'three/tsl';
import type { Node } from 'three/webgpu';

/**
 * Engine-gated `time`: equals the TSL built-in `time` multiplied by the
 * reduced-motion scale uniform. Components consuming `time` from `@lovo/matter`
 * automatically respect `prefers-reduced-motion` and the policy override set
 * via `setReducedMotionPolicy`.
 *
 * If you want raw uncapped time (e.g. for a debug overlay), import
 * `time` from `three/tsl` directly.
 */
export const time: ShaderNodeObject<Node> = _builtinTime.mul(
  getReducedMotionTimeScale(),
);

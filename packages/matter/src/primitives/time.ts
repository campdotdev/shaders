// Engine-gated `time` — equals the TSL built-in `time` multiplied by the
// reduced-motion scale uniform. Components consuming `time` from `@lovo/matter`
// automatically respect `prefers-reduced-motion` and the policy override set
// via `setReducedMotionPolicy`.
//
// If you want raw uncapped time (e.g. for a debug overlay), import `time`
// from `three/tsl` directly.

import { time as _builtinTime } from 'three/tsl';
import type { ShaderNodeObject } from 'three/tsl';
import type { Node } from 'three/webgpu';
import { getReducedMotionTimeScale } from '../runtime/reducedMotion.js';

export const time: ShaderNodeObject<Node> = _builtinTime.mul(
  getReducedMotionTimeScale(),
);

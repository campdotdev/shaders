// Engine-gated `time` — equals the TSL built-in `time` multiplied by the
// reduced-motion scale uniform. Components consuming `time` from `@camp-dev/shaders`
// automatically respect `prefers-reduced-motion` and the policy override set
// via `setReducedMotionPolicy`.
//
// If you want raw uncapped time (e.g. for a debug overlay), import `time`
// from `three/tsl` directly.
import { time as _builtinTime } from 'three/tsl';
import type { ShaderNodeObject } from 'three/tsl';
import type { Node } from 'three/webgpu';

import { getReducedMotionTimeScale } from '../../runtime/reduced-motion/reduced-motion.js';

export const elapsedTime: ShaderNodeObject<Node> = _builtinTime.mul(getReducedMotionTimeScale());

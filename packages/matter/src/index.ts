// @lovo/matter — engine package public API.

export { createRenderer } from './runtime/create-renderer/create-renderer.js';
export type {
  GpuRenderer,
  GpuBackend,
  CreateRendererOptions,
  OutputGamut,
} from './runtime/create-renderer/create-renderer.js';

export { CursorInput } from './inputs/cursor-input/cursor-input.js';
export type { CursorInputOptions, Vector2 } from './inputs/cursor-input/cursor-input.js';

export { colorRamp } from './primitives/color-ramp/color-ramp.js';
export type { ColorRampStop, TSLNode } from './primitives/color-ramp/color-ramp.js';

export {
  mixColor,
  srgbChannelToLinear,
  linearChannelToSrgb,
  oklabToLinearSrgb,
  oklchToLinearSrgb,
  linearSrgbToOklab,
  linearSrgbToOklch,
  parseColorString,
} from './primitives/color-space/index.js';
export type { ColorSpace, HueInterpolation } from './primitives/color-space/index.js';

export { simplexNoise } from './primitives/noise/noise.js';

export { fractalNoise } from './primitives/fbm/fbm.js';
export type { FractalNoiseOptions } from './primitives/fbm/fbm.js';

export { voronoi } from './primitives/voronoi/voronoi.js';

export { quantize } from './primitives/quantize/quantize.js';

export { signedDistanceFieldCircle } from './primitives/sdf-circle/sdf-circle.js';

export { displace } from './primitives/displace/displace.js';

export { cursorRipple } from './primitives/cursor-ripple/cursor-ripple.js';
export type { CursorRippleOptions } from './primitives/cursor-ripple/cursor-ripple.js';

export { elapsedTime } from './primitives/time/time.js';

export { resetRendererClock } from './runtime/clock/reset-clock.js';

export { grain } from './primitives/grain/grain.js';

export { dither } from './primitives/dither/dither.js';

export {
  setReducedMotionPolicy,
  getReducedMotionPolicy,
  getReducedMotionTimeScale,
  createReducedMotionWatcher,
} from './runtime/reduced-motion/reduced-motion.js';
export type {
  ReducedMotionPolicy,
  ReducedMotionWatcher,
} from './runtime/reduced-motion/reduced-motion.js';

export { createVisibilityWatcher } from './runtime/visibility/visibility.js';
export type { VisibilityWatcher } from './runtime/visibility/visibility.js';

export { createIntersectionWatcher } from './runtime/intersection/intersection.js';
export type { IntersectionWatcher } from './runtime/intersection/intersection.js';

export { FrameScheduler } from './runtime/frame-scheduler/frame-scheduler.js';
export type { SchedulerTick, SchedulerClient } from './runtime/frame-scheduler/frame-scheduler.js';

// @lovo/matter — engine package public API.

export { createRenderer } from './runtime/create-renderer/create-renderer.js';
export type {
  GpuRenderer,
  GpuBackend,
  CreateRendererOptions,
} from './runtime/create-renderer/create-renderer.js';

export { CursorInput } from './inputs/cursor-input/cursor-input.js';
export type { CursorInputOptions, Vector2 } from './inputs/cursor-input/cursor-input.js';

export { colorRamp } from './primitives/color-ramp/color-ramp.js';
export type { ColorRampStop, TSLNode } from './primitives/color-ramp/color-ramp.js';

export { mixColor } from './primitives/color-space/index.js';
export type { ColorSpace, HueInterpolation } from './primitives/color-space/index.js';

export { colorSpaces } from './primitives/color-space/registry.js';

// Re-exported from the ./color subpath, which is where these actually live.
// Keeping them here means no existing import breaks; new call sites in the docs
// site are pushed to the subpath by a lint rule in the root eslint config,
// because reaching color math through this barrel drags in three/webgpu.
export {
  linearChannelToSrgb,
  linearSrgbToLinearDisplayP3,
  linearSrgbToOklch,
  oklabToLinearSrgb,
  oklchInGamut,
  oklchToGamut,
  oklchToLinearSrgb,
  parseColorString,
  srgbChannelToLinear,
} from './color.js';
export type { OutputGamut } from './color.js';

export { simplexNoise } from './primitives/noise/noise.js';

export { fractalNoise } from './primitives/fbm/fbm.js';
export type { FractalFold, FractalNoiseOptions } from './primitives/fbm/fbm.js';

export { voronoi } from './primitives/voronoi/voronoi.js';

export { voronoiCells } from './primitives/voronoi/voronoi-cells.js';
export type {
  VoronoiCellsOptions,
  VoronoiCellsResult,
} from './primitives/voronoi/voronoi-cells.js';

export { MAX_BLOBS, metaballs } from './primitives/metaballs/metaballs.js';
export type { MetaballsOptions, MetaballsResult } from './primitives/metaballs/metaballs.js';

export { quantize } from './primitives/quantize/quantize.js';

export { signedDistanceFieldCircle } from './primitives/sdf-circle/sdf-circle.js';

export { displace } from './primitives/displace/displace.js';

export { cursorRipple } from './primitives/cursor-ripple/cursor-ripple.js';
export type { CursorRippleOptions } from './primitives/cursor-ripple/cursor-ripple.js';

export { elapsedTime } from './primitives/time/time.js';

export { resetRendererClock } from './runtime/clock/reset-clock.js';

export { grain } from './primitives/grain/grain.js';
export { stableHash, stableHashUint } from './primitives/stable-hash/stable-hash.js';

export { dither } from './primitives/dither/dither.js';
export { ditherThreshold } from './primitives/dither-pattern/dither-pattern.js';
export type { DitherPattern } from './primitives/dither-pattern/dither-pattern.js';

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

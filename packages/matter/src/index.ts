// @lovo/matter — engine package public API.
// Implementation grows phase by phase through Milestone 1.

export { createRenderer } from './runtime/createRenderer.js'
export type {
  MatterRenderer,
  CreateRendererOptions,
  MatterBackend,
} from './runtime/createRenderer.js'

export { MatterScheduler } from './runtime/MatterScheduler.js'
export type { SchedulerTick, SchedulerClient } from './runtime/MatterScheduler.js'

export { CursorInput } from './inputs/CursorInput.js'
export type { CursorInputOptions, Vec2 } from './inputs/CursorInput.js'

export { colorRamp } from './primitives/colorRamp.js'
export type { ColorRampStop, TSLNode } from './primitives/colorRamp.js'

export { noise } from './primitives/noise.js'

export { fbm } from './primitives/fbm.js'
export type { FBMOptions } from './primitives/fbm.js'

export { voronoi } from './primitives/voronoi.js'

export { quantize } from './primitives/quantize.js'

export { sdfCircle } from './primitives/sdfCircle.js'

export { displace } from './primitives/displace.js'

export { cursorRipple } from './primitives/cursorRipple.js'
export type { CursorRippleOptions } from './primitives/cursorRipple.js'

export { time } from './primitives/time.js'

export {
  setReducedMotionPolicy,
  getReducedMotionPolicy,
  getReducedMotionTimeScale,
  createReducedMotionWatcher,
} from './runtime/reducedMotion.js'
export type { ReducedMotionPolicy, ReducedMotionWatcher } from './runtime/reducedMotion.js'

export { createVisibilityWatcher } from './runtime/visibility.js'
export type { VisibilityWatcher } from './runtime/visibility.js'

export { createIntersectionWatcher } from './runtime/intersection.js'
export type { IntersectionWatcher } from './runtime/intersection.js'

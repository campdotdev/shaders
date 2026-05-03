// @lovo/matter — engine package public API.
// Implementation grows phase by phase through Milestone 1.

export { createRenderer } from './runtime/createRenderer.js'
export type { MatterRenderer, CreateRendererOptions, MatterBackend } from './runtime/createRenderer.js'

export { MatterScheduler } from './runtime/MatterScheduler.js'
export type { SchedulerTick, SchedulerClient } from './runtime/MatterScheduler.js'

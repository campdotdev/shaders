import type { FrameScheduler, GpuRenderer } from '@lovo/matter'
import { createContext } from 'react'
import type { Camera, Scene } from 'three'
import type { ShaderNodeObject } from 'three/tsl'
import type { Node } from 'three/webgpu'

export type OverlayTransform = (input: ShaderNodeObject<Node>) => ShaderNodeObject<Node>

export interface ShaderContextValue {
  renderer: GpuRenderer
  scene: Scene
  camera: Camera
  scheduler: FrameScheduler
  registerOverlay: (transform: OverlayTransform) => () => void
}

export const ShaderContext = createContext<ShaderContextValue | null>(null)

/** @deprecated Use ShaderContextValue — alias removed in 0.5.0 */
export type MatterContextValue = ShaderContextValue
/** @deprecated Use ShaderContext — alias removed in 0.5.0 */
export const MatterContext = ShaderContext

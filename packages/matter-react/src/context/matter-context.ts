import type { MatterRenderer, MatterScheduler } from '@lovo/matter'
import { createContext } from 'react'
import type { Camera, Scene } from 'three'
import type { ShaderNodeObject } from 'three/tsl'
import type { Node } from 'three/webgpu'

export type OverlayTransform = (input: ShaderNodeObject<Node>) => ShaderNodeObject<Node>

export interface MatterContextValue {
  renderer: MatterRenderer
  scene: Scene
  camera: Camera
  scheduler: MatterScheduler
  registerOverlay: (transform: OverlayTransform) => () => void
}

export const MatterContext = createContext<MatterContextValue | null>(null)

import { createContext } from 'react'
import type { Scene, Camera } from 'three'
import type { Node } from 'three/webgpu'
import type { ShaderNodeObject } from 'three/tsl'
import type { MatterRenderer, MatterScheduler } from '@lovo/matter'

export type OverlayTransform = (input: ShaderNodeObject<Node>) => ShaderNodeObject<Node>

export interface MatterContextValue {
  renderer: MatterRenderer
  scene: Scene
  camera: Camera
  scheduler: MatterScheduler
  registerOverlay: (transform: OverlayTransform) => () => void
}

export const MatterContext = createContext<MatterContextValue | null>(null)

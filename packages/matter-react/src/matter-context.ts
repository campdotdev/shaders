import { createContext } from 'react'
import type { Scene, Camera } from 'three'
import type { MatterRenderer, MatterScheduler } from '@lovo/matter'

export interface MatterContextValue {
  renderer: MatterRenderer
  scene: Scene
  camera: Camera
  scheduler: MatterScheduler
}

export const MatterContext = createContext<MatterContextValue | null>(null)

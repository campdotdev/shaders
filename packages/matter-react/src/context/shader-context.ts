import { createContext } from 'react';

import type { FrameScheduler, GpuRenderer } from '@lovo/matter';
import type { Camera, Scene } from 'three';
import type { ShaderNodeObject } from 'three/tsl';
import type { Node } from 'three/webgpu';

export type PostProcessTransform = (input: ShaderNodeObject<Node>) => ShaderNodeObject<Node>;

export interface ShaderContextValue {
  renderer: GpuRenderer;
  scene: Scene;
  camera: Camera;
  scheduler: FrameScheduler;
  registerOverlay: (transform: PostProcessTransform) => () => void;
}

export const ShaderContext = createContext<ShaderContextValue | null>(null);

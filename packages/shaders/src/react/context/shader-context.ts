import { createContext } from 'react';

import type { Camera, Scene } from 'three';

import type {
  CursorInput,
  FrameScheduler,
  GpuRenderer,
  PostProcessTransform,
  UvTransform,
} from '../../engine.js';

// The contract between <ShaderScene> and everything rendered inside it:
// the scene fills this in once its renderer is up, and every child hook
// (useShaderContext, usePostProcessPass, useResize, ...) reads from it.
// Null means "not inside a mounted scene" — hooks stub themselves out.

// The two transform shapes are defined with the output stage in the runtime
// and re-exported here, so hooks keep importing them from the context.
export type { PostProcessTransform, UvTransform };

export interface ShaderContextValue {
  renderer: GpuRenderer;
  scene: Scene;
  camera: Camera;
  scheduler: FrameScheduler;
  registerOverlay: (transform: PostProcessTransform) => () => void;
  registerBaseUvTransform: (transform: UvTransform) => () => void;
  /**
   * The scene's one shared cursor input, normalized to its canvas. Created
   * on the first call and disposed with the scene, so a scene nobody asks
   * never attaches a pointer listener. Every useCursor call inside the
   * scene reads this one input and smooths at its own rate.
   */
  getCursorInput: () => CursorInput;
}

export const ShaderContext = createContext<ShaderContextValue | null>(null);

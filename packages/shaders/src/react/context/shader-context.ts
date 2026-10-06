import { createContext } from 'react';

import type { Camera, Scene } from 'three';

import type {
  CursorInput,
  FrameScheduler,
  GpuRenderer,
  PostProcessTransform,
  PrePass,
  TimeGpu,
  UvTransform,
} from '../../engine.js';
import type { ResizeSignal } from '../../inputs/canvas-size/canvas-size.js';

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
   * Adds a draw that runs before the scene's meshes on every frame the scene
   * draws, including the redraw after a resize, such as Aurora's field pass.
   * Returns its remover.
   */
  registerPrePass: (prePass: PrePass) => () => void;
  /**
   * The scene's one shared cursor input, normalized to its canvas. Created
   * on the first call and disposed with the scene, so a scene nobody asks
   * never attaches a pointer listener. Every useCursor call inside the
   * scene reads this one input and smooths at its own rate.
   */
  getCursorInput: () => CursorInput;
  /**
   * The canvas size, which the scene updates before it redraws a resized
   * canvas. useResize hands it to components.
   */
  canvasSize: ResizeSignal;
  /**
   * Turns on GPU timing for every pass the scene draws each frame: the
   * pre-passes, the meshes, and the output quad. ShaderMonitor holds it on
   * while mounted.
   */
  timeGpu: TimeGpu;
}

export const ShaderContext = createContext<ShaderContextValue | null>(null);

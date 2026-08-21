import { createContext } from 'react';

import type { FrameScheduler, GpuRenderer } from '@camp-dev/shaders';
import type { Camera, Scene } from 'three';
import type { ShaderNodeObject } from 'three/tsl';
import type { Node } from 'three/webgpu';

// The contract between <ShaderScene> and everything rendered inside it:
// the scene fills this in once its renderer is up, and every child hook
// (useShaderContext, usePostProcessPass, useResize, ...) reads from it.
// Null means "not inside a mounted scene" — hooks stub themselves out.

/** A post-process step: takes the composed pixel (rgba), returns its replacement. */
export type PostProcessTransform = (input: ShaderNodeObject<Node>) => ShaderNodeObject<Node>;

/**
 * A base-pass UV warp: takes the coordinate the scene texture is about to be
 * sampled at (0..1 across the canvas) and returns a replacement. Lets an
 * overlay resample the rendered scene — e.g. snapping to a grid for
 * pixelation — which a color-only PostProcessTransform cannot express.
 */
export type UvTransform = (uv: ShaderNodeObject<Node>) => ShaderNodeObject<Node>;

export interface ShaderContextValue {
  renderer: GpuRenderer;
  scene: Scene;
  camera: Camera;
  scheduler: FrameScheduler;
  registerOverlay: (transform: PostProcessTransform) => () => void;
  registerBaseUvTransform: (transform: UvTransform) => () => void;
}

export const ShaderContext = createContext<ShaderContextValue | null>(null);

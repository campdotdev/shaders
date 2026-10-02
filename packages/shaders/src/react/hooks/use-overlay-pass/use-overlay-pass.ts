'use client';

import type { DependencyList } from 'react';

import type { PostProcessTransform } from '../../context/shader-context.js';
import { useSceneRegistration } from '../use-scene-registration/use-scene-registration.js';

/**
 * Register a post-process pass with the enclosing <ShaderScene>: `transform`
 * receives the composed scene output (each already-rendered pixel, rgba) and
 * returns its replacement. Passes stack in mount order. `deps` works like an
 * effect dependency list — the pass re-registers (and the scene recompiles
 * its output chain) when any dep changes, so list every non-uniform value
 * the transform closes over.
 */
export function usePostProcessPass(transform: PostProcessTransform, deps: DependencyList): void {
  useSceneRegistration((shaderContext) => shaderContext.registerOverlay(transform), deps);
}

'use client';

import type { DependencyList } from 'react';

import type { UvWarp } from '../../context/shader-context.js';
import { useSceneRegistration } from '../use-scene-registration/use-scene-registration.js';

/**
 * Register a UV warp with the enclosing <ShaderScene>:
 * `transform` receives the 0..1 coordinate the rendered scene is about to be
 * sampled at and returns a replacement — resampling the scene itself, which
 * a color-only useColorTransform cannot do. Transforms compose in mount
 * order and warp the scene content only; other Effects' own contributions
 * (a vignette's shape, grain's speckle) stay at native resolution. `deps`
 * works like an effect dependency list — list every non-uniform value the
 * transform closes over.
 */
export function useUvWarp(transform: UvWarp, deps: DependencyList): void {
  useSceneRegistration((shaderContext) => shaderContext.registerUvWarp(transform), deps);
}

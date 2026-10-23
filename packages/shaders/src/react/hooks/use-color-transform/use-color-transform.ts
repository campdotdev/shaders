'use client';

import type { DependencyList } from 'react';

import type { ColorTransform } from '../../context/shader-context.js';
import { useSceneRegistration } from '../use-scene-registration/use-scene-registration.js';

/**
 * Register a color transform with the enclosing <ShaderScene>: `transform`
 * receives the composed scene output (each already-rendered pixel, rgba) and
 * returns its replacement. Transforms stack in mount order. `deps` works like an
 * effect dependency list — the transform re-registers (and the scene recompiles
 * its output chain) when any dep changes, so list every non-uniform value
 * the transform closes over.
 */
export function useColorTransform(transform: ColorTransform, deps: DependencyList): void {
  useSceneRegistration((shaderContext) => shaderContext.registerColorTransform(transform), deps);
}

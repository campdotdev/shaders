'use client';

import { type DependencyList, useEffect } from 'react';

import type { PostProcessTransform } from '../../context/shader-context.js';
import { useShaderContext } from '../use-shader-context/use-shader-context.js';

/**
 * Register a post-process pass with the enclosing <ShaderScene>: `transform`
 * receives the composed scene output (each already-rendered pixel, rgba) and
 * returns its replacement. Passes stack in mount order. `deps` works like an
 * effect dependency list — the pass re-registers (and the scene recompiles
 * its output chain) when any dep changes, so list every non-uniform value
 * the transform closes over.
 */
export function usePostProcessPass(transform: PostProcessTransform, deps: DependencyList): void {
  const shaderContext = useShaderContext();

  useEffect(() => {
    if (!shaderContext) return;
    const unregister = shaderContext.registerOverlay(transform);

    return unregister;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shaderContext, ...deps]);
}

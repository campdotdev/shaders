'use client';

import { type DependencyList, useEffect } from 'react';

import type { UvTransform } from '../../context/shader-context.js';
import { useShaderContext } from '../use-shader-context/use-shader-context.js';

/**
 * Register a base-pass UV transform with the enclosing <ShaderScene>:
 * `transform` receives the 0..1 coordinate the rendered scene is about to be
 * sampled at and returns a replacement — resampling the scene itself, which
 * a color-only usePostProcessPass cannot do. Transforms compose in mount
 * order and warp the scene content only; other overlays' own contributions
 * (a vignette's shape, grain's speckle) stay at native resolution. `deps`
 * works like an effect dependency list — list every non-uniform value the
 * transform closes over.
 */
export function useBasePassUv(transform: UvTransform, deps: DependencyList): void {
  const shaderContext = useShaderContext();

  useEffect(() => {
    if (!shaderContext) return;
    const unregister = shaderContext.registerBaseUvTransform(transform);

    return unregister;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shaderContext, ...deps]);
}

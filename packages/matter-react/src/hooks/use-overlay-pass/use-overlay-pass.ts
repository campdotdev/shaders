'use client';

import { type DependencyList, useEffect } from 'react';

import type { PostProcessTransform } from '../../context/shader-context.js';
import { useShaderContext } from '../use-shader-context/use-shader-context.js';

export function usePostProcessPass(transform: PostProcessTransform, deps: DependencyList): void {
  const shaderContext = useShaderContext();

  useEffect(() => {
    if (!shaderContext) return;
    const unregister = shaderContext.registerOverlay(transform);

    return unregister;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shaderContext, ...deps]);
}

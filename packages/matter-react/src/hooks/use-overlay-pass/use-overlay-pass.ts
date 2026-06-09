'use client';

import { type DependencyList, useEffect } from 'react';

import type { OverlayTransform } from '../../context/shader-context.js';
import { useShaderContext } from '../use-shader-context/use-shader-context.js';

export function useOverlayPass(transform: OverlayTransform, deps: DependencyList): void {
  const ctx = useShaderContext();

  useEffect(() => {
    if (!ctx) return;
    const unregister = ctx.registerOverlay(transform);

    return unregister;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, ...deps]);
}

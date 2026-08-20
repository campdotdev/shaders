'use client';

import { useEffect } from 'react';

import { useShaderContext } from '../use-shader-context/use-shader-context.js';

/**
 * Vote on the scene's render-on-demand system: `isStatic: true` tells the
 * frame scheduler this component draws nothing that changes over time, so
 * the whole scene may stop re-rendering (it actually stops only when every
 * component agrees — see FrameScheduler's vote counting). The effect cleanup
 * withdraws the vote on unmount or when `isStatic` flips.
 */
export function useStaticSceneHint(isStatic: boolean): void {
  const shaderContext = useShaderContext();

  useEffect(() => {
    if (!shaderContext) return;

    return shaderContext.scheduler.setIdle(isStatic);
  }, [shaderContext, isStatic]);
}

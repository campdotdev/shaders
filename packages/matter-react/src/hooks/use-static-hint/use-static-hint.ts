'use client';

import { useEffect } from 'react';

import { useShaderContext } from '../use-shader-context/use-shader-context.js';

export function useStaticSceneHint(isStatic: boolean): void {
  const shaderContext = useShaderContext();

  useEffect(() => {
    if (!shaderContext) return;

    return shaderContext.scheduler.setIdle(isStatic);
  }, [shaderContext, isStatic]);
}

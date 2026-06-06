'use client'

import { useEffect } from 'react'

import { useShaderContext } from '../use-shader-context/use-shader-context.js'

export function useStaticHint(hint: boolean): void {
  const ctx = useShaderContext()

  useEffect(() => {
    if (!ctx) return

    return ctx.scheduler.setIdle(hint)
  }, [ctx, hint])
}

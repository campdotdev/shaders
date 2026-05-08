'use client'

import { useEffect } from 'react'
import { useMatterContext } from './useMatterContext.js'

/**
 * Opt a component out of the rAF loop while it has no dynamic uniforms.
 *
 * When `hint` is true, the scheduler runs one final flush tick (so any
 * uniform changes since the last frame are rendered) and then halts the
 * rAF loop until either `hint` becomes false or another component in the
 * same scene calls `scheduler.requestRender()`.
 *
 * Use for components whose animation is fully derived from props that don't
 * include `time`, e.g. `<LinearGradient speed={0}>` with no `interactive`.
 */
export function useStaticHint(hint: boolean): void {
  const ctx = useMatterContext()
  useEffect(() => {
    if (!ctx) return
    ctx.scheduler.setIdle(hint)
    return () => ctx.scheduler.setIdle(false)
  }, [ctx, hint])
}

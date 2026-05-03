'use client'

import { useEffect, useState } from 'react'
import { CursorInput, type CursorInputOptions, type Vec2 } from '@lovo/matter'
import { useMatterContext } from './useMatterContext.js'

export interface CursorSignal {
  /** Current smoothed cursor position (Vec2 in 0..1 viewport space). */
  get(): Vec2
  /** Subscribe to change events. Returns unsubscribe. */
  on(event: 'change', cb: (value: Vec2) => void): () => void
}

/**
 * React wrapper for CursorInput. Auto-attaches to the parent <MatterScene>'s
 * scheduler if available; otherwise creates a free-running rAF tick.
 */
export function useCursor(opts: CursorInputOptions = {}): CursorSignal {
  const ctx = useMatterContext()
  const [input] = useState(() => new CursorInput(opts))

  useEffect(() => {
    let raf: number | null = null
    let lastNow = performance.now()

    if (ctx?.scheduler) {
      const client = ({ delta }: { delta: number }) => input.tick(delta)
      ctx.scheduler.add(client)
      return () => ctx.scheduler.remove(client)
    }

    // No parent MatterScene — drive the input from a free rAF.
    const loop = (now: number) => {
      const delta = (now - lastNow) / 1000
      lastNow = now
      input.tick(delta)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => {
      if (raf !== null) cancelAnimationFrame(raf)
    }
  }, [ctx, input])

  useEffect(() => {
    return () => input.dispose()
  }, [input])

  return input
}

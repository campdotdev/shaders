'use client'

import { CursorInput, type CursorInputOptions, type Vec2 } from '@lovo/matter'
import { useEffect, useState } from 'react'

import { useShaderContext } from '../use-matter-context/use-matter-context.js'

export interface CursorSignal {
  /** Current smoothed cursor position (Vec2 in 0..1 viewport space). */
  get(): Vec2
  /** Subscribe to change events. Returns unsubscribe. */
  on(event: 'change', cb: (value: Vec2) => void): () => void
}

// Inert stub returned on the first render before the lifecycle effect
// has created the real CursorInput. Calling .on returns an unsub no-op.
const STUB_SIGNAL: CursorSignal = {
  get: () => [0.5, 0.5] as const,
  on: () => () => undefined,
}

/**
 * React wrapper for CursorInput. Auto-attaches to the parent <MatterScene>'s
 * scheduler if available; otherwise creates a free-running rAF tick.
 *
 * Lifecycle is in a single effect so React 19 Strict Mode's intentional
 * mount→unmount→mount cycle creates a *fresh* CursorInput per real mount
 * instead of disposing a long-lived one (which would silently break the
 * window mousemove listener and the smoothing tick).
 */
export function useCursor(opts: CursorInputOptions = {}): CursorSignal {
  const ctx = useShaderContext()
  const [input, setInput] = useState<CursorInput | null>(null)

  useEffect(() => {
    // Plumb the parent <MatterScene>'s canvas as the cursor's normalization
    // element. Without this, cursor coords are viewport-normalized — fine for
    // a full-page scene but visibly offset when the canvas sits inside a
    // smaller wrapper (e.g., 70vh hero). DotField's cell tiling makes the
    // mismatch obvious; LinearGradient mostly gets away with it. Caller can
    // override by passing `opts.element` explicitly.
    const canvas = ctx?.renderer.three.domElement
    const elementOpt = opts.element ?? (canvas instanceof HTMLElement ? canvas : undefined)
    const fresh = new CursorInput({ ...opts, element: elementOpt })

    setInput(fresh)

    let detach: (() => void) | null = null

    if (ctx?.scheduler) {
      const client = ({ delta }: { delta: number }) => fresh.tick(delta)

      ctx.scheduler.add(client)
      detach = () => ctx.scheduler.remove(client)
    } else {
      let raf: number | null = null
      let lastNow = performance.now()
      const loop = (now: number) => {
        const delta = (now - lastNow) / 1000

        lastNow = now
        fresh.tick(delta)
        raf = requestAnimationFrame(loop)
      }

      raf = requestAnimationFrame(loop)
      detach = () => {
        if (raf !== null) cancelAnimationFrame(raf)
      }
    }

    return () => {
      detach()
      fresh.dispose()
      setInput(null)
    }
    // We intentionally only re-create on ctx change, not opts (which is a
    // fresh object literal each render). Smoothing tweaks during dev are
    // applied by remounting the parent component.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx])

  return input ?? STUB_SIGNAL
}

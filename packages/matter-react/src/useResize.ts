'use client'

import { useEffect, useState } from 'react'
import { useMatterContext } from './useMatterContext.js'

export type ResizeValue = readonly [width: number, height: number, dpr: number]

export interface ResizeSignal {
  /** Current size in CSS pixels + devicePixelRatio. */
  get(): ResizeValue
  on(event: 'change', cb: (value: ResizeValue) => void): () => void
}

// Inert stub returned on the first render before the lifecycle effect has
// observed the canvas. Subscribing to it returns a no-op unsubscribe.
const STUB_SIGNAL: ResizeSignal = {
  get: () => [0, 0, 1] as const,
  on: () => () => undefined,
}

/**
 * Track the parent <MatterScene>'s canvas size + DPR. Exposes a MatterSignal
 * that components can pass into a TSL uniform to make pixel-aware effects
 * (e.g., DotField's pixel-spacing math).
 *
 * Strict-Mode-safe: lifecycle is in one effect, so React 19's intentional
 * mount→unmount→mount cycle creates a fresh ResizeObserver per real mount
 * (CLAUDE.md gotcha #14).
 *
 * Falls back to the stub signal until the parent context is ready.
 */
export function useResize(): ResizeSignal {
  const ctx = useMatterContext()
  const [signal, setSignal] = useState<ResizeSignal | null>(null)

  useEffect(() => {
    if (!ctx) return undefined

    const canvas = ctx.renderer.three.domElement
    if (!(canvas instanceof HTMLCanvasElement)) return undefined

    let value: ResizeValue = [
      canvas.clientWidth,
      canvas.clientHeight,
      typeof window !== 'undefined' ? window.devicePixelRatio : 1,
    ]
    const listeners = new Set<(v: ResizeValue) => void>()
    const fresh: ResizeSignal = {
      get: () => value,
      on: (_event, cb) => {
        listeners.add(cb)
        return () => {
          listeners.delete(cb)
        }
      },
    }
    setSignal(fresh)

    const emit = () => {
      const next: ResizeValue = [
        canvas.clientWidth,
        canvas.clientHeight,
        typeof window !== 'undefined' ? window.devicePixelRatio : 1,
      ]
      if (next[0] === value[0] && next[1] === value[1] && next[2] === value[2]) return
      value = next
      for (const cb of listeners) cb(next)
    }

    const observer = new ResizeObserver(emit)
    observer.observe(canvas)

    // Cross-browser DPR-change watch. matchMedia(`(resolution: <dpr>dppx)`)
    // matches at the *current* DPR; when the user zooms the page the query
    // stops matching, fires `change`, and we re-arm the watch at the new DPR.
    // We track the current MQL + handler so we can fully detach in cleanup
    // (the handler is captured by the listener — passing a fresh closure to
    // removeEventListener wouldn't actually unregister it).
    let mql: MediaQueryList | null = null
    let mqlHandler: (() => void) | null = null
    const setupDprWatch = () => {
      if (typeof window === 'undefined') return
      const dpr = window.devicePixelRatio
      const next = window.matchMedia(`(resolution: ${dpr}dppx)`)
      const handler = () => {
        emit()
        if (mql && mqlHandler) mql.removeEventListener('change', mqlHandler)
        setupDprWatch()
      }
      next.addEventListener('change', handler)
      mql = next
      mqlHandler = handler
    }
    setupDprWatch()

    return () => {
      observer.disconnect()
      if (mql && mqlHandler) mql.removeEventListener('change', mqlHandler)
      mql = null
      mqlHandler = null
      listeners.clear()
      setSignal(null)
    }
  }, [ctx])

  return signal ?? STUB_SIGNAL
}

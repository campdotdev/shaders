'use client'

import { useEffect, useState } from 'react'

export type ScrollValue = readonly [scrollY: number, progress: number]

export interface ScrollSignal {
  /** Current scroll Y (px) and normalized progress in [0,1]. */
  get(): ScrollValue
  on(event: 'change', cb: (value: ScrollValue) => void): () => void
}

// Inert stub returned during SSR + on the first client render before the
// lifecycle effect attaches. Subscribing to it returns a no-op unsubscribe.
const STUB_SIGNAL: ScrollSignal = {
  get: () => [0, 0] as const,
  on: () => () => undefined,
}

/**
 * Track window scroll position. Exposes a MatterSignal of `[scrollY, progress]`
 * where `progress` is `scrollY / max(documentHeight - innerHeight, 1)` clamped
 * to [0, 1]. Listener is rAF-throttled and `passive: true` so it never blocks
 * scrolling.
 *
 * No v1 Tier 1 component consumes this hook; it ships so users can pass
 * `inputs={{ scroll: useScroll() }}` to any Matter component.
 *
 * Strict-Mode-safe: lifecycle is in one effect, so React 19's intentional
 * mount→unmount→mount cycle in dev creates a fresh listener pair per real
 * mount and tears down cleanly on each pseudo-unmount (CLAUDE.md gotcha #14).
 */
export function useScroll(): ScrollSignal {
  const [signal, setSignal] = useState<ScrollSignal | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const compute = (): ScrollValue => {
      const y = window.scrollY
      // For pages shorter than the viewport, `documentHeight - innerHeight` is
      // <= 0; clamp to 1 to avoid div-by-zero. Progress stays at 0 in that
      // case because scrollY is also 0.
      const max = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1)
      const progress = Math.max(0, Math.min(1, y / max))
      return [y, progress]
    }

    let value: ScrollValue = compute()
    const listeners = new Set<(v: ScrollValue) => void>()
    const fresh: ScrollSignal = {
      get: () => value,
      on: (_event, cb) => {
        listeners.add(cb)
        return () => {
          listeners.delete(cb)
        }
      },
    }
    setSignal(fresh)

    let rafPending = false
    const onScroll = () => {
      if (rafPending) return
      rafPending = true
      requestAnimationFrame(() => {
        rafPending = false
        const next = compute()
        if (next[0] === value[0] && next[1] === value[1]) return
        value = next
        for (const cb of listeners) cb(next)
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })

    return () => {
      window.removeEventListener('scroll', onScroll)
      listeners.clear()
      setSignal(null)
    }
  }, [])

  return signal ?? STUB_SIGNAL
}

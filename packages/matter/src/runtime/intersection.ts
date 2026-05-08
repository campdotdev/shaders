export interface IntersectionWatcher {
  isInView(): boolean
  /** Subscribe to changes. Receives the new in-view state. Returns unsubscribe. */
  subscribe(cb: (inView: boolean) => void): () => void
  dispose(): void
}

/**
 * Watch a canvas's viewport intersection. Pauses tied to this watcher should
 * be resumed when the canvas is *any* fraction visible. Strict-mode-safe.
 *
 * SSR: if `IntersectionObserver` is unavailable, returns a no-op watcher whose
 * `isInView()` always returns `true` and whose `subscribe` does nothing.
 */
export function createIntersectionWatcher(canvas: HTMLCanvasElement): IntersectionWatcher {
  if (typeof IntersectionObserver === 'undefined') {
    return {
      isInView: () => true,
      subscribe: () => () => {},
      dispose: () => {},
    }
  }

  const subs = new Set<(v: boolean) => void>()
  let inView = true
  const obs = new IntersectionObserver(
    (entries) => {
      const next = entries.some((e) => e.isIntersecting)
      if (next === inView) return
      inView = next
      for (const cb of subs) cb(inView)
    },
    { threshold: 0 },
  )
  obs.observe(canvas)

  return {
    isInView: () => inView,
    subscribe(cb) {
      subs.add(cb)
      return () => subs.delete(cb)
    },
    dispose() {
      obs.disconnect()
      subs.clear()
    },
  }
}

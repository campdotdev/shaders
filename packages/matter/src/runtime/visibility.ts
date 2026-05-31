export interface VisibilityWatcher {
  isVisible(): boolean
  /** Subscribe to changes. Receives the new visibility state. Returns unsubscribe. */
  subscribe(cb: (visible: boolean) => void): () => void
  dispose(): void
}

/**
 * Watch `document.visibilityState`. Strict-mode-safe — callers create+dispose
 * one per mount cycle.
 *
 * SSR: if `document` is unavailable, returns a no-op watcher whose
 * `isVisible()` always returns `true` and whose `subscribe` does nothing.
 */
export function createVisibilityWatcher(): VisibilityWatcher {
  if (typeof document === 'undefined') {
    return {
      isVisible: () => true,
      subscribe: () => () => {
        // SSR no-op unsubscribe
      },
      dispose: () => {
        // SSR no-op dispose
      },
    }
  }

  const subs = new Set<(v: boolean) => void>()
  const onChange = () => {
    const v = document.visibilityState === 'visible'

    for (const cb of subs) cb(v)
  }

  document.addEventListener('visibilitychange', onChange)

  return {
    isVisible: () => document.visibilityState === 'visible',
    subscribe(cb) {
      subs.add(cb)

      return () => subs.delete(cb)
    },
    dispose() {
      document.removeEventListener('visibilitychange', onChange)
      subs.clear()
    },
  }
}

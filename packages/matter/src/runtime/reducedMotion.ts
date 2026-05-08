export type ReducedMotionPolicy = 'auto' | 'off' | 'slow' | 'paused'

interface PolicyState {
  policy: ReducedMotionPolicy
  watchers: Set<ReducedMotionWatcher>
}

const state: PolicyState = {
  policy: 'auto',
  watchers: new Set(),
}

/**
 * Override Matter's default behavior of honoring `prefers-reduced-motion`.
 * - 'auto'   — follow the OS media query (default)
 * - 'off'    — full speed regardless of OS setting
 * - 'slow'   — 30% speed regardless of OS setting
 * - 'paused' — 0 (animation effectively frozen) regardless of OS setting
 */
export function setReducedMotionPolicy(policy: ReducedMotionPolicy): void {
  if (state.policy === policy) return
  state.policy = policy
  for (const w of state.watchers) w.recompute()
}

export function getReducedMotionPolicy(): ReducedMotionPolicy {
  return state.policy
}

export interface ReducedMotionWatcher {
  /** Current time scale: 0, 0.3, or 1. */
  scale(): number
  /** Subscribe to scale changes. Returns unsubscribe. */
  subscribe(cb: (scale: number) => void): () => void
  /** Internal: recompute after policy change and notify subscribers. */
  recompute(): void
  /** Tear down media-query listener. */
  dispose(): void
}

const computeScale = (mqlMatches: boolean): number => {
  switch (state.policy) {
    case 'off':
      return 1
    case 'slow':
      return 0.3
    case 'paused':
      return 0
    case 'auto':
      return mqlMatches ? 0.3 : 1
  }
}

/**
 * Create a watcher that tracks `prefers-reduced-motion: reduce` and the
 * global Matter policy override. Strict-mode-safe — callers create+dispose
 * one per mount cycle.
 */
export function createReducedMotionWatcher(): ReducedMotionWatcher {
  // SSR safety: bail to the no-op watcher if matchMedia is missing.
  if (typeof matchMedia !== 'function') {
    const subs = new Set<(s: number) => void>()
    return {
      scale: () => 1,
      subscribe: (cb) => {
        subs.add(cb)
        return () => subs.delete(cb)
      },
      recompute: () => {
        for (const cb of subs) cb(computeScale(false))
      },
      dispose: () => {
        subs.clear()
      },
    }
  }

  const mql = matchMedia('(prefers-reduced-motion: reduce)')
  const subs = new Set<(s: number) => void>()
  let last = computeScale(mql.matches)

  const onChange = () => {
    const next = computeScale(mql.matches)
    if (next !== last) {
      last = next
      for (const cb of subs) cb(next)
    }
  }

  mql.addEventListener('change', onChange)

  const watcher: ReducedMotionWatcher = {
    scale: () => last,
    subscribe(cb) {
      subs.add(cb)
      return () => subs.delete(cb)
    },
    recompute() {
      const next = computeScale(mql.matches)
      if (next !== last) {
        last = next
        for (const cb of subs) cb(next)
      }
    },
    dispose() {
      mql.removeEventListener('change', onChange)
      subs.clear()
      state.watchers.delete(watcher)
    },
  }
  state.watchers.add(watcher)
  return watcher
}

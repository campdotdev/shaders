import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createReducedMotionWatcher,
  setReducedMotionPolicy,
} from './reducedMotion.js'

interface MockMQL {
  matches: boolean
  listeners: Array<(e: { matches: boolean }) => void>
  addEventListener: (type: 'change', cb: (e: { matches: boolean }) => void) => void
  removeEventListener: (type: 'change', cb: (e: { matches: boolean }) => void) => void
  dispatch: (matches: boolean) => void
}

const makeMQL = (initial: boolean): MockMQL => {
  const listeners: MockMQL['listeners'] = []
  return {
    get matches() {
      return initial
    },
    set matches(v) {
      initial = v
    },
    listeners,
    addEventListener: (_t, cb) => listeners.push(cb),
    removeEventListener: (_t, cb) => {
      const i = listeners.indexOf(cb)
      if (i >= 0) listeners.splice(i, 1)
    },
    dispatch(matches) {
      this.matches = matches
      for (const l of [...listeners]) l({ matches })
    },
  }
}

describe('reducedMotion watcher', () => {
  let mql: MockMQL
  beforeEach(() => {
    mql = makeMQL(false)
    vi.stubGlobal('matchMedia', () => mql)
    setReducedMotionPolicy('auto')
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    setReducedMotionPolicy('auto')
  })

  it('returns scale 1 when system reduce is off and policy is auto', () => {
    const w = createReducedMotionWatcher()
    expect(w.scale()).toBe(1)
    w.dispose()
  })

  it('returns scale 0.3 when system reduce is on and policy is auto', () => {
    mql.matches = true
    const w = createReducedMotionWatcher()
    expect(w.scale()).toBe(0.3)
    w.dispose()
  })

  it('emits change when matchMedia toggles', () => {
    const w = createReducedMotionWatcher()
    const cb = vi.fn()
    w.subscribe(cb)
    mql.dispatch(true)
    expect(cb).toHaveBeenCalledWith(0.3)
    mql.dispatch(false)
    expect(cb).toHaveBeenLastCalledWith(1)
    w.dispose()
  })

  it('honors explicit policy override "off" (scale 1)', () => {
    mql.matches = true
    setReducedMotionPolicy('off')
    const w = createReducedMotionWatcher()
    expect(w.scale()).toBe(1)
    w.dispose()
  })

  it('honors explicit policy override "paused" (scale 0)', () => {
    setReducedMotionPolicy('paused')
    const w = createReducedMotionWatcher()
    expect(w.scale()).toBe(0)
    w.dispose()
  })

  it('honors explicit policy override "slow" (scale 0.3 regardless of mql)', () => {
    setReducedMotionPolicy('slow')
    const w = createReducedMotionWatcher()
    expect(w.scale()).toBe(0.3)
    w.dispose()
  })

  it('emits when policy changes', () => {
    const w = createReducedMotionWatcher()
    const cb = vi.fn()
    w.subscribe(cb)
    setReducedMotionPolicy('paused')
    expect(cb).toHaveBeenLastCalledWith(0)
    setReducedMotionPolicy('off')
    expect(cb).toHaveBeenLastCalledWith(1)
    w.dispose()
  })

  it('removes listeners on dispose', () => {
    const w = createReducedMotionWatcher()
    expect(mql.listeners.length).toBe(1)
    w.dispose()
    expect(mql.listeners.length).toBe(0)
  })

  it('survives a strict-mode create-dispose-recreate cycle', () => {
    const w1 = createReducedMotionWatcher()
    const cb = vi.fn()
    w1.subscribe(cb)
    w1.dispose()

    const w2 = createReducedMotionWatcher()
    w2.subscribe(cb)
    setReducedMotionPolicy('paused')
    // Only w2 is live; cb should be called exactly once (from w2's recompute).
    expect(cb).toHaveBeenCalledTimes(1)
    expect(cb).toHaveBeenLastCalledWith(0)
    w2.dispose()
  })
})

describe('reducedMotion watcher — SSR fallback', () => {
  beforeEach(() => {
    setReducedMotionPolicy('auto')
    vi.stubGlobal('matchMedia', undefined)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    setReducedMotionPolicy('auto')
  })

  it('returns a no-op watcher when matchMedia is undefined', () => {
    const w = createReducedMotionWatcher()
    expect(w.scale()).toBe(1)
    const cb = vi.fn()
    const unsub = w.subscribe(cb)
    unsub()
    w.dispose()
    // No throw, no error — that's the contract.
  })

  it('respects policy override on the SSR watcher', () => {
    setReducedMotionPolicy('paused')
    const w = createReducedMotionWatcher()
    expect(w.scale()).toBe(0)
    setReducedMotionPolicy('slow')
    // Note: SSR watcher does not emit on policy change (it's not in state.watchers).
    // But scale() at the time of next call should reflect the latest policy.
    expect(w.scale()).toBe(0.3)
    w.dispose()
  })
})

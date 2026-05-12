import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { createVisibilityWatcher } from './visibility.js'

describe('visibility watcher', () => {
  let listeners: Array<() => void> = []
  let visibilityState = 'visible'

  beforeEach(() => {
    listeners = []
    visibilityState = 'visible'
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => visibilityState,
    })
    vi.spyOn(document, 'addEventListener').mockImplementation((type, cb) => {
      if (type === 'visibilitychange') listeners.push(cb as () => void)
    })
    vi.spyOn(document, 'removeEventListener').mockImplementation((type, cb) => {
      if (type === 'visibilitychange') {
        const i = listeners.indexOf(cb as () => void)
        if (i >= 0) listeners.splice(i, 1)
      }
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('reports visible by default', () => {
    const w = createVisibilityWatcher()
    expect(w.isVisible()).toBe(true)
    w.dispose()
  })

  it('emits change when visibility flips to hidden and back', () => {
    const w = createVisibilityWatcher()
    const cb = vi.fn()
    w.subscribe(cb)
    visibilityState = 'hidden'
    listeners.forEach((l) => l())
    expect(cb).toHaveBeenLastCalledWith(false)
    visibilityState = 'visible'
    listeners.forEach((l) => l())
    expect(cb).toHaveBeenLastCalledWith(true)
    w.dispose()
  })

  it('removes the document listener on dispose', () => {
    const w = createVisibilityWatcher()
    expect(listeners.length).toBe(1)
    w.dispose()
    expect(listeners.length).toBe(0)
  })

  it('survives a strict-mode create-dispose-recreate cycle', () => {
    const w1 = createVisibilityWatcher()
    const cb = vi.fn()
    w1.subscribe(cb)
    w1.dispose()
    expect(listeners.length).toBe(0)

    const w2 = createVisibilityWatcher()
    w2.subscribe(cb)
    expect(listeners.length).toBe(1)
    // After w1 disposal, only w2's callback should fire
    visibilityState = 'hidden'
    listeners.forEach((l) => l())
    expect(cb).toHaveBeenCalledTimes(1)
    w2.dispose()
  })
})

describe('visibility watcher — SSR fallback', () => {
  it('returns a no-op watcher when document is undefined', () => {
    vi.stubGlobal('document', undefined)
    try {
      const w = createVisibilityWatcher()
      expect(w.isVisible()).toBe(true)
      const unsub = w.subscribe(() => {})
      unsub()
      w.dispose()
      // No throw — that's the contract.
    } finally {
      vi.unstubAllGlobals()
    }
  })
})

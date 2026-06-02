import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createIntersectionWatcher } from './intersection.js'

interface MockObserver {
  callback: IntersectionObserverCallback
  observed: Element[]
  disconnect: ReturnType<typeof vi.fn>
}

describe('intersection watcher', () => {
  let observers: MockObserver[] = []

  beforeEach(() => {
    observers = []
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        callback: IntersectionObserverCallback
        observed: Element[] = []
        disconnect = vi.fn()
        constructor(cb: IntersectionObserverCallback) {
          this.callback = cb
          observers.push(this)
        }
        observe(el: Element) {
          this.observed.push(el)
        }
        unobserve(el: Element) {
          this.observed = this.observed.filter((e) => e !== el)
        }
      },
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reports the canvas as in-view by default until the first callback', () => {
    const canvas = document.createElement('canvas')
    const w = createIntersectionWatcher(canvas)

    expect(w.isInView()).toBe(true)
    w.dispose()
  })

  it('updates when the observer reports intersection', () => {
    const canvas = document.createElement('canvas')
    const w = createIntersectionWatcher(canvas)
    const cb = vi.fn()

    w.subscribe(cb)
    const obs = observers[0]!

    obs.callback(
      [{ isIntersecting: false } as IntersectionObserverEntry],
      obs as unknown as IntersectionObserver,
    )
    expect(w.isInView()).toBe(false)
    expect(cb).toHaveBeenLastCalledWith(false)
    obs.callback(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      obs as unknown as IntersectionObserver,
    )
    expect(w.isInView()).toBe(true)
    expect(cb).toHaveBeenLastCalledWith(true)
    w.dispose()
  })

  it('disconnects on dispose', () => {
    const canvas = document.createElement('canvas')
    const w = createIntersectionWatcher(canvas)
    const obs = observers[0]!

    w.dispose()
    expect(obs.disconnect).toHaveBeenCalledTimes(1)
  })

  it('survives a strict-mode create-dispose-recreate cycle', () => {
    const canvas = document.createElement('canvas')
    const w1 = createIntersectionWatcher(canvas)
    const cb = vi.fn()

    w1.subscribe(cb)
    w1.dispose()

    const w2 = createIntersectionWatcher(canvas)

    w2.subscribe(cb)
    // After w1 disposal, only w2's observer should fire its callback
    const obs = observers[1]! // w2's observer (observers[0] was w1's)

    obs.callback(
      [{ isIntersecting: false } as IntersectionObserverEntry],
      obs as unknown as IntersectionObserver,
    )
    expect(cb).toHaveBeenCalledTimes(1)
    w2.dispose()
  })
})

describe('intersection watcher — SSR fallback', () => {
  beforeEach(() => {
    vi.stubGlobal('IntersectionObserver', undefined)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns a no-op watcher when IntersectionObserver is undefined', () => {
    const canvas = document.createElement('canvas')
    const w = createIntersectionWatcher(canvas)

    expect(w.isInView()).toBe(true)
    const unsub = w.subscribe(() => {})

    unsub()
    w.dispose()
    // No throw — that's the contract.
  })
})

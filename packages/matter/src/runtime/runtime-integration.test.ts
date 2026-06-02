import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { FrameScheduler } from './frame-scheduler.js'
import { createIntersectionWatcher } from './intersection.js'
import { createVisibilityWatcher } from './visibility.js'

describe('runtime integration', () => {
  let rafCallbacks: FrameRequestCallback[] = []
  let nextRafId = 0
  let visibilityState = 'visible'
  const visibilityListeners: Array<() => void> = []
  let observerCallback: IntersectionObserverCallback | null = null

  beforeEach(() => {
    rafCallbacks = []
    nextRafId = 0
    visibilityState = 'visible'
    visibilityListeners.length = 0
    observerCallback = null

    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafCallbacks.push(cb)

      return ++nextRafId
    })
    vi.stubGlobal('cancelAnimationFrame', () => {})

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => visibilityState,
    })
    vi.spyOn(document, 'addEventListener').mockImplementation((type, cb) => {
      if (type === 'visibilitychange') visibilityListeners.push(cb as () => void)
    })
    vi.spyOn(document, 'removeEventListener').mockImplementation((type, cb) => {
      if (type === 'visibilitychange') {
        const i = visibilityListeners.indexOf(cb as () => void)

        if (i >= 0) visibilityListeners.splice(i, 1)
      }
    })

    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(cb: IntersectionObserverCallback) {
          observerCallback = cb
        }
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  const tickFrame = (now = performance.now()) => {
    const callbacks = rafCallbacks

    rafCallbacks = []
    for (const cb of callbacks) cb(now)
  }

  it('combined gates: scene only ticks when visible AND in-view AND not idle', () => {
    const scheduler = new FrameScheduler()
    const client = vi.fn()

    scheduler.add(client)
    scheduler.start()

    const visibility = createVisibilityWatcher()
    const canvas = document.createElement('canvas')
    const intersection = createIntersectionWatcher(canvas)

    const update = () => {
      const should = visibility.isVisible() && intersection.isInView()

      if (should) scheduler.resume()
      else scheduler.pause()
    }

    visibility.subscribe(update)
    intersection.subscribe(update)
    update()

    tickFrame(0)
    expect(client).toHaveBeenCalledTimes(1)

    // Tab hidden → pause
    visibilityState = 'hidden'
    visibilityListeners.forEach((l) => l())
    tickFrame(16)
    expect(client).toHaveBeenCalledTimes(1)

    // Tab visible again → resume
    visibilityState = 'visible'
    visibilityListeners.forEach((l) => l())
    tickFrame(32)
    expect(client).toHaveBeenCalledTimes(2)

    // Canvas offscreen → pause
    observerCallback!([{ isIntersecting: false } as IntersectionObserverEntry], null as never)
    tickFrame(48)
    expect(client).toHaveBeenCalledTimes(2)

    // Canvas back in view → resume
    observerCallback!([{ isIntersecting: true } as IntersectionObserverEntry], null as never)
    tickFrame(64)
    expect(client).toHaveBeenCalledTimes(3)

    // Idle → final flush, then halt
    scheduler.setIdle(true)
    tickFrame(80) // flush
    expect(client).toHaveBeenCalledTimes(4)
    tickFrame(96) // no tick
    expect(client).toHaveBeenCalledTimes(4)

    // Wake via requestRender
    scheduler.requestRender()
    tickFrame(112)
    expect(client).toHaveBeenCalledTimes(5)
  })
})

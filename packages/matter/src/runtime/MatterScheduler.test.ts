import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MatterScheduler } from './MatterScheduler.js'

describe('MatterScheduler', () => {
  let rafCallbacks: FrameRequestCallback[] = []
  let nextRafId = 0

  beforeEach(() => {
    rafCallbacks = []
    nextRafId = 0
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafCallbacks.push(cb)
      return ++nextRafId
    })
    vi.stubGlobal('cancelAnimationFrame', (_id: number) => {
      // no-op for these tests
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  /** Drive one frame: invoke every queued rAF callback exactly once. */
  const tickFrame = (now = performance.now()) => {
    const callbacks = rafCallbacks
    rafCallbacks = []
    for (const cb of callbacks) cb(now)
  }

  it('invokes registered clients on every tick', () => {
    const scheduler = new MatterScheduler()
    const client = vi.fn()
    scheduler.add(client)
    scheduler.start()

    tickFrame(0)
    tickFrame(16)
    tickFrame(32)

    expect(client).toHaveBeenCalledTimes(3)
  })

  it('does not invoke removed clients', () => {
    const scheduler = new MatterScheduler()
    const client = vi.fn()
    scheduler.add(client)
    scheduler.start()
    tickFrame(0)
    expect(client).toHaveBeenCalledTimes(1)

    scheduler.remove(client)
    tickFrame(16)
    expect(client).toHaveBeenCalledTimes(1) // unchanged
  })

  it('passes the timestamp delta (in seconds) to each client', () => {
    const scheduler = new MatterScheduler()
    const client = vi.fn()
    scheduler.add(client)
    scheduler.start()

    tickFrame(1000) // first frame establishes the baseline
    tickFrame(1016) // 16ms later

    expect(client).toHaveBeenLastCalledWith(expect.objectContaining({ delta: 0.016 }))
  })

  it('stops invoking clients after pause()', () => {
    const scheduler = new MatterScheduler()
    const client = vi.fn()
    scheduler.add(client)
    scheduler.start()
    tickFrame(0)
    expect(client).toHaveBeenCalledTimes(1)

    scheduler.pause()
    tickFrame(16)
    expect(client).toHaveBeenCalledTimes(1) // paused, no call
  })

  it('resumes invoking clients after resume()', () => {
    const scheduler = new MatterScheduler()
    const client = vi.fn()
    scheduler.add(client)
    scheduler.start()
    scheduler.pause()
    scheduler.resume()
    tickFrame(0)
    expect(client).toHaveBeenCalledTimes(1)
  })

  it('does not start the rAF loop when no clients are registered', () => {
    const scheduler = new MatterScheduler()
    scheduler.start()
    expect(rafCallbacks.length).toBe(0)
  })

  it('starts the rAF loop when the first client is added', () => {
    const scheduler = new MatterScheduler()
    scheduler.start()
    scheduler.add(vi.fn())
    expect(rafCallbacks.length).toBe(1)
  })
})

describe('setIdle (render-on-demand)', () => {
  let rafCallbacks: FrameRequestCallback[] = []
  let nextRafId = 0

  beforeEach(() => {
    rafCallbacks = []
    nextRafId = 0
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafCallbacks.push(cb)
      return ++nextRafId
    })
    vi.stubGlobal('cancelAnimationFrame', () => {})
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const tickFrame = (now = performance.now()) => {
    const callbacks = rafCallbacks
    rafCallbacks = []
    for (const cb of callbacks) cb(now)
  }

  it('runs one final tick when setIdle(true) is called, then halts', () => {
    const scheduler = new MatterScheduler()
    const client = vi.fn()
    scheduler.add(client)
    scheduler.start()
    tickFrame(0)
    tickFrame(16)
    expect(client).toHaveBeenCalledTimes(2)

    scheduler.setIdle(true)
    tickFrame(32) // final flush tick
    expect(client).toHaveBeenCalledTimes(3)
    tickFrame(48) // no further ticks
    expect(client).toHaveBeenCalledTimes(3)
    tickFrame(64)
    expect(client).toHaveBeenCalledTimes(3)
  })

  it('resumes ticking when setIdle(false) is called', () => {
    const scheduler = new MatterScheduler()
    const client = vi.fn()
    scheduler.add(client)
    scheduler.start()
    scheduler.setIdle(true)
    tickFrame(0) // final flush
    expect(client).toHaveBeenCalledTimes(1)
    tickFrame(16) // no tick (idle)
    expect(client).toHaveBeenCalledTimes(1)

    scheduler.setIdle(false)
    tickFrame(32)
    expect(client).toHaveBeenCalledTimes(2)
    tickFrame(48)
    expect(client).toHaveBeenCalledTimes(3)
  })

  it('requestRender() forces one tick while idle', () => {
    const scheduler = new MatterScheduler()
    const client = vi.fn()
    scheduler.add(client)
    scheduler.start()
    scheduler.setIdle(true)
    tickFrame(0)
    expect(client).toHaveBeenCalledTimes(1)
    tickFrame(16)
    expect(client).toHaveBeenCalledTimes(1)

    scheduler.requestRender()
    tickFrame(32)
    expect(client).toHaveBeenCalledTimes(2)
    tickFrame(48) // back to idle
    expect(client).toHaveBeenCalledTimes(2)
  })
})

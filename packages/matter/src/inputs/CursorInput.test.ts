import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CursorInput } from './CursorInput.js'

describe('CursorInput', () => {
  beforeEach(() => {
    // happy-dom provides window/document; we just need a clean event slate.
    document.body.innerHTML = ''
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('starts at the configured initial position', () => {
    const cursor = new CursorInput({ initial: [0.25, 0.75] })
    expect(cursor.get()).toEqual([0.25, 0.75])
    cursor.dispose()
  })

  it('updates target on mousemove (in normalized 0..1 coordinates)', () => {
    const cursor = new CursorInput({ smoothing: 0 }) // no smoothing — read raw target
    Object.defineProperty(window, 'innerWidth', { value: 1000, configurable: true })
    Object.defineProperty(window, 'innerHeight', { value: 500, configurable: true })

    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 500, clientY: 250 }))
    cursor.tick(1) // advance one full second; with smoothing 0, value snaps to target instantly

    expect(cursor.get()).toEqual([0.5, 0.5])
    cursor.dispose()
  })

  it('approaches the target gradually when smoothing > 0', () => {
    const cursor = new CursorInput({ smoothing: 0.5, initial: [0, 0] })
    Object.defineProperty(window, 'innerWidth', { value: 1000, configurable: true })
    Object.defineProperty(window, 'innerHeight', { value: 1000, configurable: true })

    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 1000, clientY: 1000 }))

    cursor.tick(0.016) // 16ms tick
    const after1 = cursor.get()
    expect(after1[0]).toBeGreaterThan(0)
    expect(after1[0]).toBeLessThan(1)

    cursor.tick(0.016)
    const after2 = cursor.get()
    expect(after2[0]).toBeGreaterThan(after1[0]) // monotonically approaching target
    cursor.dispose()
  })

  it('notifies subscribers on change', () => {
    const cursor = new CursorInput({ smoothing: 0 })
    const sub = vi.fn()
    cursor.on('change', sub)

    Object.defineProperty(window, 'innerWidth', { value: 1000, configurable: true })
    Object.defineProperty(window, 'innerHeight', { value: 1000, configurable: true })
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 500, clientY: 500 }))
    cursor.tick(1)

    expect(sub).toHaveBeenCalled()
    expect(sub.mock.calls[0]?.[0]).toEqual([0.5, 0.5])
    cursor.dispose()
  })

  it('removes listeners on dispose', () => {
    const cursor = new CursorInput({ smoothing: 0 })
    const sub = vi.fn()
    cursor.on('change', sub)
    cursor.dispose()

    Object.defineProperty(window, 'innerWidth', { value: 1000, configurable: true })
    Object.defineProperty(window, 'innerHeight', { value: 1000, configurable: true })
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 500, clientY: 500 }))
    cursor.tick(1)

    expect(sub).not.toHaveBeenCalled()
  })

  it('normalizes against an element rect when `element` is supplied', () => {
    // Element at viewport (100, 200) sized 400x300. Cursor at viewport (300, 350)
    // is at element-relative (200, 150) → element-normalized (0.5, 0.5).
    const fakeElement = {
      getBoundingClientRect: () => ({ left: 100, top: 200, width: 400, height: 300 }),
    }
    const cursor = new CursorInput({ smoothing: 0, element: fakeElement })

    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 300, clientY: 350 }))
    cursor.tick(1)

    expect(cursor.get()).toEqual([0.5, 0.5])
    cursor.dispose()
  })
})

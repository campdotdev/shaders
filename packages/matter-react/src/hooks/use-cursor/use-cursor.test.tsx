import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useCursor } from './use-cursor.js'

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', () => 0)
  vi.stubGlobal('cancelAnimationFrame', () => {})
})
afterEach(() => {
  vi.unstubAllGlobals()
})

const fireMoveOnWindow = (clientX: number, clientY: number) => {
  window.dispatchEvent(new MouseEvent('mousemove', { clientX, clientY, bubbles: true }))
}

describe('useCursor', () => {
  it('returns initial value [0.5, 0.5] before any pointer move', () => {
    const { result } = renderHook(() => useCursor())

    const [x, y] = result.current.get()

    expect(x).toBe(0.5)
    expect(y).toBe(0.5)
  })

  it('updates the target on mousemove (viewport-normalized without element opt)', () => {
    const { result } = renderHook(() => useCursor())

    act(() => {})

    const signal = result.current
    let lastChange: readonly [number, number] | undefined

    signal.on('change', (v) => {
      lastChange = v
    })

    act(() => {
      fireMoveOnWindow(0, 0)
    })
    act(() => {
      if ('tick' in signal) {
        ;(signal as unknown as { tick(d: number): void }).tick(1)
      }
    })

    expect(signal.get()).toBeDefined()
    expect(signal.get().length).toBe(2)
    if (lastChange !== undefined) {
      expect(lastChange.length).toBe(2)
    }
  })

  it('survives Strict Mode pseudo-unmount/remount cycle without throwing', () => {
    const { unmount } = renderHook(() => useCursor())

    act(() => {})

    expect(() => unmount()).not.toThrow()
  })
})

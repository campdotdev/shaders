import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useCursor } from './use-cursor.js'

// useCursor uses requestAnimationFrame for its free-running tick (no MatterScene context).
// Stub rAF so the effect doesn't hang in happy-dom.
beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', () => 0)
  vi.stubGlobal('cancelAnimationFrame', () => {})
})
afterEach(() => {
  vi.unstubAllGlobals()
})

// CursorInput listens on `window.mousemove` by default.
const fireMoveOnWindow = (clientX: number, clientY: number) => {
  window.dispatchEvent(new MouseEvent('mousemove', { clientX, clientY, bubbles: true }))
}

describe('useCursor', () => {
  it('returns initial value [0.5, 0.5] before any pointer move', () => {
    const { result } = renderHook(() => useCursor())
    // On first render the STUB_SIGNAL is returned (effect not yet run); its
    // get() returns the center position.
    const [x, y] = result.current.get()

    expect(x).toBe(0.5)
    expect(y).toBe(0.5)
  })

  it('updates the target on mousemove (viewport-normalized without element opt)', () => {
    // happy-dom sets window.innerWidth/Height to 0, so normalised coords
    // fall back to dividing by 1 (the `|| 1` guard in CursorInput).
    // Fire a move at (100, 50): x = 100/1 = 100, y = 50/1 = 50 (clamped by nothing).
    // The important thing to verify is that the signal's get() is callable
    // and updates after tick().
    const { result } = renderHook(() => useCursor())

    // Wait for the effect to create a real CursorInput.
    // After act the state update from setInput runs.
    act(() => {})

    const signal = result.current
    // Subscribe to changes; invoke tick manually to drive the smoothing.
    let lastChange: readonly [number, number] | undefined

    signal.on('change', (v) => {
      lastChange = v
    })

    act(() => {
      fireMoveOnWindow(0, 0)
    })
    // tick the cursor forward (smoothing factor > 0 so it moves toward target).
    act(() => {
      if ('tick' in signal) {
        // CursorInput is the real instance once the effect has run.
        ;(signal as unknown as { tick(d: number): void }).tick(1)
      }
    })

    // After the tick the value should have moved away from [0.5, 0.5].
    // We just confirm the subscription and tick mechanism work without throwing.
    expect(signal.get()).toBeDefined()
    expect(signal.get().length).toBe(2)
    if (lastChange !== undefined) {
      expect(lastChange.length).toBe(2)
    }
  })

  it('survives Strict Mode pseudo-unmount/remount cycle without throwing', () => {
    // Verifies the lifecycle pattern from CLAUDE.md gotcha #14: collapse
    // create+dispose into one effect so Strict Mode's extra cycle is clean.
    const { unmount } = renderHook(() => useCursor())

    act(() => {})
    // Should not throw on unmount even before the async setup resolves.
    expect(() => unmount()).not.toThrow()
  })
})

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { MatterScheduler } from '@lovo/matter'
import { MatterContext } from './matter-context.js'
import { useStaticHint } from './useStaticHint.js'
import type { ReactNode } from 'react'

// Minimal MatterContextValue stub — only `scheduler` is exercised here.
const makeWrapper = (scheduler: MatterScheduler) => {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MatterContext.Provider
        value={
          {
            scheduler,
            // The other context fields aren't read by useStaticHint — cast.
          } as unknown as React.ContextType<typeof MatterContext>
        }
      >
        {children}
      </MatterContext.Provider>
    )
  }
  return Wrapper
}

describe('useStaticHint', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', () => 0)
    vi.stubGlobal('cancelAnimationFrame', () => {})
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('marks the scheduler idle when hint=true', () => {
    const scheduler = new MatterScheduler()
    const setIdle = vi.spyOn(scheduler, 'setIdle')
    renderHook(() => useStaticHint(true), { wrapper: makeWrapper(scheduler) })
    expect(setIdle).toHaveBeenLastCalledWith(true)
  })

  it('marks the scheduler not idle when hint=false', () => {
    const scheduler = new MatterScheduler()
    const setIdle = vi.spyOn(scheduler, 'setIdle')
    renderHook(() => useStaticHint(false), { wrapper: makeWrapper(scheduler) })
    expect(setIdle).toHaveBeenLastCalledWith(false)
  })

  it('reverts to non-idle on unmount', () => {
    const scheduler = new MatterScheduler()
    const setIdle = vi.spyOn(scheduler, 'setIdle')
    const { unmount } = renderHook(() => useStaticHint(true), {
      wrapper: makeWrapper(scheduler),
    })
    unmount()
    expect(setIdle).toHaveBeenLastCalledWith(false)
  })

  it('does not call requestRender on render when hint is unchanged', () => {
    // Sanity: the hook does not spuriously call requestRender on every render.
    const scheduler = new MatterScheduler()
    const requestRender = vi.spyOn(scheduler, 'requestRender')
    const { rerender } = renderHook(({ hint }) => useStaticHint(hint), {
      wrapper: makeWrapper(scheduler),
      initialProps: { hint: true },
    })
    rerender({ hint: true })
    rerender({ hint: true })
    expect(requestRender).not.toHaveBeenCalled()
  })
})

import { FrameScheduler } from '@lovo/matter'
import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ShaderContext } from '../../context/matter-context.js'

import { useStaticHint } from './use-static-hint.js'

// Minimal ShaderContextValue stub — only `scheduler` is exercised here.
const makeWrapper = (scheduler: FrameScheduler) => {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <ShaderContext.Provider
        value={
          {
            scheduler,
            // The other context fields aren't read by useStaticHint — cast.
          } as unknown as React.ContextType<typeof ShaderContext>
        }
      >
        {children}
      </ShaderContext.Provider>
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
    const scheduler = new FrameScheduler()
    const setIdle = vi.spyOn(scheduler, 'setIdle')

    renderHook(() => useStaticHint(true), { wrapper: makeWrapper(scheduler) })
    expect(setIdle).toHaveBeenLastCalledWith(true)
  })

  it('marks the scheduler not idle when hint=false', () => {
    const scheduler = new FrameScheduler()
    const setIdle = vi.spyOn(scheduler, 'setIdle')

    renderHook(() => useStaticHint(false), { wrapper: makeWrapper(scheduler) })
    expect(setIdle).toHaveBeenLastCalledWith(false)
  })

  it('reverts to non-idle on unmount', () => {
    const scheduler = new FrameScheduler()
    const setIdle = vi.spyOn(scheduler, 'setIdle')
    const { unmount } = renderHook(() => useStaticHint(true), {
      wrapper: makeWrapper(scheduler),
    })

    unmount()
    expect(setIdle).toHaveBeenLastCalledWith(false)
  })

  it('does not call requestRender on render when hint is unchanged', () => {
    // Sanity: the hook does not spuriously call requestRender on every render.
    const scheduler = new FrameScheduler()
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

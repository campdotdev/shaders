import { cleanup, render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

import {
  type OverlayTransform,
  ShaderContext,
  type ShaderContextValue,
} from '../../context/shader-context.js'

import { useOverlayPass } from './use-overlay-pass.js'

function makeCtx(): { ctx: ShaderContextValue; registered: OverlayTransform[]; cleanups: number } {
  const registered: OverlayTransform[] = []
  let cleanups = 0
  const ctx = {
    renderer: {} as ShaderContextValue['renderer'],
    scene: {} as ShaderContextValue['scene'],
    camera: {} as ShaderContextValue['camera'],
    scheduler: {} as ShaderContextValue['scheduler'],
    registerOverlay: (transform: OverlayTransform) => {
      registered.push(transform)

      return () => {
        cleanups++
      }
    },
  }

  return { ctx, registered, cleanups }
}

function Wrapper({ ctx, children }: { ctx: ShaderContextValue | null; children: ReactNode }) {
  return <ShaderContext.Provider value={ctx}>{children}</ShaderContext.Provider>
}

const identityTransform: OverlayTransform = (input) => input

describe('useOverlayPass', () => {
  it('registers the transform on mount', () => {
    const { ctx, registered } = makeCtx()

    function Probe() {
      useOverlayPass(identityTransform, [])

      return null
    }

    render(
      <Wrapper ctx={ctx}>
        <Probe />
      </Wrapper>,
    )
    expect(registered).toHaveLength(1)
    cleanup()
  })

  it('calls the cleanup returned by registerOverlay on unmount', () => {
    const cleanupFn = vi.fn()
    const ctx = {
      renderer: {} as ShaderContextValue['renderer'],
      scene: {} as ShaderContextValue['scene'],
      camera: {} as ShaderContextValue['camera'],
      scheduler: {} as ShaderContextValue['scheduler'],
      registerOverlay: () => cleanupFn,
    } as unknown as ShaderContextValue

    function Probe() {
      useOverlayPass(identityTransform, [])

      return null
    }

    const { unmount } = render(
      <Wrapper ctx={ctx}>
        <Probe />
      </Wrapper>,
    )

    unmount()
    expect(cleanupFn).toHaveBeenCalledTimes(1)
  })

  it('re-registers when a value in deps changes', () => {
    const { ctx, registered } = makeCtx()

    function Probe({ mode }: { mode: 'a' | 'b' }) {
      useOverlayPass(identityTransform, [mode])

      return null
    }

    const { rerender } = render(
      <Wrapper ctx={ctx}>
        <Probe mode="a" />
      </Wrapper>,
    )

    expect(registered).toHaveLength(1)
    rerender(
      <Wrapper ctx={ctx}>
        <Probe mode="b" />
      </Wrapper>,
    )
    expect(registered).toHaveLength(2)
    cleanup()
  })

  it('is a no-op when called outside a ShaderScene provider', () => {
    function Probe() {
      useOverlayPass(identityTransform, [])

      return null
    }

    // Render without a provider. No throw expected.
    expect(() => render(<Probe />)).not.toThrow()
    cleanup()
  })
})

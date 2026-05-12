import { describe, expect, it, vi, beforeEach, afterEach } from 'vite-plus/test'
import { render, waitFor } from '@testing-library/react'
import type * as MatterModule from '@lovo/matter'
import { MatterScene } from './MatterScene.js'

// Mock createRenderer because happy-dom cannot initialize WebGPU.
// The other @lovo/matter exports (MatterScheduler, createVisibilityWatcher,
// createIntersectionWatcher) work fine in happy-dom and don't need mocking.
vi.mock('@lovo/matter', async (importOriginal) => {
  const actual = await importOriginal<typeof MatterModule>()
  return {
    ...actual,
    createRenderer: vi.fn(async () => ({
      three: {
        render: vi.fn(),
        dispose: vi.fn(),
        domElement: document.createElement('canvas'),
        getPixelRatio: () => 1,
        setSize: vi.fn(),
      },
      backend: 'webgl2' as const,
      dispose: vi.fn(),
      resize: vi.fn(),
    })),
  }
})

describe('MatterScene', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', () => 0)
    vi.stubGlobal('cancelAnimationFrame', () => {})
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('mounts a canvas element', () => {
    const { container } = render(<MatterScene />)
    expect(container.querySelector('canvas')).toBeInTheDocument()
  })

  it('renders the fallback before the async context resolves', () => {
    // createRenderer is async; on the initial render ctx is null so the
    // fallback prop is shown.
    const { container } = render(<MatterScene fallback={<div data-testid="fb">loading</div>} />)
    expect(container.querySelector('[data-testid="fb"]')).toBeInTheDocument()
  })

  it('does not throw on unmount', async () => {
    const { unmount } = render(<MatterScene />)
    // Allow a tick for the async setup to run (or be cancelled).
    await waitFor(() => {})
    expect(() => unmount()).not.toThrow()
  })
})

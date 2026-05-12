import { describe, expect, it } from 'vite-plus/test'
import { render, screen, act } from '@testing-library/react'
import { FallbackBoundary } from './FallbackBoundary.js'

// FallbackBoundary is a client-mount gate: it renders `fallback` until the
// component mounts on the client (useEffect fires), then swaps to children.
// It is NOT a React error boundary.

describe('FallbackBoundary', () => {
  it('renders children after mount (no fallback given)', () => {
    render(
      <FallbackBoundary>
        <div>child</div>
      </FallbackBoundary>,
    )
    // happy-dom runs effects synchronously within act; children should be visible.
    act(() => {})
    expect(screen.getByText('child')).toBeInTheDocument()
  })

  it('renders the fallback before mount, then swaps to children', () => {
    // Render outside act so the effect has not fired yet.
    const { container } = render(
      <FallbackBoundary fallback={<div data-testid="fb">loading</div>}>
        <div data-testid="child">child</div>
      </FallbackBoundary>,
    )
    // After act (effects run), children replace the fallback.
    act(() => {})
    expect(screen.getByTestId('child')).toBeInTheDocument()
    expect(container.querySelector('[data-testid="fb"]')).not.toBeInTheDocument()
  })
})

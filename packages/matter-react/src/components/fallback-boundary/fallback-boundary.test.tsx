import { act, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { FallbackBoundary } from './fallback-boundary.js'

describe('FallbackBoundary', () => {
  it('renders children after mount (no fallback given)', () => {
    render(
      <FallbackBoundary>
        <div>child</div>
      </FallbackBoundary>,
    )
    act(() => {})
    expect(screen.getByText('child')).toBeInTheDocument()
  })

  it('renders the fallback before mount, then swaps to children', () => {
    const { container } = render(
      <FallbackBoundary fallback={<div data-testid="fb">loading</div>}>
        <div data-testid="child">child</div>
      </FallbackBoundary>,
    )

    act(() => {})
    expect(screen.getByTestId('child')).toBeInTheDocument()
    expect(container.querySelector('[data-testid="fb"]')).not.toBeInTheDocument()
  })
})

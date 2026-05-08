import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MatterScheduler } from '@lovo/matter'
import { MatterContext } from './matter-context.js'
import { MatterMonitor } from './MatterMonitor.js'
import type { ReactNode } from 'react'

const wrap = (scheduler: MatterScheduler) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MatterContext.Provider
        value={{ scheduler } as unknown as React.ContextType<typeof MatterContext>}
      >
        {children}
      </MatterContext.Provider>
    )
  }

describe('MatterMonitor', () => {
  it('renders without crashing inside a MatterScene context', () => {
    const scheduler = new MatterScheduler()
    render(<MatterMonitor />, { wrapper: wrap(scheduler) })
    expect(screen.getByTestId('matter-monitor')).toBeInTheDocument()
  })

  it('shows initial state: 0 ticks, fps —', () => {
    const scheduler = new MatterScheduler()
    render(<MatterMonitor />, { wrapper: wrap(scheduler) })
    expect(screen.getByTestId('matter-monitor-ticks').textContent).toContain('0')
    expect(screen.getByTestId('matter-monitor-fps').textContent).toMatch(/—|0/)
  })

  it('renders without context (graceful no-op)', () => {
    // Outside a MatterScene, the monitor should render a small "no scene" badge
    // rather than throwing.
    expect(() => render(<MatterMonitor />)).not.toThrow()
  })
})

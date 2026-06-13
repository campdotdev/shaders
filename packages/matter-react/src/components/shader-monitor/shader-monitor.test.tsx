import type { ReactNode } from 'react';

import { FrameScheduler } from '@lovo/matter';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ShaderContext } from '../../context/shader-context.js';
import { ShaderMonitor } from './shader-monitor.js';

const createSchedulerWrapper = (scheduler: FrameScheduler) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <ShaderContext.Provider
        value={{ scheduler } as unknown as React.ContextType<typeof ShaderContext>}
      >
        {children}
      </ShaderContext.Provider>
    );
  };

describe('ShaderMonitor', () => {
  it('renders without crashing inside a ShaderScene context', () => {
    const scheduler = new FrameScheduler();

    render(<ShaderMonitor />, { wrapper: createSchedulerWrapper(scheduler) });
    expect(screen.getByTestId('matter-monitor')).toBeInTheDocument();
  });

  it('shows initial state: 0 ticks, fps —', () => {
    const scheduler = new FrameScheduler();

    render(<ShaderMonitor />, { wrapper: createSchedulerWrapper(scheduler) });
    expect(screen.getByTestId('matter-monitor-ticks').textContent).toContain('0');
    expect(screen.getByTestId('matter-monitor-fps').textContent).toMatch(/—|0/);
  });

  it('renders without context (graceful no-op)', () => {
    // Outside a ShaderScene, the monitor should render a small "no scene" badge
    // rather than throwing.
    expect(() => render(<ShaderMonitor />)).not.toThrow();
  });
});

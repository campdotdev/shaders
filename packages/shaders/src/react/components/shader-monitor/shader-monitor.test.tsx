import type { ReactNode } from 'react';

import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { FrameScheduler } from '../../../engine.js';
import { ShaderContext, type ShaderContextValue } from '../../context/shader-context.js';
import { ShaderMonitor } from './shader-monitor.js';

// A scene that cannot time its passes: the off switch exists, and no frame
// time ever arrives.
const untimedGpu: ShaderContextValue['timeGpu'] = () => () => undefined;

const createContextWrapper = (
  scheduler: FrameScheduler,
  timeGpu: ShaderContextValue['timeGpu'] = untimedGpu,
) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <ShaderContext.Provider
        value={{ scheduler, timeGpu } as unknown as React.ContextType<typeof ShaderContext>}
      >
        {children}
      </ShaderContext.Provider>
    );
  };

/**
 * A started scheduler on a stubbed requestAnimationFrame, and a `tickAt`
 * that runs one frame at a given time, in milliseconds.
 */
function startScheduler() {
  let frameCallbacks: FrameRequestCallback[] = [];

  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frameCallbacks.push(callback);

    return frameCallbacks.length;
  });
  vi.stubGlobal('cancelAnimationFrame', () => undefined);

  const scheduler = new FrameScheduler();

  scheduler.start();

  const tickAt = (now: number) => {
    const callbacks = frameCallbacks;

    frameCallbacks = [];
    act(() => {
      for (const callback of callbacks) callback(now);
    });
  };

  return { scheduler, tickAt };
}

describe('ShaderMonitor', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders without crashing inside a ShaderScene context', () => {
    const scheduler = new FrameScheduler();

    render(<ShaderMonitor />, { wrapper: createContextWrapper(scheduler) });
    expect(screen.getByTestId('shaders-monitor')).toBeInTheDocument();
  });

  it('shows initial state: 0 ticks, fps —', () => {
    const scheduler = new FrameScheduler();

    render(<ShaderMonitor />, { wrapper: createContextWrapper(scheduler) });
    expect(screen.getByTestId('shaders-monitor-ticks').textContent).toContain('0');
    expect(screen.getByTestId('shaders-monitor-fps').textContent).toMatch(/—|0/);
  });

  it('shows a dash for GPU time when the scene cannot time its passes', () => {
    const { scheduler, tickAt } = startScheduler();

    render(<ShaderMonitor />, { wrapper: createContextWrapper(scheduler) });
    tickAt(1000);
    tickAt(1600);

    expect(screen.getByTestId('shaders-monitor-gpu').textContent).toBe('gpu: —');
  });

  // The fps readout closes a window once 500ms have passed. The GPU readout
  // averages the frame times that arrived in the same window.
  it('shows the GPU milliseconds per frame, averaged over the fps window', () => {
    const { scheduler, tickAt } = startScheduler();
    let reportFrameTime: (milliseconds: number) => void = () => undefined;
    const timeGpu: ShaderContextValue['timeGpu'] = (onFrameTime) => {
      reportFrameTime = onFrameTime;

      return () => undefined;
    };

    render(<ShaderMonitor />, { wrapper: createContextWrapper(scheduler, timeGpu) });
    tickAt(1000);
    reportFrameTime(4);
    reportFrameTime(6.5);
    tickAt(1600);

    expect(screen.getByTestId('shaders-monitor-gpu').textContent).toBe('gpu: 5.25 ms');
  });

  it('turns GPU timing off when it unmounts', () => {
    const scheduler = new FrameScheduler();
    const stopTiming = vi.fn();
    const timeGpu = vi.fn(() => stopTiming);

    const { unmount } = render(<ShaderMonitor />, {
      wrapper: createContextWrapper(scheduler, timeGpu),
    });

    expect(timeGpu).toHaveBeenCalledTimes(1);
    expect(stopTiming).not.toHaveBeenCalled();
    unmount();
    expect(stopTiming).toHaveBeenCalledTimes(1);
  });

  it('renders without context (graceful no-op)', () => {
    // Outside a ShaderScene, the monitor should render a small "no scene" badge
    // rather than throwing.
    expect(() => render(<ShaderMonitor />)).not.toThrow();
  });
});

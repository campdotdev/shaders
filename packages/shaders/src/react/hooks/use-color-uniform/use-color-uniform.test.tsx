import type { ReactNode } from 'react';

import { renderHook } from '@testing-library/react';
import type { Vector3 } from 'three/webgpu';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FrameScheduler } from '../../../engine.js';
import { ShaderContext } from '../../context/shader-context.js';
import { useColorUniform } from './use-color-uniform.js';

// The context value is made once, as ShaderScene's is, so a rerender keeps
// its identity.
const makeWrapper = (scheduler: FrameScheduler) => {
  const value = { scheduler } as unknown as React.ContextType<typeof ShaderContext>;

  function Wrapper({ children }: { children: ReactNode }) {
    return <ShaderContext.Provider value={value}>{children}</ShaderContext.Provider>;
  }

  return Wrapper;
};

const channelsOf = (node: unknown) => (node as { value: Vector3 }).value.toArray();

describe('useColorUniform', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', () => 0);
    vi.stubGlobal('cancelAnimationFrame', () => {});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('decodes the color into linear rgb', () => {
    const { result } = renderHook(() => useColorUniform('#ff0000'));

    expect(channelsOf(result.current)).toEqual([1, 0, 0]);
  });

  it('reads the wide-gamut oklch() strings', () => {
    const { result } = renderHook(() => useColorUniform('oklch(1 0 0)'));

    for (const channel of channelsOf(result.current)) {
      expect(channel).toBeCloseTo(1, 4);
    }
  });

  // The material captures the uniform when it compiles, so a new color has to
  // land in the same node, and a static scene has to be asked for a frame or
  // it keeps showing the old color.
  it('writes a new color into the same uniform, and requests a render', () => {
    const scheduler = new FrameScheduler();

    scheduler.setIdle(true);
    const requestRender = vi.spyOn(scheduler, 'requestRender');

    const { result, rerender } = renderHook(({ color }) => useColorUniform(color), {
      initialProps: { color: '#ff0000' },
      wrapper: makeWrapper(scheduler),
    });
    const first = result.current;
    const callsBefore = requestRender.mock.calls.length;

    rerender({ color: '#0000ff' });

    expect(result.current).toBe(first);
    expect(channelsOf(result.current)).toEqual([0, 0, 1]);
    expect(requestRender.mock.calls.length).toBe(callsBefore + 1);
  });

  it('requests no render when the color stays the same', () => {
    const scheduler = new FrameScheduler();
    const requestRender = vi.spyOn(scheduler, 'requestRender');

    const { rerender } = renderHook(({ color }) => useColorUniform(color), {
      initialProps: { color: '#ff0000' },
      wrapper: makeWrapper(scheduler),
    });
    const callsBefore = requestRender.mock.calls.length;

    rerender({ color: '#ff0000' });

    expect(requestRender.mock.calls.length).toBe(callsBefore);
  });
});

import { createElement, type ReactNode } from 'react';

import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { ResizeSignal } from '../../../inputs/canvas-size/canvas-size.js';
import { ShaderContext, type ShaderContextValue } from '../../context/shader-context.js';
import { useResize } from './use-resize.js';

describe('useResize', () => {
  // The scene owns the one size signal per canvas, so the hook hands that
  // signal over on its first render, with no observer of its own.
  it("returns the enclosing scene's size signal", () => {
    const canvasSize: ResizeSignal = {
      get: () => [800, 400, 2] as const,
      on: () => () => undefined,
    };
    const context = { canvasSize } as unknown as ShaderContextValue;
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(ShaderContext.Provider, { value: context }, children);

    const { result } = renderHook(() => useResize(), { wrapper });

    expect(result.current).toBe(canvasSize);
  });

  it('reads as a zero size outside a scene', () => {
    const { result } = renderHook(() => useResize());

    expect(result.current.get()).toEqual([0, 0, 1]);
  });
});

import type { ReactNode } from 'react';

import { cleanup, render } from '@testing-library/react';
import { uniform } from 'three/tsl';
import { describe, expect, it, vi } from 'vitest';

import {
  ShaderContext,
  type ShaderContextValue,
  type UvWarp,
} from '../../context/shader-context.js';
import { useUvWarp } from './use-uv-warp.js';

function makeCtx(): {
  ctx: ShaderContextValue;
  registered: UvWarp[];
} {
  const registered: UvWarp[] = [];
  const ctx = {
    renderer: {} as ShaderContextValue['renderer'],
    scene: {} as ShaderContextValue['scene'],
    camera: {} as ShaderContextValue['camera'],
    scheduler: {} as ShaderContextValue['scheduler'],
    registerColorTransform: () => () => undefined,
    registerUvWarp: (warp: UvWarp) => {
      registered.push(warp);

      return () => undefined;
    },
    registerPrePass: () => () => undefined,
    getCursorInput: () => {
      throw new Error('not used by this hook');
    },
    canvasSize: {
      signal: { get: () => [0, 0, 1] as const, on: () => () => undefined },
      pixelRatio: uniform(1),
    },
    timeGpu: () => () => undefined,
  };

  return { ctx, registered };
}

function Wrapper({ ctx, children }: { ctx: ShaderContextValue | null; children: ReactNode }) {
  return <ShaderContext.Provider value={ctx}>{children}</ShaderContext.Provider>;
}

const identityWarp: UvWarp = (uvInput) => uvInput;

describe('useUvWarp', () => {
  it('registers the UV warp on mount', () => {
    const { ctx, registered } = makeCtx();

    function Probe() {
      useUvWarp(identityWarp, []);

      return null;
    }

    render(
      <Wrapper ctx={ctx}>
        <Probe />
      </Wrapper>,
    );
    expect(registered).toHaveLength(1);
    cleanup();
  });

  it('calls the cleanup returned by registerUvWarp on unmount', () => {
    const cleanupFn = vi.fn();
    const ctx = {
      renderer: {} as ShaderContextValue['renderer'],
      scene: {} as ShaderContextValue['scene'],
      camera: {} as ShaderContextValue['camera'],
      scheduler: {} as ShaderContextValue['scheduler'],
      registerColorTransform: () => () => undefined,
      registerUvWarp: () => cleanupFn,
    } as unknown as ShaderContextValue;

    function Probe() {
      useUvWarp(identityWarp, []);

      return null;
    }

    const { unmount } = render(
      <Wrapper ctx={ctx}>
        <Probe />
      </Wrapper>,
    );

    unmount();
    expect(cleanupFn).toHaveBeenCalledTimes(1);
  });

  it('re-registers when a value in deps changes', () => {
    const { ctx, registered } = makeCtx();

    function Probe({ mode }: { mode: 'a' | 'b' }) {
      useUvWarp(identityWarp, [mode]);

      return null;
    }

    const { rerender } = render(
      <Wrapper ctx={ctx}>
        <Probe mode="a" />
      </Wrapper>,
    );

    expect(registered).toHaveLength(1);
    rerender(
      <Wrapper ctx={ctx}>
        <Probe mode="b" />
      </Wrapper>,
    );
    expect(registered).toHaveLength(2);
    cleanup();
  });

  it('is a no-op when called outside a ShaderScene provider', () => {
    function Probe() {
      useUvWarp(identityWarp, []);

      return null;
    }

    expect(() => render(<Probe />)).not.toThrow();
    cleanup();
  });
});

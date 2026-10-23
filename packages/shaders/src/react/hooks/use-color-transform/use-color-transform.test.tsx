import type { ReactNode } from 'react';

import { cleanup, render } from '@testing-library/react';
import { uniform } from 'three/tsl';
import { describe, expect, it, vi } from 'vitest';

import {
  type ColorTransform,
  ShaderContext,
  type ShaderContextValue,
} from '../../context/shader-context.js';
import { useColorTransform } from './use-color-transform.js';

function makeCtx(): {
  ctx: ShaderContextValue;
  registered: ColorTransform[];
  cleanups: number;
} {
  const registered: ColorTransform[] = [];
  let cleanups = 0;
  const ctx = {
    renderer: {} as ShaderContextValue['renderer'],
    scene: {} as ShaderContextValue['scene'],
    camera: {} as ShaderContextValue['camera'],
    scheduler: {} as ShaderContextValue['scheduler'],
    registerColorTransform: (transform: ColorTransform) => {
      registered.push(transform);

      return () => {
        cleanups++;
      };
    },
    registerUvWarp: () => () => undefined,
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

  return { ctx, registered, cleanups };
}

function Wrapper({ ctx, children }: { ctx: ShaderContextValue | null; children: ReactNode }) {
  return <ShaderContext.Provider value={ctx}>{children}</ShaderContext.Provider>;
}

const identityTransform: ColorTransform = (input) => input;

describe('useColorTransform', () => {
  it('registers the color transform on mount', () => {
    const { ctx, registered } = makeCtx();

    function Probe() {
      useColorTransform(identityTransform, []);

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

  it('calls the cleanup returned by registerColorTransform on unmount', () => {
    const cleanupFn = vi.fn();
    const ctx = {
      renderer: {} as ShaderContextValue['renderer'],
      scene: {} as ShaderContextValue['scene'],
      camera: {} as ShaderContextValue['camera'],
      scheduler: {} as ShaderContextValue['scheduler'],
      registerColorTransform: () => cleanupFn,
    } as unknown as ShaderContextValue;

    function Probe() {
      useColorTransform(identityTransform, []);

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
      useColorTransform(identityTransform, [mode]);

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
      useColorTransform(identityTransform, []);

      return null;
    }

    expect(() => render(<Probe />)).not.toThrow();
    cleanup();
  });
});

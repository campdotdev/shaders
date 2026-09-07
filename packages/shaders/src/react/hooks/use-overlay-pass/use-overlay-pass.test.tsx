import type { ReactNode } from 'react';

import { cleanup, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  type PostProcessTransform,
  ShaderContext,
  type ShaderContextValue,
} from '../../context/shader-context.js';
import { usePostProcessPass } from './use-overlay-pass.js';

function makeCtx(): {
  ctx: ShaderContextValue;
  registered: PostProcessTransform[];
  cleanups: number;
} {
  const registered: PostProcessTransform[] = [];
  let cleanups = 0;
  const ctx = {
    renderer: {} as ShaderContextValue['renderer'],
    scene: {} as ShaderContextValue['scene'],
    camera: {} as ShaderContextValue['camera'],
    scheduler: {} as ShaderContextValue['scheduler'],
    registerOverlay: (transform: PostProcessTransform) => {
      registered.push(transform);

      return () => {
        cleanups++;
      };
    },
    registerBaseUvTransform: () => () => undefined,
  };

  return { ctx, registered, cleanups };
}

function Wrapper({ ctx, children }: { ctx: ShaderContextValue | null; children: ReactNode }) {
  return <ShaderContext.Provider value={ctx}>{children}</ShaderContext.Provider>;
}

const identityTransform: PostProcessTransform = (input) => input;

describe('usePostProcessPass', () => {
  it('registers the transform on mount', () => {
    const { ctx, registered } = makeCtx();

    function Probe() {
      usePostProcessPass(identityTransform, []);

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

  it('calls the cleanup returned by registerOverlay on unmount', () => {
    const cleanupFn = vi.fn();
    const ctx = {
      renderer: {} as ShaderContextValue['renderer'],
      scene: {} as ShaderContextValue['scene'],
      camera: {} as ShaderContextValue['camera'],
      scheduler: {} as ShaderContextValue['scheduler'],
      registerOverlay: () => cleanupFn,
    } as unknown as ShaderContextValue;

    function Probe() {
      usePostProcessPass(identityTransform, []);

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
      usePostProcessPass(identityTransform, [mode]);

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
      usePostProcessPass(identityTransform, []);

      return null;
    }

    expect(() => render(<Probe />)).not.toThrow();
    cleanup();
  });
});

import type { ReactNode } from 'react';

import { cleanup, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  ShaderContext,
  type ShaderContextValue,
  type UvTransform,
} from '../../context/shader-context.js';
import { useBasePassUv } from './use-base-pass-uv.js';

function makeCtx(): {
  ctx: ShaderContextValue;
  registered: UvTransform[];
} {
  const registered: UvTransform[] = [];
  const ctx = {
    renderer: {} as ShaderContextValue['renderer'],
    scene: {} as ShaderContextValue['scene'],
    camera: {} as ShaderContextValue['camera'],
    scheduler: {} as ShaderContextValue['scheduler'],
    registerOverlay: () => () => undefined,
    registerBaseUvTransform: (transform: UvTransform) => {
      registered.push(transform);

      return () => undefined;
    },
  };

  return { ctx, registered };
}

function Wrapper({ ctx, children }: { ctx: ShaderContextValue | null; children: ReactNode }) {
  return <ShaderContext.Provider value={ctx}>{children}</ShaderContext.Provider>;
}

const identityTransform: UvTransform = (uvInput) => uvInput;

describe('useBasePassUv', () => {
  it('registers the transform on mount', () => {
    const { ctx, registered } = makeCtx();

    function Probe() {
      useBasePassUv(identityTransform, []);

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

  it('calls the cleanup returned by registerBaseUvTransform on unmount', () => {
    const cleanupFn = vi.fn();
    const ctx = {
      renderer: {} as ShaderContextValue['renderer'],
      scene: {} as ShaderContextValue['scene'],
      camera: {} as ShaderContextValue['camera'],
      scheduler: {} as ShaderContextValue['scheduler'],
      registerOverlay: () => () => undefined,
      registerBaseUvTransform: () => cleanupFn,
    } as unknown as ShaderContextValue;

    function Probe() {
      useBasePassUv(identityTransform, []);

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
      useBasePassUv(identityTransform, [mode]);

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
      useBasePassUv(identityTransform, []);

      return null;
    }

    expect(() => render(<Probe />)).not.toThrow();
    cleanup();
  });
});

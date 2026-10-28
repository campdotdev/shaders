import type { ReactNode } from 'react';

import { cleanup, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  type Resample,
  ShaderContext,
  type ShaderContextValue,
} from '../../context/shader-context.js';
import { useResample } from './use-resample.js';

function makeContext(): {
  context: ShaderContextValue;
  registered: Resample[];
} {
  const registered: Resample[] = [];
  const context = {
    renderer: {} as ShaderContextValue['renderer'],
    scene: {} as ShaderContextValue['scene'],
    camera: {} as ShaderContextValue['camera'],
    scheduler: {} as ShaderContextValue['scheduler'],
    registerOverlay: () => () => undefined,
    registerResample: (resample: Resample) => {
      registered.push(resample);

      return () => undefined;
    },
    registerPrePass: () => () => undefined,
    getCursorInput: () => {
      throw new Error('not used by this hook');
    },
    canvasSize: { get: () => [0, 0, 1] as const, on: () => () => undefined },
    timeGpu: () => () => undefined,
  };

  return { context, registered };
}

function Wrapper({
  context,
  children,
}: {
  context: ShaderContextValue | null;
  children: ReactNode;
}) {
  return <ShaderContext.Provider value={context}>{children}</ShaderContext.Provider>;
}

const identityResample: Resample = (sampleBeneath) => sampleBeneath;

describe('useResample', () => {
  it('registers the resample on mount', () => {
    const { context, registered } = makeContext();

    function Probe() {
      useResample(identityResample, []);

      return null;
    }

    render(
      <Wrapper context={context}>
        <Probe />
      </Wrapper>,
    );
    expect(registered).toEqual([identityResample]);
    cleanup();
  });

  it('calls the cleanup returned by registerResample on unmount', () => {
    const cleanupFn = vi.fn();
    const context = {
      ...makeContext().context,
      registerResample: () => cleanupFn,
    };

    function Probe() {
      useResample(identityResample, []);

      return null;
    }

    const { unmount } = render(
      <Wrapper context={context}>
        <Probe />
      </Wrapper>,
    );

    unmount();
    expect(cleanupFn).toHaveBeenCalledTimes(1);
  });

  it('re-registers when a value in deps changes', () => {
    const { context, registered } = makeContext();

    function Probe({ mode }: { mode: 'a' | 'b' }) {
      useResample(identityResample, [mode]);

      return null;
    }

    const { rerender } = render(
      <Wrapper context={context}>
        <Probe mode="a" />
      </Wrapper>,
    );

    expect(registered).toHaveLength(1);
    rerender(
      <Wrapper context={context}>
        <Probe mode="b" />
      </Wrapper>,
    );
    expect(registered).toHaveLength(2);
    cleanup();
  });

  it('is a no-op when called outside a ShaderScene provider', () => {
    function Probe() {
      useResample(identityResample, []);

      return null;
    }

    expect(() => render(<Probe />)).not.toThrow();
    cleanup();
  });
});

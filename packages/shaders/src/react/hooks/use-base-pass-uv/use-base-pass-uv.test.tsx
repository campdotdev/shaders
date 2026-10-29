import type { ReactNode } from 'react';

import { cleanup, render } from '@testing-library/react';
import { vec2, vec4 } from 'three/tsl';
import { describe, expect, it, vi } from 'vitest';

import {
  type Resample,
  type Sampler,
  ShaderContext,
  type ShaderContextValue,
  type UvTransform,
} from '../../context/shader-context.js';
import { useBasePassUv } from './use-base-pass-uv.js';

function makeCtx(): {
  ctx: ShaderContextValue;
  registered: Resample[];
} {
  const registered: Resample[] = [];
  const ctx = {
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

  return { ctx, registered };
}

function Wrapper({ ctx, children }: { ctx: ShaderContextValue | null; children: ReactNode }) {
  return <ShaderContext.Provider value={ctx}>{children}</ShaderContext.Provider>;
}

const identityTransform: UvTransform = (uvInput) => uvInput;

describe('useBasePassUv', () => {
  // A UV warp is the resample that samples the image beneath it once, at
  // the moved coordinate.
  it('registers a resample that samples beneath once, at the warped coordinate', () => {
    const { ctx, registered } = makeCtx();
    const screenCoordinate = vec2(0.5, 0.5);
    const warpedCoordinate = vec2(0.25, 0.75);
    const sample = vec4(0.1, 0.2, 0.3, 1);
    const warp = vi.fn<UvTransform>(() => warpedCoordinate);
    const sampleBeneath = vi.fn<Sampler>(() => sample);

    function Probe() {
      useBasePassUv(warp, []);

      return null;
    }

    render(
      <Wrapper ctx={ctx}>
        <Probe />
      </Wrapper>,
    );
    expect(registered).toHaveLength(1);

    const sampled = registered[0]?.(sampleBeneath)(screenCoordinate);

    expect(warp.mock.calls.map(([coordinate]) => coordinate)).toEqual([screenCoordinate]);
    expect(sampleBeneath.mock.calls.map(([coordinate]) => coordinate)).toEqual([warpedCoordinate]);
    expect(sampled).toBe(sample);
    cleanup();
  });

  it('calls the cleanup returned by registerResample on unmount', () => {
    const cleanupFn = vi.fn();
    const ctx = {
      ...makeCtx().ctx,
      registerResample: () => cleanupFn,
    };

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

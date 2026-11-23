import { type ReactNode, StrictMode } from 'react';

import { render } from '@testing-library/react';
import { uv, vec4 } from 'three/tsl';
import type { WebGPURenderer } from 'three/webgpu';
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';

import { Bloom, type BloomProps } from '../../index.js';
import {
  type PostProcessTransform,
  type Resample,
  type Sampler,
  ShaderContext,
  type ShaderContextValue,
} from '../../react/context/shader-context.js';
import type { AnimatableProp } from '../../react/hooks/animatable-signal/animatable-signal.js';
import { createSignal } from '../../react/internal/create-signal.js';
import type { SchedulerClient } from '../../runtime/frame-scheduler/frame-scheduler.js';

// What the Effect asks of the scene, never what the bloom looks like. The
// look is the probe page. A fake context counts what Bloom registers on the
// output stage and how it votes.
beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', () => 0);
  vi.stubGlobal('cancelAnimationFrame', () => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function makeScene() {
  const clients: SchedulerClient[] = [];
  const resamples: Resample[] = [];
  const overlays: PostProcessTransform[] = [];
  const unregisters = { resample: 0, overlay: 0 };
  const renderer = {
    domElement: document.createElement('canvas'),
    getPixelRatio: () => 2,
  } as unknown as WebGPURenderer;
  const scheduler = {
    idle: true,
    add: (client: SchedulerClient) => clients.push(client),
    remove: (client: SchedulerClient) => {
      const index = clients.indexOf(client);

      if (index >= 0) clients.splice(index, 1);
    },
    requestRender: vi.fn(() => true),
    setIdle: vi.fn(() => () => undefined),
  };
  const shaderContext = {
    renderer: { three: renderer },
    scene: {},
    camera: {},
    scheduler,
    registerOverlay: (transform: PostProcessTransform) => {
      overlays.push(transform);

      return () => {
        unregisters.overlay += 1;
      };
    },
    registerResample: (resample: Resample) => {
      resamples.push(resample);

      return () => {
        unregisters.resample += 1;
      };
    },
  } as unknown as ShaderContextValue;

  function Wrapper({ children }: { children: ReactNode }) {
    return <ShaderContext.Provider value={shaderContext}>{children}</ShaderContext.Provider>;
  }

  return { Wrapper, scheduler, resamples, overlays, unregisters };
}

/** One resample and no color transform, not removed or registered again. */
function expectOneResample(scene: ReturnType<typeof makeScene>) {
  expect(scene.resamples).toHaveLength(1);
  expect(scene.overlays).toHaveLength(0);
  expect(scene.unregisters).toEqual({ resample: 0, overlay: 0 });
}

/** A hand-driven animation signal, the shape a MotionValue has. */
function makeSignal(initial: number) {
  let value = initial;
  const channel = createSignal<number>(() => value);

  return {
    signal: channel.signal,
    set(next: number) {
      value = next;
      for (const listener of channel.listeners) listener(next);
    },
  };
}

describe('Bloom', () => {
  // The public shape so far: one optional dial, a number or an animation
  // signal. pnpm typecheck runs this file too, so a missing export or a
  // narrowed prop fails there as well as here.
  it('takes an animatable threshold from the package root', () => {
    expectTypeOf<BloomProps>().toEqualTypeOf<{
      threshold?: AnimatableProp<number>;
    }>();
  });

  it('registers one resample and no color transform', () => {
    const scene = makeScene();

    render(<Bloom />, { wrapper: scene.Wrapper });

    expectOneResample(scene);
  });

  // Bloom reads the image beneath only through the sampler it is handed
  // (ADR 0010), at the coordinate it is asked for, so a UV warp above or
  // beneath it moves what Bloom shows.
  it('reads the image beneath once, at the coordinate it is given', () => {
    const scene = makeScene();

    render(<Bloom />, { wrapper: scene.Wrapper });

    const sampleBeneath = vi.fn<Sampler>(() => vec4(0.5, 0.5, 0.5, 1));
    const coordinate = uv();

    scene.resamples[0]!(sampleBeneath)(coordinate);

    expect(sampleBeneath).toHaveBeenCalledTimes(1);
    expect(sampleBeneath).toHaveBeenCalledWith(coordinate);
  });

  // The dial rides a uniform, so a new value rebuilds nothing on the output
  // stage (the uniform-stability gotcha in docs/agents/tsl.md).
  it('keeps its registration when threshold changes', () => {
    const scene = makeScene();
    const { rerender } = render(<Bloom threshold={0.2} />, { wrapper: scene.Wrapper });

    rerender(<Bloom threshold={0.9} />);

    expectOneResample(scene);
  });

  it('asks for a frame when a threshold signal moves', () => {
    const scene = makeScene();
    const threshold = makeSignal(0.2);

    render(<Bloom threshold={threshold.signal} />, { wrapper: scene.Wrapper });
    scene.scheduler.requestRender.mockClear();
    threshold.set(0.9);

    expect(scene.scheduler.requestRender).toHaveBeenCalled();
    expectOneResample(scene);
  });

  // Bloom has no clock, so a scene of still Sources under it parks.
  it('never votes the scene animated', () => {
    const scene = makeScene();

    render(<Bloom />, { wrapper: scene.Wrapper });

    expect(scene.scheduler.setIdle).not.toHaveBeenCalled();
  });

  it('registers once per mount under Strict Mode', () => {
    const scene = makeScene();

    render(
      <StrictMode>
        <Bloom />
      </StrictMode>,
      { wrapper: scene.Wrapper },
    );

    // Strict Mode mounts, unmounts, and mounts again: two registrations and
    // one removal leave exactly one live.
    expect(scene.resamples.length - scene.unregisters.resample).toBe(1);
  });
});

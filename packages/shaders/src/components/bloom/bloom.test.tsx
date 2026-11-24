import { type ReactNode, StrictMode } from 'react';

import { render } from '@testing-library/react';
import { uv, vec4 } from 'three/tsl';
import type { RenderTarget, WebGPURenderer } from 'three/webgpu';
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
import type { ResizeValue } from '../../react/hooks/use-resize/use-resize.js';
import { createSignal } from '../../react/internal/create-signal.js';
import type { SchedulerClient } from '../../runtime/frame-scheduler/frame-scheduler.js';

// What the Effect asks of the scene, never what the bloom looks like. The
// look is the probe page. A fake context counts what Bloom registers on the
// output stage and how it votes. A stub renderer stands in for three's: the
// chain's passes only bind their targets and draw a quad into each
// (./chain.test.ts covers the chain itself).
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
  let boundTarget: RenderTarget | null = null;
  const renderer = {
    domElement: document.createElement('canvas'),
    getPixelRatio: () => 2,
    render: vi.fn(),
    setRenderTarget: vi.fn((target: RenderTarget | null) => {
      boundTarget = target;
    }),
    getRenderTarget: vi.fn(() => boundTarget),
    backend: {},
  } as unknown as WebGPURenderer;
  // 800 by 400 CSS pixels at a pixel ratio of 2.
  const size: ResizeValue = [800, 400, 2];
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
    canvasSize: {
      get: () => size,
      on: () => () => undefined,
    },
  } as unknown as ShaderContextValue;

  function Wrapper({ children }: { children: ReactNode }) {
    return <ShaderContext.Provider value={shaderContext}>{children}</ShaderContext.Provider>;
  }

  return { Wrapper, renderer, scheduler, resamples, overlays, unregisters };
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
  // The public shape: three optional dials, each a number or an
  // animation signal. pnpm typecheck runs this file too, so a missing
  // export or a narrowed prop fails there as well as here.
  it('takes three animatable dials from the package root', () => {
    expectTypeOf<BloomProps>().toEqualTypeOf<{
      threshold?: AnimatableProp<number>;
      radius?: AnimatableProp<number>;
      strength?: AnimatableProp<number>;
    }>();
  });

  it('registers one resample and no color transform', () => {
    const scene = makeScene();

    render(<Bloom />, { wrapper: scene.Wrapper });

    expectOneResample(scene);
  });

  // Bloom reads the image beneath only through the sampler it is handed
  // (ADR 0010), so every resample beneath Bloom shapes the glow. The
  // chain's first level reads it four times per texel, once at each of the
  // four canvas pixels the texel covers. Building the resample makes those
  // four reads, and each use of the sampler it returns makes one more, for
  // the image the glow is added to.
  it('reads the image beneath through the sampler, four times, for the chain', () => {
    const scene = makeScene();

    render(<Bloom />, { wrapper: scene.Wrapper });

    const sampleBeneath = vi.fn<Sampler>(() => vec4(0.5, 0.5, 0.5, 1));

    const sampler = scene.resamples[0]!(sampleBeneath);

    expect(sampleBeneath).toHaveBeenCalledTimes(4);

    const coordinate = uv().add(0.1);

    sampler(coordinate);

    expect(sampleBeneath).toHaveBeenCalledTimes(5);
    // Compared by identity: printing a node graph on a mismatch is slow.
    expect(sampleBeneath.mock.lastCall?.[0] === coordinate).toBe(true);
  });

  // The glow is read at the coordinate Bloom is asked for, as the image
  // is, so a UV warp mounted above Bloom moves the glow with the image.
  it('reads the glow at the coordinate it is given', () => {
    const scene = makeScene();

    render(<Bloom />, { wrapper: scene.Wrapper });

    const coordinate = uv().add(0.1);
    const output = scene.resamples[0]!(() => vec4(0.5, 0.5, 0.5, 1))(coordinate);
    const reads: unknown[] = [];

    output.traverse((node) => {
      if ('passNode' in node && (node as unknown as { uvNode: unknown }).uvNode !== null)
        reads.push((node as unknown as { uvNode: unknown }).uvNode);
    });

    // The walk reaches the glow's read once for each place the output
    // uses it, so every read it finds has to carry the coordinate.
    expect(reads.length).toBeGreaterThan(0);
    expect(reads.every((read) => read === coordinate)).toBe(true);
  });

  // The dial rides a uniform, so a new value rebuilds nothing on the output
  // stage (the uniform-stability gotcha in docs/agents/tsl.md).
  it('keeps its registration when a dial changes', () => {
    const scene = makeScene();
    const { rerender } = render(<Bloom radius={0.1} threshold={0.2} />, {
      wrapper: scene.Wrapper,
    });

    rerender(<Bloom radius={0.9} threshold={0.9} />);

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

  // The chain draws from a node's updateBefore during the output quad's
  // draw, never from a pre-pass, which would run before the scene pass.
  it('draws nothing on its own', () => {
    const scene = makeScene();

    render(<Bloom />, { wrapper: scene.Wrapper });

    expect(scene.renderer.render).not.toHaveBeenCalled();
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

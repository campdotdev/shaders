import { type ReactNode, StrictMode } from 'react';

import { render } from '@testing-library/react';
import { uv, vec4 } from 'three/tsl';
import type { WebGPURenderer } from 'three/webgpu';
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';

import { HeatShimmer, type HeatShimmerProps, type HeatShimmerTuning } from '../../index.js';
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

// What the Effect asks of the scene, never what the shimmer looks like. The
// look is the demo page. A fake context counts what HeatShimmer registers on
// the output stage and how it votes.
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

/** One resample and no color transform, never removed or registered again. */
function expectOneResampleOnly(scene: ReturnType<typeof makeScene>) {
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

describe('HeatShimmer', () => {
  // The public shape in phase 1: two animatable dials, plus the temporary
  // tuning rig the defaults gate deletes. pnpm typecheck runs this file
  // too, so a missing export or a narrowed prop fails there as well.
  it('takes two animatable dials and the tuning rig from the package root', () => {
    expectTypeOf<HeatShimmerTuning>().toEqualTypeOf<{
      foldLimit?: number;
      stretch?: number;
    }>();
    expectTypeOf<HeatShimmerProps>().toEqualTypeOf<{
      strength?: AnimatableProp<number>;
      scale?: AnimatableProp<number>;
      tuning?: HeatShimmerTuning;
    }>();
  });

  // A UV warp and nothing else: it moves where the image beneath is
  // sampled, and adds no light or color of its own.
  it('registers one resample and no color transform, and removes it on unmount', () => {
    const scene = makeScene();
    const { unmount } = render(<HeatShimmer />, { wrapper: scene.Wrapper });

    expectOneResampleOnly(scene);

    unmount();
    expect(scene.unregisters).toEqual({ resample: 1, overlay: 0 });
  });

  // A UV warp samples the image beneath once, at the moved coordinate. A
  // second read would multiply the cost of every resample beneath it.
  it('samples the image beneath it once', () => {
    const scene = makeScene();
    let samples = 0;
    const sampleBeneath: Sampler = () => {
      samples += 1;

      return vec4(0, 0, 0, 1);
    };

    render(<HeatShimmer />, { wrapper: scene.Wrapper });
    scene.resamples[0]?.(sampleBeneath)(uv());

    expect(samples).toBe(1);
  });

  it('survives Strict Mode with one resample and no color transform', () => {
    const scene = makeScene();

    render(
      <StrictMode>
        <HeatShimmer />
      </StrictMode>,
      { wrapper: scene.Wrapper },
    );

    expect(scene.resamples.length - scene.unregisters.resample).toBe(1);
    expect(scene.overlays).toHaveLength(0);
  });

  // Every dial rides a stable uniform, so a new value is a uniform write
  // and a repaint, never a recompile of the output chain.
  it('changes its dials without registering again', () => {
    const scene = makeScene();
    const { rerender } = render(<HeatShimmer scale={12} strength={0.5} />, {
      wrapper: scene.Wrapper,
    });

    scene.scheduler.requestRender.mockClear();
    rerender(<HeatShimmer scale={4} strength={1} />);

    expectOneResampleOnly(scene);
    expect(scene.scheduler.requestRender).toHaveBeenCalled();
  });

  it('follows its dial signals without registering again', () => {
    const scene = makeScene();
    const strength = makeSignal(0.5);
    const scale = makeSignal(12);

    render(<HeatShimmer scale={scale.signal} strength={strength.signal} />, {
      wrapper: scene.Wrapper,
    });
    scene.scheduler.requestRender.mockClear();

    strength.set(1);
    expect(scene.scheduler.requestRender).toHaveBeenCalledTimes(1);
    scale.set(4);
    expect(scene.scheduler.requestRender).toHaveBeenCalledTimes(2);

    expectOneResampleOnly(scene);
  });

  // The tuning sliders ride uniforms too, so the author can drag them on
  // the docs page without a stutter.
  it('changes its tuning without registering again', () => {
    const scene = makeScene();
    const { rerender } = render(<HeatShimmer tuning={{ foldLimit: 0.25, stretch: 1.5 }} />, {
      wrapper: scene.Wrapper,
    });

    scene.scheduler.requestRender.mockClear();
    rerender(<HeatShimmer tuning={{ foldLimit: 0.6, stretch: 1 }} />);

    expectOneResampleOnly(scene);
    expect(scene.scheduler.requestRender).toHaveBeenCalled();
  });

  // Phase 1 has no clock, so the shimmer is still, and every dial repaints
  // through its uniform when it moves. A scene of still Sources under it
  // can park.
  it('votes idle and never animated', () => {
    const scene = makeScene();

    render(<HeatShimmer />, { wrapper: scene.Wrapper });

    expect(scene.scheduler.setIdle).toHaveBeenCalledWith(true);
    expect(scene.scheduler.setIdle).not.toHaveBeenCalledWith(false);
  });

  // Mode 1 only: outside a scene there is no output stage to warp, so the
  // shimmer follows its signals without a scheduler to wake.
  it('does nothing outside a ShaderScene', () => {
    const strength = makeSignal(0.5);

    render(<HeatShimmer strength={strength.signal} />);

    expect(() => strength.set(1)).not.toThrow();
  });
});

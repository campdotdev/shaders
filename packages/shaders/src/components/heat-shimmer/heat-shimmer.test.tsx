import { type ReactNode, StrictMode } from 'react';

import { render } from '@testing-library/react';
import { uv, vec4 } from 'three/tsl';
import {
  LinearFilter,
  type RenderTarget,
  RGBAFormat,
  UnsignedByteType,
  type WebGPURenderer,
} from 'three/webgpu';
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';

import type { PrePass } from '../../engine.js';
import { HeatShimmer, type HeatShimmerProps, type HeatShimmerTuning } from '../../index.js';
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

// What the Effect asks of the scene, never what the shimmer looks like. The
// look is the demo page. A fake context counts what HeatShimmer registers on
// the output stage and how it votes. A stub renderer stands in for three's,
// the way the Aurora tests do: the shift texture's pass only binds its
// target and draws a quad into it.
beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', () => 0);
  vi.stubGlobal('cancelAnimationFrame', () => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/**
 * A WebGPU renderer at pixel ratio 2, on a device that allows textures 8192
 * texels a side, that remembers which target is bound.
 */
function makeRenderer() {
  let boundTarget: RenderTarget | null = null;

  return {
    domElement: document.createElement('canvas'),
    getPixelRatio: () => 2,
    render: vi.fn(),
    setRenderTarget: vi.fn((target: RenderTarget | null) => {
      boundTarget = target;
    }),
    getRenderTarget: vi.fn(() => boundTarget),
    backend: { device: { limits: { maxTextureDimension2D: 8192 } } },
  } as unknown as WebGPURenderer;
}

/**
 * A scene context whose canvas starts at 800 by 400 CSS pixels and can be
 * resized by hand. It records every resample, color transform, and pre-pass
 * HeatShimmer registers, and every one it removes.
 */
function makeScene() {
  const clients: SchedulerClient[] = [];
  const resamples: Resample[] = [];
  const overlays: PostProcessTransform[] = [];
  const prePasses: PrePass[] = [];
  const removedPrePasses: PrePass[] = [];
  const unregisters = { resample: 0, overlay: 0 };
  const sizeListeners = new Set<(value: ResizeValue) => void>();
  let size: ResizeValue = [800, 400, 2];
  const renderer = makeRenderer();
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
    registerPrePass: (prePass: PrePass) => {
      prePasses.push(prePass);

      return () => {
        removedPrePasses.push(prePass);
      };
    },
    canvasSize: {
      get: () => size,
      on: (_event: 'change', listener: (value: ResizeValue) => void) => {
        sizeListeners.add(listener);

        return () => {
          sizeListeners.delete(listener);
        };
      },
    },
  } as unknown as ShaderContextValue;

  function Wrapper({ children }: { children: ReactNode }) {
    return <ShaderContext.Provider value={shaderContext}>{children}</ShaderContext.Provider>;
  }

  const resizeCanvas = (next: ResizeValue) => {
    size = next;
    for (const listener of sizeListeners) listener(next);
  };

  /** The pre-passes still registered: added and not yet removed. */
  const livePrePasses = () => prePasses.filter((prePass) => !removedPrePasses.includes(prePass));

  return {
    Wrapper,
    renderer,
    scheduler,
    resamples,
    overlays,
    prePasses,
    unregisters,
    resizeCanvas,
    livePrePasses,
  };
}

/** Run a pre-pass and return the texture it drew into. */
function drawPrePass(renderer: WebGPURenderer, prePass: PrePass) {
  vi.mocked(renderer.setRenderTarget).mockClear();
  prePass();
  const [target] = vi.mocked(renderer.setRenderTarget).mock.calls[0] ?? [];

  if (!target) throw new Error('expected the pre-pass to bind a render target');

  return target.texture;
}

/** The one live pre-pass, which the test fails without. */
function onlyPrePass(scene: ReturnType<typeof makeScene>) {
  const live = scene.livePrePasses();

  expect(live).toHaveLength(1);

  return live[0]!;
}

/**
 * One resample, no color transform, and one pre-pass, none of them removed
 * or registered again.
 */
function expectStableRegistrations(scene: ReturnType<typeof makeScene>) {
  expect(scene.resamples).toHaveLength(1);
  expect(scene.overlays).toHaveLength(0);
  expect(scene.unregisters).toEqual({ resample: 0, overlay: 0 });
  expect(scene.prePasses).toHaveLength(1);
  expect(scene.livePrePasses()).toHaveLength(1);
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

    expectStableRegistrations(scene);

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

    expectStableRegistrations(scene);
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

    expectStableRegistrations(scene);
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

    expectStableRegistrations(scene);
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

// The two noise reads run once per texel of a small texture, drawn before
// the scene each frame, and each pixel reads one texel.
describe('HeatShimmer shift texture', () => {
  // Strict Mode mounts, unmounts, and mounts again, so a leaked
  // registration from the first mount would draw a second texture each frame.
  it('draws the shift in one pre-pass, into an 8-bit four-channel texture it filters', () => {
    const scene = makeScene();
    const { unmount } = render(
      <StrictMode>
        <HeatShimmer />
      </StrictMode>,
      { wrapper: scene.Wrapper },
    );
    const shift = drawPrePass(scene.renderer, onlyPrePass(scene));

    expect(shift.type).toBe(UnsignedByteType);
    expect(shift.format).toBe(RGBAFormat);
    expect(shift.magFilter).toBe(LinearFilter);

    unmount();
    expect(scene.livePrePasses()).toHaveLength(0);
  });

  // One texel covers 4 by 4 device pixels: the canvas's CSS size times the
  // renderer's pixel ratio, over 4 on each side.
  it('sizes the texture to a quarter of the canvas in device pixels on each side', () => {
    const scene = makeScene();

    render(<HeatShimmer />, { wrapper: scene.Wrapper });
    const shift = drawPrePass(scene.renderer, onlyPrePass(scene));

    expect([shift.image.width, shift.image.height]).toEqual([400, 200]);
  });

  // The texture keeps its object through a resize, so the warp stays bound
  // to it. A parked scene would otherwise keep the old frame (the
  // bare-uniform-write gotcha in docs/agents/tsl.md).
  it('follows a resize without registering again, and asks for a frame', () => {
    const scene = makeScene();

    render(<HeatShimmer />, { wrapper: scene.Wrapper });
    const prePass = onlyPrePass(scene);
    const before = drawPrePass(scene.renderer, prePass);

    scene.scheduler.requestRender.mockClear();
    scene.resizeCanvas([1700, 801, 2]);
    const after = drawPrePass(scene.renderer, prePass);

    expect(after).toBe(before);
    expect([after.image.width, after.image.height]).toEqual([850, 401]);
    expect(scene.scheduler.requestRender).toHaveBeenCalled();
    expectStableRegistrations(scene);
  });

  // A collapsed canvas reports a size of 0, and a texture needs at least one
  // texel a side.
  it('keeps at least one texel a side on a collapsed canvas', () => {
    const scene = makeScene();

    render(<HeatShimmer />, { wrapper: scene.Wrapper });
    scene.resizeCanvas([0, 0, 2]);
    const shift = drawPrePass(scene.renderer, onlyPrePass(scene));

    expect([shift.image.width, shift.image.height]).toEqual([1, 1]);
  });
});

import { type ReactNode, StrictMode } from 'react';

import { render } from '@testing-library/react';
import { type RenderTarget, Scene, type Texture, type WebGPURenderer } from 'three/webgpu';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { PrePass, SchedulerTick } from '../../engine.js';
import { ShaderContext, type ShaderContextValue } from '../../react/context/shader-context.js';
import { LiquidGradient } from './liquid-gradient.js';

// When LiquidGradient's pre-passes draw, never what the liquid looks like.
// The look is the demo page and apps/docs-tests/visual/liquid-gradient.spec.ts,
// which can't tell a texture drawn once from one drawn every frame. A stub
// renderer stands in for three's, as in aurora.test.tsx.
beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', () => 0);
  vi.stubGlobal('cancelAnimationFrame', () => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

interface StubOptions {
  /** WebGL2: whether EXT_color_buffer_float lets the renderer draw into float targets. */
  floatTargets?: boolean;
}

/** A WebGL2 renderer on a device that allows textures 4096 texels a side. */
function makeRenderer({ floatTargets = true }: StubOptions = {}) {
  let boundTarget: RenderTarget | null = null;

  return {
    render: vi.fn(),
    setRenderTarget: vi.fn((target: RenderTarget | null) => {
      boundTarget = target;
    }),
    getRenderTarget: vi.fn(() => boundTarget),
    getPixelRatio: () => 2,
    getDrawingBufferSize: (target: { set: (x: number, y: number) => unknown }) =>
      target.set(1600, 800),
    backend: {
      isWebGLBackend: true,
      extensions: { has: (name: string) => floatTargets && name === 'EXT_color_buffer_float' },
      gl: { MAX_TEXTURE_SIZE: 0x0d33, getParameter: () => 4096 },
    },
  } as unknown as WebGPURenderer;
}

/**
 * A scene context whose registerPrePass records what LiquidGradient draws
 * before the scene, and whose scheduler ticks only when a test says so.
 */
function makeScene(renderer: WebGPURenderer) {
  const scene = new Scene();
  const prePasses: PrePass[] = [];
  const removedPrePasses: PrePass[] = [];
  const clients = new Set<(tick: SchedulerTick) => void>();
  const scheduler = {
    idle: true,
    add: vi.fn((client: (tick: SchedulerTick) => void) => {
      clients.add(client);
    }),
    remove: vi.fn((client: (tick: SchedulerTick) => void) => {
      clients.delete(client);
    }),
    requestRender: vi.fn(() => true),
    setIdle: vi.fn(() => () => undefined),
    onPhaseReset: vi.fn(() => () => undefined),
  };
  const shaderContext = {
    renderer: { three: renderer },
    scene,
    camera: {},
    scheduler,
    registerOverlay: () => () => undefined,
    registerResample: () => () => undefined,
    registerPrePass: (prePass: PrePass) => {
      prePasses.push(prePass);

      return () => {
        removedPrePasses.push(prePass);
      };
    },
    canvasSize: {
      get: () => [800, 400, 2],
      on: () => () => undefined,
    },
    timeGpu: () => () => undefined,
  } as unknown as ShaderContextValue;

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <StrictMode>
        <ShaderContext.Provider value={shaderContext}>{children}</ShaderContext.Provider>
      </StrictMode>
    );
  }

  /** Advance every scheduler client by one frame of `delta` seconds. */
  const tick = (delta: number) => {
    for (const client of clients) client({ delta, elapsed: delta } as SchedulerTick);
  };

  /** The pre-passes still registered: added and not yet removed. */
  const livePrePasses = () => prePasses.filter((prePass) => !removedPrePasses.includes(prePass));

  return { Wrapper, scene, tick, livePrePasses };
}

/** Run a pre-pass and return the textures it drew into, none if it skipped. */
function drawPrePass(renderer: WebGPURenderer, prePass: PrePass): Texture[] {
  vi.mocked(renderer.setRenderTarget).mockClear();
  prePass();

  // A draw binds its target, then puts back the one bound before, which is
  // none here.
  return vi
    .mocked(renderer.setRenderTarget)
    .mock.calls.flatMap(([target]) => (target ? [target.texture] : []));
}

// Each pass draws into a texture of its own size, which names it.
const PASS_BY_SIZE: Record<string, string> = {
  '257x257': 'flow',
  '1025x1025': 'paint',
  '1024x1': 'ramp',
  '1x1': 'average',
};

/**
 * Run every live pre-pass once, as the first frame does, and name each by
 * the texture it drew.
 */
function drawFirstFrame(renderer: WebGPURenderer, live: PrePass[]) {
  const passes: Record<string, PrePass> = {};

  for (const prePass of live) {
    const [drawn] = drawPrePass(renderer, prePass);

    if (!drawn) throw new Error('expected every pre-pass to draw on the first frame');
    const name = PASS_BY_SIZE[`${drawn.image.width}x${drawn.image.height}`];

    if (!name) throw new Error('expected a texture the size of a known pass');
    passes[name] = prePass;
  }

  return passes;
}

/** How many times each named pre-pass draws on one frame. */
function drawCounts(renderer: WebGPURenderer, passes: Record<string, PrePass>) {
  return Object.fromEntries(
    Object.entries(passes).map(([name, prePass]) => [name, drawPrePass(renderer, prePass).length]),
  );
}

describe('LiquidGradient with half-float targets', () => {
  // Strict Mode mounts, unmounts, and mounts again, so a leaked
  // registration from the first mount would draw every texture twice.
  it('registers one pre-pass each for the flow, the paint, the ramp, and the average', () => {
    const renderer = makeRenderer();
    const scene = makeScene(renderer);
    const { unmount } = render(<LiquidGradient />, { wrapper: scene.Wrapper });
    const live = scene.livePrePasses();

    expect(live).toHaveLength(4);
    expect(Object.keys(drawFirstFrame(renderer, live)).sort()).toEqual([
      'average',
      'flow',
      'paint',
      'ramp',
    ]);
    expect(scene.scene.children).toHaveLength(1);

    unmount();
    expect(scene.livePrePasses()).toHaveLength(0);
    expect(scene.scene.children).toHaveLength(0);
  });

  // Other layers can keep the scene drawing while the liquid holds still,
  // and each skipped draw saves a render pass.
  it('skips every draw while nothing a texture depends on has changed', () => {
    const renderer = makeRenderer();
    const scene = makeScene(renderer);

    render(<LiquidGradient speed={0} />, { wrapper: scene.Wrapper });
    const passes = drawFirstFrame(renderer, scene.livePrePasses());

    expect(drawCounts(renderer, passes)).toEqual({ flow: 0, paint: 0, ramp: 0, average: 0 });
  });

  it('redraws the flow and the paint once when the seed changes', () => {
    const renderer = makeRenderer();
    const scene = makeScene(renderer);
    const { rerender } = render(<LiquidGradient speed={0} />, { wrapper: scene.Wrapper });
    const passes = drawFirstFrame(renderer, scene.livePrePasses());

    rerender(<LiquidGradient seed={3} speed={0} />);

    expect(drawCounts(renderer, passes)).toEqual({ flow: 1, paint: 1, ramp: 0, average: 0 });
    expect(drawCounts(renderer, passes)).toEqual({ flow: 0, paint: 0, ramp: 0, average: 0 });
  });

  it('redraws only the average once when softness changes', () => {
    const renderer = makeRenderer();
    const scene = makeScene(renderer);
    const { rerender } = render(<LiquidGradient speed={0} />, { wrapper: scene.Wrapper });
    const passes = drawFirstFrame(renderer, scene.livePrePasses());

    rerender(<LiquidGradient softness={0.5} speed={0} />);

    expect(drawCounts(renderer, passes)).toEqual({ flow: 0, paint: 0, ramp: 0, average: 1 });
    expect(drawCounts(renderer, passes)).toEqual({ flow: 0, paint: 0, ramp: 0, average: 0 });
  });

  it('redraws only the flow on each frame the flow moves', () => {
    const renderer = makeRenderer();
    const scene = makeScene(renderer);

    render(<LiquidGradient speed={0.15} />, { wrapper: scene.Wrapper });
    const passes = drawFirstFrame(renderer, scene.livePrePasses());

    scene.tick(1 / 60);
    expect(drawCounts(renderer, passes)).toEqual({ flow: 1, paint: 0, ramp: 0, average: 0 });

    scene.tick(1 / 60);
    expect(drawCounts(renderer, passes)).toEqual({ flow: 1, paint: 0, ramp: 0, average: 0 });
  });
});

// Without half-float targets every read works its value out inline, so
// LiquidGradient still draws, only slower.
describe('LiquidGradient without half-float targets', () => {
  it('registers no pre-pass and still draws its mesh', () => {
    const renderer = makeRenderer({ floatTargets: false });
    const scene = makeScene(renderer);

    render(<LiquidGradient />, { wrapper: scene.Wrapper });

    expect(scene.livePrePasses()).toHaveLength(0);
    expect(scene.scene.children).toHaveLength(1);
  });
});

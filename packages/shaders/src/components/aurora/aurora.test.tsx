import { type ReactNode, StrictMode } from 'react';

import { render } from '@testing-library/react';
import {
  HalfFloatType,
  RedFormat,
  type RenderTarget,
  Scene,
  type WebGPURenderer,
} from 'three/webgpu';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { PrePass } from '../../engine.js';
import { ShaderContext, type ShaderContextValue } from '../../react/context/shader-context.js';
import type { ResizeValue } from '../../react/hooks/use-resize/use-resize.js';
import { Aurora } from './aurora.js';

// What Aurora asks of the scene for its field pass, never what the curtains
// look like. The look is the demo page and apps/docs-tests/visual/aurora.spec.ts.
// A stub renderer stands in for three's, the way the cursor-ripple tests do:
// the texture passes only bind targets and draw a quad into them, and read
// the backend to learn which float targets the renderer can draw into.
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

/**
 * A WebGL2 renderer at pixel ratio 2. Its drawing buffer stays at its first
 * size: a browser zoom tells the scene's size signal before the renderer has
 * resized, so a listener that reads the drawing buffer then reads a stale one.
 */
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
    },
  } as unknown as WebGPURenderer;
}

/**
 * A scene context whose canvas starts at 800 by 400 CSS pixels and can be
 * resized by hand, and whose registerPrePass records what Aurora draws
 * before the scene.
 */
function makeScene(renderer: WebGPURenderer) {
  const scene = new Scene();
  const prePasses: PrePass[] = [];
  const removedPrePasses: PrePass[] = [];
  const sizeListeners = new Set<(value: ResizeValue) => void>();
  let size: ResizeValue = [800, 400, 2];
  const scheduler = {
    idle: true,
    add: vi.fn(),
    remove: vi.fn(),
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
    registerBaseUvTransform: () => () => undefined,
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
    timeGpu: () => () => undefined,
  } as unknown as ShaderContextValue;

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <StrictMode>
        <ShaderContext.Provider value={shaderContext}>{children}</ShaderContext.Provider>
      </StrictMode>
    );
  }

  const resizeCanvas = (next: ResizeValue) => {
    size = next;
    for (const listener of sizeListeners) listener(next);
  };

  /** The pre-passes still registered: added and not yet removed. */
  const livePrePasses = () => prePasses.filter((prePass) => !removedPrePasses.includes(prePass));

  return { Wrapper, scene, scheduler, livePrePasses, resizeCanvas };
}

/** Run a pre-pass and return the texture it drew into. */
function drawPrePass(renderer: WebGPURenderer, prePass: PrePass) {
  vi.mocked(renderer.setRenderTarget).mockClear();
  prePass();
  const [target] = vi.mocked(renderer.setRenderTarget).mock.calls[0] ?? [];

  if (!target) throw new Error('expected the pre-pass to bind a render target');

  return target.texture;
}

const texelCount = (texture: { image: { width: number; height: number } }) =>
  texture.image.width * texture.image.height;

describe('Aurora with a field pass', () => {
  // Strict Mode mounts, unmounts, and mounts again, so a leaked
  // registration from the first mount would draw a second field each frame.
  it('draws its field in one pre-pass, into a one-channel half-float texture', () => {
    const renderer = makeRenderer();
    const scene = makeScene(renderer);
    const { unmount } = render(<Aurora />, { wrapper: scene.Wrapper });
    const live = scene.livePrePasses();

    expect(live).toHaveLength(1);
    const field = drawPrePass(renderer, live[0]!);

    expect(field.type).toBe(HalfFloatType);
    expect(field.format).toBe(RedFormat);
    expect(scene.scene.children).toHaveLength(1);

    unmount();
    expect(scene.livePrePasses()).toHaveLength(0);
    expect(scene.scene.children).toHaveLength(0);
  });

  // The canvas's CSS size and the renderer's pixel ratio give the drawing
  // buffer the scene is about to have. The drawing buffer itself lags on a
  // zoom, and a texture sized from it would keep the old density.
  it('sizes the field texture from the canvas size and the pixel ratio on every resize', () => {
    const renderer = makeRenderer();
    const scene = makeScene(renderer);

    render(<Aurora />, { wrapper: scene.Wrapper });
    const [prePass] = scene.livePrePasses();
    const before = texelCount(drawPrePass(renderer, prePass!));

    scene.resizeCanvas([1600, 800, 2]);
    const after = texelCount(drawPrePass(renderer, prePass!));

    expect(after / before).toBeCloseTo(4, 1);
  });

  // A resize while the scene is parked would otherwise leave the old field
  // on screen (the bare-uniform-write gotcha in docs/agents/tsl.md).
  it('asks for a frame after it refits the field', () => {
    const renderer = makeRenderer();
    const scene = makeScene(renderer);

    render(<Aurora />, { wrapper: scene.Wrapper });
    scene.scheduler.requestRender.mockClear();
    scene.resizeCanvas([1200, 400, 2]);

    expect(scene.scheduler.requestRender).toHaveBeenCalled();
  });
});

// Aurora draws its own image, so unlike CursorRipple it never goes quiet
// without float targets: the march works out the field at every step.
describe('Aurora without half-float targets', () => {
  it('registers no pre-pass and still draws its mesh', () => {
    const renderer = makeRenderer({ floatTargets: false });
    const scene = makeScene(renderer);

    render(<Aurora />, { wrapper: scene.Wrapper });

    expect(scene.livePrePasses()).toHaveLength(0);
    expect(scene.scene.children).toHaveLength(1);
  });
});

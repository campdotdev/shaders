import { type ReactNode, StrictMode } from 'react';

import { act, render } from '@testing-library/react';
import type { RenderTarget, WebGPURenderer } from 'three/webgpu';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createWaveField, CursorInput, setReducedMotionPolicy } from '../../engine.js';
import {
  type PostProcessTransform,
  ShaderContext,
  type ShaderContextValue,
  type UvTransform,
} from '../../react/context/shader-context.js';
import type { SchedulerClient } from '../../runtime/frame-scheduler/frame-scheduler.js';
import { CursorRipple } from './cursor-ripple.js';
import { CursorRippleShader } from './shader.js';

// What the Effect asks of the scene, never what the water looks like. The
// look is the demo page and the probe route's visual spec. A stub renderer
// stands in for three's, the way the wave-field tests do: the field only
// binds targets and draws a quad into them, and reads the backend to learn
// whether half-float targets can be rendered to.
beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', () => 0);
  vi.stubGlobal('cancelAnimationFrame', () => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  setReducedMotionPolicy('auto');
});

interface StubOptions {
  floatTargets?: boolean;
}

function makeRenderer({ floatTargets = true }: StubOptions = {}) {
  let boundTarget: RenderTarget | null = null;
  const canvas = document.createElement('canvas');

  // A 1000 by 1000 canvas at the viewport origin, so a move to (100, 100)
  // lands inside it and presence eases toward 1. happy-dom's own rect is
  // zero-sized, which would read every move as outside the canvas.
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 1000 }) as DOMRect;

  return {
    domElement: canvas,
    getSize: (target: { set: (x: number, y: number) => unknown }) => target.set(1280, 720),
    render: vi.fn(),
    setRenderTarget: vi.fn((target: RenderTarget | null) => {
      boundTarget = target;
    }),
    getRenderTarget: vi.fn(() => boundTarget),
    getPixelRatio: () => 1,
    backend: {
      isWebGLBackend: true,
      extensions: { has: (name: string) => floatTargets && name === 'EXT_color_buffer_float' },
    },
  } as unknown as WebGPURenderer;
}

// A scene whose scheduler hands its clients back, so a test can tick the
// Effect's drive by hand, and whose register functions count what the
// Effect puts on the output stage.
function makeScene(renderer: WebGPURenderer) {
  const clients: SchedulerClient[] = [];
  const uvTransforms: UvTransform[] = [];
  const overlays: PostProcessTransform[] = [];
  const unregisters = { uv: 0, overlay: 0 };
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
  let sharedInput: CursorInput | null = null;
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
    registerBaseUvTransform: (transform: UvTransform) => {
      uvTransforms.push(transform);

      return () => {
        unregisters.uv += 1;
      };
    },
    getCursorInput: () => {
      sharedInput ??= new CursorInput({ element: renderer.domElement });

      return sharedInput;
    },
  } as unknown as ShaderContextValue;

  function Wrapper({ children }: { children: ReactNode }) {
    return <ShaderContext.Provider value={shaderContext}>{children}</ShaderContext.Provider>;
  }

  const tick = (delta = 1 / 60) => {
    for (const client of [...clients]) client({ delta, elapsed: 0, now: 0 });
  };

  return { Wrapper, scheduler, uvTransforms, overlays, unregisters, tick };
}

const fireMoveOnWindow = (clientX: number, clientY: number) => {
  window.dispatchEvent(new PointerEvent('pointermove', { clientX, clientY, bubbles: true }));
};

describe('CursorRipple with a live field', () => {
  it('requests a redraw as soon as a resize replaces the field texture', () => {
    const renderer = makeRenderer();
    const scene = makeScene(renderer);
    const field = createWaveField(renderer, 1280, 720);
    const { unmount } = render(<CursorRippleShader field={field} refraction={0.1} shine={0.4} />, {
      wrapper: scene.Wrapper,
    });

    scene.scheduler.requestRender.mockClear();
    field.resize(640, 360);

    // No scheduler tick has run: the resize notification itself must wake
    // the parked scene rather than relying on the post-draw follower.
    expect(scene.scheduler.requestRender).toHaveBeenCalledTimes(1);
    unmount();
    field.dispose();
  });

  it('registers one base-pass warp and one overlay, and unregisters both on unmount', () => {
    const scene = makeScene(makeRenderer());
    const { unmount } = render(<CursorRipple />, { wrapper: scene.Wrapper });

    expect(scene.uvTransforms).toHaveLength(1);
    expect(scene.overlays).toHaveLength(1);

    unmount();
    expect(scene.unregisters).toEqual({ uv: 1, overlay: 1 });
  });

  it('votes the scene static', () => {
    const scene = makeScene(makeRenderer());

    render(<CursorRipple />, { wrapper: scene.Wrapper });

    expect(scene.scheduler.setIdle).toHaveBeenCalledWith(true);
  });

  // Two instances each own a field: two warps, two overlays, and a drag
  // draws into both.
  it('gives each of two instances its own field', () => {
    const renderer = makeRenderer();
    const scene = makeScene(renderer);

    render(
      <>
        <CursorRipple />
        <CursorRipple />
      </>,
      { wrapper: scene.Wrapper },
    );

    expect(scene.uvTransforms).toHaveLength(2);
    expect(scene.overlays).toHaveLength(2);

    fireMoveOnWindow(100, 100);
    scene.tick();
    fireMoveOnWindow(300, 100);
    scene.tick();

    // Each field stamps once and runs two substeps for a 60Hz frame.
    expect(renderer.render).toHaveBeenCalledTimes(2 * 3);
  });

  it('survives Strict Mode without a second warp or overlay', () => {
    const scene = makeScene(makeRenderer());

    render(
      <StrictMode>
        <CursorRipple />
      </StrictMode>,
      { wrapper: scene.Wrapper },
    );

    expect(scene.uvTransforms.length - scene.unregisters.uv).toBe(1);
    expect(scene.overlays.length - scene.unregisters.overlay).toBe(1);
  });

  // The field steps inside the scene's tick, and asks for another frame
  // while it holds energy, so the scene keeps drawing until the water
  // settles and then parks.
  it('keeps stepping and requesting frames after the pointer stops, until the water rests', () => {
    const renderer = makeRenderer();
    const scene = makeScene(renderer);

    render(<CursorRipple />, { wrapper: scene.Wrapper });
    fireMoveOnWindow(100, 100);
    scene.tick();
    fireMoveOnWindow(300, 100);
    scene.tick();
    const drawsAfterDrag = vi.mocked(renderer.render).mock.calls.length;

    expect(drawsAfterDrag).toBeGreaterThan(0);
    scene.scheduler.requestRender.mockClear();

    // A still tick: the pointer is where it was, so only the field's own
    // substeps draw, and the drive asks for the next frame.
    scene.tick();
    expect(vi.mocked(renderer.render).mock.calls.length).toBeGreaterThan(drawsAfterDrag);
    expect(scene.scheduler.requestRender).toHaveBeenCalled();
  });

  // Decay damps height and velocity alike, so at the default the water is
  // at rest within a second of the drag and the scene may park. Damping
  // height alone once kept it drawing for about five seconds after the
  // ripple had visibly gone.
  it('stops requesting frames within a second of the drag at the default decay', () => {
    const scene = makeScene(makeRenderer());

    render(<CursorRipple />, { wrapper: scene.Wrapper });
    fireMoveOnWindow(100, 100);
    scene.tick();
    fireMoveOnWindow(300, 100);
    scene.tick();
    // Awake after the stroke, so the check below is not passing vacuously.
    expect(scene.scheduler.requestRender).toHaveBeenCalled();
    for (let frame = 0; frame < 60; frame += 1) scene.tick();
    scene.scheduler.requestRender.mockClear();

    scene.tick();
    expect(scene.scheduler.requestRender).not.toHaveBeenCalled();
  });

  // Under "paused" the shared factor is 0: the field neither steps nor
  // takes the stroke, so a drag draws nothing and the Effect is identity.
  it('draws nothing under the paused reduced-motion policy', () => {
    setReducedMotionPolicy('paused');
    const renderer = makeRenderer();
    const scene = makeScene(renderer);

    render(<CursorRipple />, { wrapper: scene.Wrapper });
    fireMoveOnWindow(100, 100);
    scene.tick();
    fireMoveOnWindow(300, 100);
    scene.tick();

    expect(renderer.render).not.toHaveBeenCalled();
  });
});

describe('CursorRipple and reduced motion mid-session', () => {
  // The scene draws before the drive steps, so the tick that flattens the
  // water has already drawn the rippled frame. The drive must ask for one
  // more frame to show the flat one, then stop. decay 0 keeps the water
  // awake past useCursor's own presence easing, so only the drive asks.
  it('draws the flattened water once, then lets the scene park', () => {
    const scene = makeScene(makeRenderer());

    render(<CursorRipple decay={0} />, { wrapper: scene.Wrapper });
    fireMoveOnWindow(100, 100);
    scene.tick();
    fireMoveOnWindow(300, 100);
    for (let frame = 0; frame < 30; frame += 1) scene.tick();

    setReducedMotionPolicy('paused');
    scene.scheduler.requestRender.mockClear();
    scene.tick();
    expect(scene.scheduler.requestRender).toHaveBeenCalledTimes(1);

    scene.scheduler.requestRender.mockClear();
    scene.tick();
    expect(scene.scheduler.requestRender).not.toHaveBeenCalled();
  });

  // Paused is identity even when it lands mid-drag: the water clears, and
  // the Effect stops asking for frames so the scene can park.
  it('clears and stops requesting frames when the policy switches to paused', () => {
    const renderer = makeRenderer();
    const scene = makeScene(renderer);

    render(<CursorRipple />, { wrapper: scene.Wrapper });
    fireMoveOnWindow(100, 100);
    scene.tick();
    fireMoveOnWindow(300, 100);
    scene.tick();
    expect(scene.scheduler.requestRender).toHaveBeenCalled();

    setReducedMotionPolicy('paused');
    // The first paused tick flattens the water. useCursor's presence easing
    // asks for frames of its own for about 15 frames, so let it land before
    // checking that nothing keeps the scene awake.
    for (let frame = 0; frame < 30; frame += 1) scene.tick();
    const drawsWhilePaused = vi.mocked(renderer.render).mock.calls.length;

    scene.scheduler.requestRender.mockClear();
    scene.tick();

    expect(scene.scheduler.requestRender).not.toHaveBeenCalled();
    expect(renderer.render).toHaveBeenCalledTimes(drawsWhilePaused);
  });

  // "slow" scales the simulated time to 0.3, so the same drag and the same
  // real time run fewer substeps than at full speed.
  it('runs fewer substeps under the slow policy', () => {
    const drawsFor = (policy: 'off' | 'slow') => {
      setReducedMotionPolicy(policy);
      const renderer = makeRenderer();
      const scene = makeScene(renderer);
      const { unmount } = render(<CursorRipple />, { wrapper: scene.Wrapper });

      fireMoveOnWindow(100, 100);
      scene.tick();
      fireMoveOnWindow(300, 100);
      for (let frame = 0; frame < 10; frame += 1) scene.tick();
      unmount();

      return vi.mocked(renderer.render).mock.calls.length;
    };

    expect(drawsFor('slow')).toBeLessThan(drawsFor('off'));
  });
});

describe('CursorRipple props', () => {
  // refraction and shine ride stable uniforms, so new values re-register
  // neither the warp nor the overlay, and the output chain never rebuilds.
  it('re-registers nothing when refraction or shine change', () => {
    const scene = makeScene(makeRenderer());
    const { rerender } = render(<CursorRipple refraction={0.1} shine={0.4} />, {
      wrapper: scene.Wrapper,
    });

    rerender(<CursorRipple refraction={0.3} shine={0.9} />);

    expect(scene.uvTransforms).toHaveLength(1);
    expect(scene.overlays).toHaveLength(1);
    expect(scene.unregisters).toEqual({ uv: 0, overlay: 0 });
  });
});

describe('CursorRipple with an inert field', () => {
  // ADR 0003: without float render targets the Effect registers nothing,
  // renders as identity, never throws, and says so once in development.
  it('registers nothing, never throws, and warns once', () => {
    const renderer = makeRenderer({ floatTargets: false });
    const scene = makeScene(renderer);

    expect(() => {
      render(
        <>
          <CursorRipple />
          <CursorRipple />
        </>,
        { wrapper: scene.Wrapper },
      );
      fireMoveOnWindow(100, 100);
      scene.tick();
      fireMoveOnWindow(300, 100);
      scene.tick();
    }).not.toThrow();

    expect(scene.uvTransforms).toHaveLength(0);
    expect(scene.overlays).toHaveLength(0);
    expect(renderer.render).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(vi.mocked(console.warn).mock.calls[0]?.[0]).toContain('[CursorRipple]');
  });

  it('unregisters the shader when a running field loses its device', () => {
    const renderer = makeRenderer();
    const scene = makeScene(renderer);

    render(<CursorRipple />, { wrapper: scene.Wrapper });
    expect(scene.uvTransforms).toHaveLength(1);
    expect(scene.overlays).toHaveLength(1);

    (renderer as unknown as { _isDeviceLost: boolean })._isDeviceLost = true;
    act(() => scene.tick());

    expect(scene.unregisters).toEqual({ uv: 1, overlay: 1 });
  });
});

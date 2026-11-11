import { type ReactNode, StrictMode } from 'react';

import { render } from '@testing-library/react';
import { type Mesh, Scene, type WebGPURenderer } from 'three/webgpu';
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';

import { Dunes, type DunesProps, type DunesTuning } from '../../index.js';
import { ShaderContext, type ShaderContextValue } from '../../react/context/shader-context.js';
import type { AnimatableProp } from '../../react/hooks/animatable-signal/animatable-signal.js';
import { createSignal } from '../../react/internal/create-signal.js';

// What Dunes asks of the scene, never what the sand looks like. The look is
// the demo page and apps/docs-tests/visual/dunes.spec.ts. A fake context
// counts the meshes Dunes adds and how it votes, and the material on the
// mesh stands in for the compiled shader: a new material is a rebuild.
beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', () => 0);
  vi.stubGlobal('cancelAnimationFrame', () => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function makeScene() {
  const scene = new Scene();
  const scheduler = {
    idle: true,
    add: vi.fn(),
    remove: vi.fn(),
    requestRender: vi.fn(() => true),
    setIdle: vi.fn(() => () => undefined),
    onPhaseReset: vi.fn(() => () => undefined),
  };
  const shaderContext = {
    renderer: { three: { getPixelRatio: () => 2 } as unknown as WebGPURenderer },
    scene,
    camera: {},
    scheduler,
    registerOverlay: () => () => undefined,
    registerResample: () => () => undefined,
    registerPrePass: () => () => undefined,
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

  /** The one mesh Dunes should have in the scene, and its material. */
  const onlyMesh = () => {
    expect(scene.children).toHaveLength(1);
    const mesh = scene.children[0] as Mesh;

    return { mesh, material: mesh.material };
  };

  return { Wrapper, scene, scheduler, onlyMesh };
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

describe('Dunes', () => {
  // The public shape so far: three camera dials, each a number or an
  // animation signal, and the temporary tuning rig. pnpm typecheck runs this
  // file too, so a missing export or a narrowed prop fails there as well.
  it('takes three animatable camera dials from the package root', () => {
    expectTypeOf<DunesProps>().toEqualTypeOf<{
      altitude?: AnimatableProp<number>;
      tilt?: AnimatableProp<number>;
      fieldOfView?: AnimatableProp<number>;
      tuning?: DunesTuning;
    }>();
  });

  // Strict Mode mounts, unmounts, and mounts again, so a mesh left behind
  // by the first mount would draw the terrain twice.
  it('adds one mesh under Strict Mode and removes it on unmount', () => {
    const scene = makeScene();
    const { unmount } = render(<Dunes />, { wrapper: scene.Wrapper });

    scene.onlyMesh();

    unmount();
    expect(scene.scene.children).toHaveLength(0);
  });

  // Every dial rides a stable uniform, so a new value is a uniform write and
  // a repaint, never a new material.
  it('changes its camera dials without rebuilding the material', () => {
    const scene = makeScene();
    const { rerender } = render(<Dunes altitude={1} fieldOfView={50} tilt={10} />, {
      wrapper: scene.Wrapper,
    });
    const { material } = scene.onlyMesh();

    scene.scheduler.requestRender.mockClear();
    rerender(<Dunes altitude={2} fieldOfView={70} tilt={20} />);

    expect(scene.onlyMesh().material).toBe(material);
    expect(scene.scheduler.requestRender).toHaveBeenCalled();
  });

  it('follows its camera signals without rebuilding the material', () => {
    const scene = makeScene();
    const altitude = makeSignal(1);
    const tilt = makeSignal(10);
    const fieldOfView = makeSignal(50);

    render(
      <Dunes altitude={altitude.signal} fieldOfView={fieldOfView.signal} tilt={tilt.signal} />,
      {
        wrapper: scene.Wrapper,
      },
    );
    const { material } = scene.onlyMesh();

    scene.scheduler.requestRender.mockClear();

    altitude.set(2);
    expect(scene.scheduler.requestRender).toHaveBeenCalledTimes(1);
    tilt.set(25);
    expect(scene.scheduler.requestRender).toHaveBeenCalledTimes(2);
    fieldOfView.set(80);
    expect(scene.scheduler.requestRender).toHaveBeenCalledTimes(3);

    expect(scene.onlyMesh().material).toBe(material);
  });

  // The tuning sliders on the docs page glide for the same reason.
  it('changes its tuning without rebuilding the material', () => {
    const scene = makeScene();
    const { rerender } = render(<Dunes tuning={{ frequency: 0.3 }} />, {
      wrapper: scene.Wrapper,
    });
    const { material } = scene.onlyMesh();

    scene.scheduler.requestRender.mockClear();
    rerender(
      <Dunes tuning={{ frequency: 0.5, terrainHeight: 1, stepScale: 0.4, maxDistance: 60 }} />,
    );

    expect(scene.onlyMesh().material).toBe(material);
    expect(scene.scheduler.requestRender).toHaveBeenCalled();
  });

  // Nothing moves yet, so a scene of still Sources can park.
  it('votes idle and never animated', () => {
    const scene = makeScene();

    render(<Dunes />, { wrapper: scene.Wrapper });

    expect(scene.scheduler.setIdle).toHaveBeenCalledWith(true);
    expect(scene.scheduler.setIdle).not.toHaveBeenCalledWith(false);
  });

  // Mode 1 only: outside a scene there is nowhere to draw, so Dunes follows
  // its signals without a scheduler to wake and listens to nothing on the
  // page.
  it('does nothing outside a ShaderScene', () => {
    const addListener = vi.spyOn(window, 'addEventListener');
    const altitude = makeSignal(1);

    render(<Dunes altitude={altitude.signal} />);

    expect(() => altitude.set(2)).not.toThrow();
    expect(addListener).not.toHaveBeenCalled();
  });
});

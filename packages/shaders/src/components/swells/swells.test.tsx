import { type ReactNode, StrictMode } from 'react';

import { render } from '@testing-library/react';
import { type Mesh, Scene, type WebGPURenderer } from 'three/webgpu';
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';

import type { ColorSpace, HueInterpolation } from '../../engine.js';
import { Swells, type SwellsProps, type SwellsTuning } from '../../index.js';
import { ShaderContext, type ShaderContextValue } from '../../react/context/shader-context.js';
import type { AnimatableProp } from '../../react/hooks/animatable-signal/animatable-signal.js';
import { createSignal } from '../../react/internal/create-signal.js';

// What Swells asks of the scene, never what the surface looks like. The look is
// the demo page and apps/docs-tests/visual/swells.spec.ts. A fake context
// counts the meshes Swells adds and how it votes, and the material on the
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

  /** The one mesh Swells should have in the scene, and its material. */
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

describe('Swells', () => {
  // The public shape so far: the camera, shape, and sun dials, each a
  // number or an animation signal, the two surface colors and the space they
  // blend in, and the temporary tuning rig. pnpm typecheck runs this file too, so a missing export or a
  // narrowed prop fails there as well.
  it('takes animatable camera, shape, and sun dials from the package root', () => {
    expectTypeOf<SwellsProps>().toEqualTypeOf<{
      altitude?: AnimatableProp<number>;
      tilt?: AnimatableProp<number>;
      fieldOfView?: AnimatableProp<number>;
      scale?: AnimatableProp<number>;
      relief?: AnimatableProp<number>;
      ripples?: AnimatableProp<number>;
      sunAngle?: AnimatableProp<number>;
      sunHeight?: AnimatableProp<number>;
      color?: string;
      shadowColor?: string;
      colorSpace?: ColorSpace;
      hueInterpolation?: HueInterpolation;
      tuning?: SwellsTuning;
    }>();
  });

  // Strict Mode mounts, unmounts, and mounts again, so a mesh left behind
  // by the first mount would draw the terrain twice.
  it('adds one mesh under Strict Mode and removes it on unmount', () => {
    const scene = makeScene();
    const { unmount } = render(<Swells />, { wrapper: scene.Wrapper });

    scene.onlyMesh();

    unmount();
    expect(scene.scene.children).toHaveLength(0);
  });

  // Another still Source can keep the scene parked after Swells leaves, and a
  // parked scene would keep showing the last frame, surface and all.
  it('asks for a frame when it leaves the scene', () => {
    const scene = makeScene();
    const { unmount } = render(<Swells />, { wrapper: scene.Wrapper });

    scene.scheduler.requestRender.mockClear();
    unmount();

    expect(scene.scheduler.requestRender).toHaveBeenCalled();
  });

  // Every dial rides a stable uniform, so a new value is a uniform write and
  // a repaint, never a new material.
  it('changes its camera dials without rebuilding the material', () => {
    const scene = makeScene();
    const { rerender } = render(<Swells altitude={1} fieldOfView={50} tilt={10} />, {
      wrapper: scene.Wrapper,
    });
    const { material } = scene.onlyMesh();

    scene.scheduler.requestRender.mockClear();
    rerender(<Swells altitude={2} fieldOfView={70} tilt={20} />);

    expect(scene.onlyMesh().material).toBe(material);
    expect(scene.scheduler.requestRender).toHaveBeenCalled();
  });

  it('changes its sand and sun dials without rebuilding the material', () => {
    const scene = makeScene();
    const { rerender } = render(
      <Swells relief={0.8} ripples={0.6} scale={4} sunAngle={300} sunHeight={15} />,
      { wrapper: scene.Wrapper },
    );
    const { material } = scene.onlyMesh();

    scene.scheduler.requestRender.mockClear();
    rerender(<Swells relief={0} ripples={0} scale={8} sunAngle={90} sunHeight={60} />);

    expect(scene.onlyMesh().material).toBe(material);
    expect(scene.scheduler.requestRender).toHaveBeenCalled();
  });

  // The colors decode into uniforms on the CPU, so a new color is a uniform
  // write and a repaint too.
  it('changes its colors without rebuilding the material', () => {
    const scene = makeScene();
    const { rerender } = render(
      <Swells color="oklch(0.82 0.08 75)" shadowColor="oklch(0.45 0.06 15)" />,
      { wrapper: scene.Wrapper },
    );
    const { material } = scene.onlyMesh();

    scene.scheduler.requestRender.mockClear();
    rerender(<Swells color="#ffffff" />);
    expect(scene.scheduler.requestRender).toHaveBeenCalledTimes(1);
    rerender(<Swells color="#ffffff" shadowColor="#000000" />);
    expect(scene.scheduler.requestRender).toHaveBeenCalledTimes(2);

    expect(scene.onlyMesh().material).toBe(material);
  });

  // Each color space's blend is different shader code, so a new space is a
  // new material, and still only one mesh.
  it('rebuilds the material for a new color space', () => {
    const scene = makeScene();
    const { rerender } = render(<Swells colorSpace="oklab" />, { wrapper: scene.Wrapper });
    const { material } = scene.onlyMesh();

    rerender(<Swells colorSpace="linear" />);

    expect(scene.onlyMesh().material).not.toBe(material);
  });

  it('follows its camera signals without rebuilding the material', () => {
    const scene = makeScene();
    const altitude = makeSignal(1);
    const tilt = makeSignal(10);
    const fieldOfView = makeSignal(50);

    render(
      <Swells altitude={altitude.signal} fieldOfView={fieldOfView.signal} tilt={tilt.signal} />,
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

  it('follows its sand and sun signals without rebuilding the material', () => {
    const scene = makeScene();
    const signals = {
      scale: makeSignal(4),
      relief: makeSignal(0.8),
      ripples: makeSignal(0.6),
      sunAngle: makeSignal(300),
      sunHeight: makeSignal(15),
    };

    render(
      <Swells
        relief={signals.relief.signal}
        ripples={signals.ripples.signal}
        scale={signals.scale.signal}
        sunAngle={signals.sunAngle.signal}
        sunHeight={signals.sunHeight.signal}
      />,
      { wrapper: scene.Wrapper },
    );
    const { material } = scene.onlyMesh();

    scene.scheduler.requestRender.mockClear();

    Object.values(signals).forEach((channel, index) => {
      channel.set(1);
      expect(scene.scheduler.requestRender).toHaveBeenCalledTimes(index + 1);
    });

    expect(scene.onlyMesh().material).toBe(material);
  });

  // The tuning sliders on the docs page glide for the same reason.
  it('changes its tuning without rebuilding the material', () => {
    const scene = makeScene();
    const { rerender } = render(<Swells tuning={{ windAngle: 30 }} />, {
      wrapper: scene.Wrapper,
    });
    const { material } = scene.onlyMesh();

    scene.scheduler.requestRender.mockClear();
    rerender(
      <Swells
        tuning={{
          stepScale: 0.4,
          maxDistance: 60,
          windAngle: 90,
          slipFace: 0.2,
          meander: 0,
          rippleSize: 0.2,
          rippleHeight: 0.02,
        }}
      />,
    );

    expect(scene.onlyMesh().material).toBe(material);
    expect(scene.scheduler.requestRender).toHaveBeenCalled();
  });

  // Nothing moves yet, so a scene of still Sources can park.
  it('votes idle and never animated', () => {
    const scene = makeScene();

    render(<Swells />, { wrapper: scene.Wrapper });

    expect(scene.scheduler.setIdle).toHaveBeenCalledWith(true);
    expect(scene.scheduler.setIdle).not.toHaveBeenCalledWith(false);
  });

  // Mode 1 only: outside a scene there is nowhere to draw, so Swells follows
  // its signals without a scheduler to wake and listens to nothing on the
  // page.
  it('does nothing outside a ShaderScene', () => {
    const addListener = vi.spyOn(window, 'addEventListener');
    const altitude = makeSignal(1);

    render(<Swells altitude={altitude.signal} />);

    expect(() => altitude.set(2)).not.toThrow();
    expect(addListener).not.toHaveBeenCalled();
  });
});

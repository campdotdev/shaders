import { type ReactNode, StrictMode, useLayoutEffect } from 'react';

import { act, render } from '@testing-library/react';
import { type Mesh, Scene, type WebGPURenderer } from 'three/webgpu';
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';

import {
  type ColorSpace,
  CursorInput,
  type HueInterpolation,
  type SchedulerTick,
  setReducedMotionPolicy,
} from '../../engine.js';
import { Swells, type SwellsProps, type SwellsTuning } from '../../index.js';
import { ShaderContext, type ShaderContextValue } from '../../react/context/shader-context.js';
import type {
  AnimatableProp,
  PositionProp,
} from '../../react/hooks/animatable-signal/animatable-signal.js';
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
  setReducedMotionPolicy('auto');
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function makeScene() {
  const scene = new Scene();
  const canvas = document.createElement('canvas');
  const scheduler = {
    idle: true,
    add: vi.fn(),
    remove: vi.fn(),
    requestRender: vi.fn(() => true),
    setIdle: vi.fn<(isStatic: boolean) => () => void>(() => () => undefined),
    onPhaseReset: vi.fn<(listener: (originSeconds: number) => void) => () => void>(
      () => () => undefined,
    ),
  };
  // The scene's one shared pointer, which a "cursor" parallax center reads.
  let sharedInput: CursorInput | null = null;
  const shaderContext = {
    renderer: {
      three: { domElement: canvas, getPixelRatio: () => 2 } as unknown as WebGPURenderer,
    },
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
    getCursorInput: vi.fn(() => {
      sharedInput ??= new CursorInput({ element: canvas });

      return sharedInput;
    }),
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

  return { Wrapper, scene, scheduler, onlyMesh, getCursorInput: shaderContext.getCursorInput };
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
  // The public shape so far: the camera, shape, sun, air, and motion dials,
  // each a number or an animation signal, the colors and the space they
  // blend in, the point the camera sways toward, the intro switch, and the
  // temporary tuning rig. pnpm typecheck runs this file too, so a missing export or a
  // narrowed prop fails there as well.
  it('takes animatable camera, shape, sun, air, and motion dials from the package root', () => {
    expectTypeOf<SwellsProps>().toEqualTypeOf<{
      altitude?: AnimatableProp<number>;
      tilt?: AnimatableProp<number>;
      fieldOfView?: AnimatableProp<number>;
      scale?: AnimatableProp<number>;
      relief?: AnimatableProp<number>;
      sharpness?: AnimatableProp<number>;
      ripples?: AnimatableProp<number>;
      sunAngle?: AnimatableProp<number>;
      sunHeight?: AnimatableProp<number>;
      color?: string;
      shadowColor?: string;
      sheen?: AnimatableProp<number>;
      sheenColor?: string;
      haze?: AnimatableProp<number>;
      hazeColor?: string;
      mirage?: AnimatableProp<number>;
      colorSpace?: ColorSpace;
      hueInterpolation?: HueInterpolation;
      speed?: AnimatableProp<number>;
      swellSpeed?: AnimatableProp<number>;
      parallax?: AnimatableProp<number>;
      parallaxCenter?: PositionProp;
      intro?: boolean;
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

  it('changes its shape and sun dials without rebuilding the material', () => {
    const scene = makeScene();
    const { rerender } = render(
      <Swells relief={0.8} ripples={0.6} scale={4} sharpness={1} sunAngle={300} sunHeight={15} />,
      { wrapper: scene.Wrapper },
    );
    const { material } = scene.onlyMesh();

    scene.scheduler.requestRender.mockClear();
    rerender(
      <Swells relief={0} ripples={0} scale={8} sharpness={0} sunAngle={90} sunHeight={60} />,
    );

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

  // The sheen, the haze, and the mirage ride uniforms too, so they glide
  // on a slider or a signal with no rebuild.
  it('changes its sheen, haze, and mirage without rebuilding the material', () => {
    const scene = makeScene();
    const haze = makeSignal(0.04);
    const { rerender } = render(<Swells haze={haze.signal} sheen={0.3} />, {
      wrapper: scene.Wrapper,
    });
    const { material } = scene.onlyMesh();

    scene.scheduler.requestRender.mockClear();
    haze.set(0);
    expect(scene.scheduler.requestRender).toHaveBeenCalledTimes(1);
    rerender(
      <Swells haze={haze.signal} hazeColor="#ffffff" mirage={0.8} sheen={1} sheenColor="#ffffff" />,
    );
    expect(scene.scheduler.requestRender).toHaveBeenCalled();

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

  // So is each hue arc's.
  it('rebuilds the material for a new hue arc', () => {
    const scene = makeScene();
    const { rerender } = render(<Swells colorSpace="oklch" hueInterpolation="shorter" />, {
      wrapper: scene.Wrapper,
    });
    const { material } = scene.onlyMesh();

    rerender(<Swells colorSpace="oklch" hueInterpolation="longer" />);

    expect(scene.onlyMesh().material).not.toBe(material);
  });

  // three draws transparent meshes in the order they were created when
  // nothing else separates them, and Swells is transparent where the sky
  // shows through. A rebuild that made a new mesh would move Swells in front
  // of a later Source, such as DotField, that the JSX order put on top.
  it('keeps the same mesh when the material rebuilds', () => {
    const scene = makeScene();
    const { rerender } = render(<Swells colorSpace="oklab" />, { wrapper: scene.Wrapper });
    const { mesh } = scene.onlyMesh();

    rerender(<Swells colorSpace="linear" />);

    expect(scene.onlyMesh().mesh).toBe(mesh);
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

  it('follows its shape and sun signals without rebuilding the material', () => {
    const scene = makeScene();
    const signals = {
      scale: makeSignal(4),
      relief: makeSignal(0.8),
      sharpness: makeSignal(0.5),
      ripples: makeSignal(0.6),
      sunAngle: makeSignal(300),
      sunHeight: makeSignal(15),
    };

    render(
      <Swells
        relief={signals.relief.signal}
        ripples={signals.ripples.signal}
        scale={signals.scale.signal}
        sharpness={signals.sharpness.signal}
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
          maxSlope: 2,
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

  // The glide, the swells' rise and fall, and the parallax sway ride uniforms too.
  it('changes its motion dials without rebuilding the material', () => {
    const scene = makeScene();
    const parallax = makeSignal(0);
    const { rerender } = render(<Swells parallax={parallax.signal} speed={0.3} swellSpeed={0} />, {
      wrapper: scene.Wrapper,
    });
    const { material } = scene.onlyMesh();

    scene.scheduler.requestRender.mockClear();
    parallax.set(1);
    expect(scene.scheduler.requestRender).toHaveBeenCalledTimes(1);
    rerender(
      <Swells parallax={parallax.signal} parallaxCenter={[0.2, 0.8]} speed={-1} swellSpeed={0.5} />,
    );
    expect(scene.scheduler.requestRender).toHaveBeenCalled();

    expect(scene.onlyMesh().material).toBe(material);
  });

  // The render-on-demand vote. Three dials move the picture on their own:
  // the glide, the swells' rise and fall, and the mirage's shimmer, and so
  // does the intro while it plays. With all three at 0 and the intro off,
  // nothing changes between frames, so a scene of still Sources can park.
  const still = { speed: 0, swellSpeed: 0, mirage: 0, intro: false } as const;

  /** The last vote Swells cast: true for static, false for animated. */
  const lastVote = (scene: ReturnType<typeof makeScene>) =>
    scene.scheduler.setIdle.mock.lastCall?.[0];

  it('votes static when the glide, the swells, and the mirage are all still', () => {
    const scene = makeScene();

    render(<Swells {...still} />, { wrapper: scene.Wrapper });

    expect(scene.scheduler.setIdle).toHaveBeenCalledWith(true);
    expect(scene.scheduler.setIdle).not.toHaveBeenCalledWith(false);
  });

  it.each([
    ['gliding forward', { speed: 0.3 }],
    ['gliding backward', { speed: -0.3 }],
    ['rising and falling', { swellSpeed: 0.2 }],
    ['shimmering', { mirage: 0.3 }],
  ])('votes animated while %s', (_name, moving) => {
    const scene = makeScene();

    render(<Swells {...still} {...moving} />, { wrapper: scene.Wrapper });

    expect(scene.scheduler.setIdle).toHaveBeenCalledWith(false);
    expect(scene.scheduler.setIdle).not.toHaveBeenCalledWith(true);
  });

  // A signal can leave 0 between renders, so it counts as moving whatever
  // it reads now.
  it.each(['speed', 'swellSpeed', 'mirage'] as const)(
    'votes animated for a %s signal that reads 0',
    (dial) => {
      const scene = makeScene();

      render(<Swells {...still} {...{ [dial]: makeSignal(0).signal }} />, {
        wrapper: scene.Wrapper,
      });

      expect(scene.scheduler.setIdle).toHaveBeenCalledWith(false);
      expect(scene.scheduler.setIdle).not.toHaveBeenCalledWith(true);
    },
  );

  // A cursor only moves when the pointer does, and useCursor wakes the
  // scene on every move and keeps it drawing until its smoothing settles,
  // so a still pointer may let the scene park, as LedWall's swell center
  // does (SHA-139). The sway itself changes nothing over time.
  it('votes static with a cursor sway while everything else is still', () => {
    const scene = makeScene();

    render(<Swells {...still} parallax={1} parallaxCenter="cursor" />, {
      wrapper: scene.Wrapper,
    });

    expect(lastVote(scene)).toBe(true);
    expect(scene.scheduler.setIdle).not.toHaveBeenCalledWith(false);
  });

  // A fixed parallax of 0 holds the camera still wherever the center is, so a
  // cursor center has nothing to move and Swells never reads the pointer.
  // A pointer it did read would wake the march on every move for the same
  // picture. Any other parallax follows it.
  it('reads the cursor only while the parallax can sway the camera', () => {
    const level = makeScene();

    render(<Swells parallax={0} parallaxCenter="cursor" />, { wrapper: level.Wrapper });
    expect(level.getCursorInput).not.toHaveBeenCalled();

    const swaying = makeScene();

    render(<Swells parallax={1} parallaxCenter="cursor" />, { wrapper: swaying.Wrapper });
    expect(swaying.getCursorInput).toHaveBeenCalled();
  });

  it('reads the cursor only while reduced motion lets the sway move', () => {
    setReducedMotionPolicy('slow');
    const held = makeScene();

    render(<Swells parallax={1} parallaxCenter="cursor" />, { wrapper: held.Wrapper });
    expect(held.getCursorInput).not.toHaveBeenCalled();

    setReducedMotionPolicy('off');
    const swaying = makeScene();

    render(<Swells parallax={1} parallaxCenter="cursor" />, { wrapper: swaying.Wrapper });
    expect(swaying.getCursorInput).toHaveBeenCalled();
  });

  // A layout effect runs after Swells renders and before it subscribes, so
  // this change lands in the gap between the two.
  it('catches a policy change between its render and its subscription', () => {
    function TurnMotionOn() {
      useLayoutEffect(() => setReducedMotionPolicy('off'), []);

      return null;
    }

    setReducedMotionPolicy('slow');
    const scene = makeScene();

    render(
      <>
        <Swells parallax={1} parallaxCenter="cursor" />
        <TurnMotionOn />
      </>,
      { wrapper: scene.Wrapper },
    );
    expect(scene.getCursorInput).toHaveBeenCalled();
  });

  // The vote follows the dials as they change.
  it('changes its vote when the glide starts and stops', () => {
    const scene = makeScene();
    const { rerender } = render(<Swells {...still} />, { wrapper: scene.Wrapper });

    expect(lastVote(scene)).toBe(true);
    rerender(<Swells {...still} speed={0.3} />);
    expect(lastVote(scene)).toBe(false);
    rerender(<Swells {...still} />);
    expect(lastVote(scene)).toBe(true);
  });

  // ---------------------------------------------
  // The intro
  // ---------------------------------------------
  // The intro runs on a clock of its own, a scheduler client that sums each
  // tick's seconds. These drive every client Swells registered by hand, the
  // way the scene's frame loop would, and read what Swells asks of the
  // scene in reply.

  /** Runs one scheduler tick of `delta` seconds through every client Swells added. */
  const tick = (scene: ReturnType<typeof makeScene>, delta: number) => {
    act(() => {
      for (const [client] of scene.scheduler.add.mock.calls) {
        (client as (tick: SchedulerTick) => void)({ delta, elapsed: 0, now: 0 });
      }
    });
  };

  /** Runs `seconds` of ticks, 0.05 seconds apiece. */
  const run = (scene: ReturnType<typeof makeScene>, seconds: number) => {
    for (let elapsed = 0; elapsed < seconds; elapsed += 0.05) tick(scene, 0.05);
  };

  /** Rewinds every phase clock Swells registered, as the scene does at its first frame with content. */
  const resetPhases = (scene: ReturnType<typeof makeScene>, origin = 0) => {
    act(() => {
      for (const [listener] of scene.scheduler.onPhaseReset.mock.calls) listener(origin);
    });
  };

  // Everything but the intro holds still here, so the intro alone decides
  // the vote and the frame requests.
  const stillButIntro = { ...still, intro: true } as const;

  it('requests a frame on every tick while the intro plays, then votes static once it lands', () => {
    setReducedMotionPolicy('off');
    const scene = makeScene();

    render(<Swells {...stillButIntro} />, { wrapper: scene.Wrapper });
    expect(lastVote(scene), 'vote while the intro plays').toBe(false);

    for (let step = 0; step < 20; step += 1) {
      scene.scheduler.requestRender.mockClear();
      tick(scene, 0.05);
      expect(scene.scheduler.requestRender, `a frame after tick ${step}`).toHaveBeenCalled();
    }

    run(scene, 10);
    expect(lastVote(scene), 'vote once the intro lands').toBe(true);

    scene.scheduler.requestRender.mockClear();
    tick(scene, 0.05);
    expect(scene.scheduler.requestRender, 'frames after the intro lands').not.toHaveBeenCalled();
  });

  // The intro plays once per mount. A prop change, the intro switched off
  // and on again included, leaves a landed intro landed.
  it('does not replay the intro on a prop change', () => {
    setReducedMotionPolicy('off');
    const scene = makeScene();
    const { rerender } = render(<Swells {...stillButIntro} />, { wrapper: scene.Wrapper });

    run(scene, 10);
    rerender(<Swells {...stillButIntro} relief={0.4} />);
    rerender(<Swells {...stillButIntro} intro={false} relief={0.4} />);
    rerender(<Swells {...stillButIntro} relief={0.4} />);

    scene.scheduler.requestRender.mockClear();
    tick(scene, 0.05);
    expect(lastVote(scene)).toBe(true);
    expect(scene.scheduler.requestRender).not.toHaveBeenCalled();
  });

  // The scene rewinds its clocks at its first frame with content, so the
  // intro starts there rather than at mount, and the renderer's start-up
  // time doesn't eat into it.
  it("starts the intro over at the scene's phase reset", () => {
    setReducedMotionPolicy('off');
    const scene = makeScene();

    render(<Swells {...stillButIntro} />, { wrapper: scene.Wrapper });
    run(scene, 2);
    resetPhases(scene);
    run(scene, 2);

    expect(lastVote(scene), 'two seconds after the reset').toBe(false);
  });

  // A composition page under the visual-test harness resets the phases on
  // every preset it loads, long after the intro has landed.
  it('does not replay a landed intro at a later phase reset', () => {
    setReducedMotionPolicy('off');
    const scene = makeScene();

    render(<Swells {...stillButIntro} />, { wrapper: scene.Wrapper });
    run(scene, 10);
    resetPhases(scene);

    scene.scheduler.requestRender.mockClear();
    tick(scene, 0.05);
    expect(lastVote(scene)).toBe(true);
    expect(scene.scheduler.requestRender).not.toHaveBeenCalled();
  });

  // Turned off, or under reduced motion, the intro skips to the finished
  // surface: posters and visual tests load under the paused policy, and at
  // the slow policy's 0.3x it would crawl.
  it.each([
    ['intro={false}', 'off', false],
    ['the slow policy', 'slow', true],
    ['the paused policy', 'paused', true],
  ] as const)('skips the intro under %s', (_name, policy, intro) => {
    setReducedMotionPolicy(policy);
    const scene = makeScene();

    render(<Swells {...still} intro={intro} />, { wrapper: scene.Wrapper });
    resetPhases(scene);
    scene.scheduler.requestRender.mockClear();
    tick(scene, 0.05);

    expect(scene.scheduler.setIdle).not.toHaveBeenCalledWith(false);
    expect(lastVote(scene)).toBe(true);
    expect(scene.scheduler.requestRender).not.toHaveBeenCalled();
  });

  // A switch to reduced motion partway through lands the intro at once.
  it('lands the intro when reduced motion turns on partway through', () => {
    setReducedMotionPolicy('off');
    const scene = makeScene();

    render(<Swells {...stillButIntro} />, { wrapper: scene.Wrapper });
    run(scene, 1);
    act(() => setReducedMotionPolicy('slow'));
    tick(scene, 0.05);
    act(() => setReducedMotionPolicy('off'));
    tick(scene, 0.05);

    expect(lastVote(scene)).toBe(true);
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

import { type ReactNode, StrictMode } from 'react';

import { render } from '@testing-library/react';
import type { WebGPURenderer } from 'three/webgpu';
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';

import { type CrossSectionName, FlutedGlass, type FlutedGlassProps } from '../../index.js';
import {
  type PostProcessTransform,
  ShaderContext,
  type ShaderContextValue,
  type UvTransform,
} from '../../react/context/shader-context.js';
import type { AnimatableProp } from '../../react/hooks/animatable-signal/animatable-signal.js';
import { createSignal } from '../../react/internal/create-signal.js';
import type { SchedulerClient } from '../../runtime/frame-scheduler/frame-scheduler.js';

// What the Effect asks of the scene, never what the glass looks like. The
// look is the demo page and its visual spec. A fake context counts what the
// glass registers on the output stage and how it votes.
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
  const uvTransforms: UvTransform[] = [];
  const overlays: PostProcessTransform[] = [];
  const unregisters = { uv: 0, overlay: 0 };
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
    registerBaseUvTransform: (transform: UvTransform) => {
      uvTransforms.push(transform);

      return () => {
        unregisters.uv += 1;
      };
    },
  } as unknown as ShaderContextValue;

  function Wrapper({ children }: { children: ReactNode }) {
    return <ShaderContext.Provider value={shaderContext}>{children}</ShaderContext.Provider>;
  }

  return { Wrapper, scheduler, uvTransforms, overlays, unregisters };
}

/** One UV warp and one color transform, neither removed or registered again. */
function expectOneOfEach(scene: ReturnType<typeof makeScene>) {
  expect(scene.uvTransforms).toHaveLength(1);
  expect(scene.overlays).toHaveLength(1);
  expect(scene.unregisters).toEqual({ uv: 0, overlay: 0 });
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

describe('FlutedGlass', () => {
  // The public shape: seven optional dials, each a number or an animation
  // signal, where the cross-section also takes a name for a point on its
  // dial, plus a highlight color. pnpm typecheck runs this file too, so a
  // missing export or a narrowed prop fails there as well as here.
  it('takes seven animatable dials and a highlight color from the package root', () => {
    expectTypeOf<CrossSectionName>().toEqualTypeOf<'prism' | 'round' | 'flat'>();
    expectTypeOf<FlutedGlassProps>().toEqualTypeOf<{
      fluteWidth?: AnimatableProp<number>;
      angle?: AnimatableProp<number>;
      refraction?: AnimatableProp<number>;
      crossSection?: AnimatableProp<number> | CrossSectionName;
      lightAngle?: AnimatableProp<number>;
      highlight?: AnimatableProp<number>;
      highlightColor?: string;
      shadow?: AnimatableProp<number>;
    }>();
  });

  // The UV warp bends the image, and the color transform lights the glass.
  it('registers one UV warp and one color transform, and removes both on unmount', () => {
    const scene = makeScene();
    const { unmount } = render(<FlutedGlass />, { wrapper: scene.Wrapper });

    expectOneOfEach(scene);

    unmount();
    expect(scene.unregisters).toEqual({ uv: 1, overlay: 1 });
  });

  it('survives Strict Mode with one UV warp and one color transform', () => {
    const scene = makeScene();

    render(
      <StrictMode>
        <FlutedGlass />
      </StrictMode>,
      { wrapper: scene.Wrapper },
    );

    expect(scene.uvTransforms.length - scene.unregisters.uv).toBe(1);
    expect(scene.overlays.length - scene.unregisters.overlay).toBe(1);
  });

  // Every dial rides a stable uniform, so a new value is a uniform write
  // and a repaint, never a recompile of the output chain.
  it('changes its dials without re-registering either pass', () => {
    const scene = makeScene();
    const { rerender } = render(
      <FlutedGlass
        angle={90}
        fluteWidth={40}
        highlight={0.5}
        lightAngle={135}
        refraction={1}
        shadow={0.3}
      />,
      { wrapper: scene.Wrapper },
    );

    scene.scheduler.requestRender.mockClear();
    rerender(
      <FlutedGlass
        angle={45}
        fluteWidth={24}
        highlight={1}
        lightAngle={0}
        refraction={0.5}
        shadow={0}
      />,
    );

    expectOneOfEach(scene);
    expect(scene.scheduler.requestRender).toHaveBeenCalled();
  });

  it('follows its dial signals without re-registering either pass', () => {
    const scene = makeScene();
    const fluteWidth = makeSignal(40);
    const angle = makeSignal(90);
    const refraction = makeSignal(1);
    const crossSection = makeSignal(0.5);
    const lightAngle = makeSignal(135);
    const highlight = makeSignal(0.5);
    const shadow = makeSignal(0.3);

    render(
      <FlutedGlass
        angle={angle.signal}
        crossSection={crossSection.signal}
        fluteWidth={fluteWidth.signal}
        highlight={highlight.signal}
        lightAngle={lightAngle.signal}
        refraction={refraction.signal}
        shadow={shadow.signal}
      />,
      { wrapper: scene.Wrapper },
    );
    scene.scheduler.requestRender.mockClear();

    fluteWidth.set(24);
    expect(scene.scheduler.requestRender).toHaveBeenCalledTimes(1);
    angle.set(30);
    expect(scene.scheduler.requestRender).toHaveBeenCalledTimes(2);
    refraction.set(0);
    expect(scene.scheduler.requestRender).toHaveBeenCalledTimes(3);
    crossSection.set(0.2);
    expect(scene.scheduler.requestRender).toHaveBeenCalledTimes(4);
    lightAngle.set(45);
    expect(scene.scheduler.requestRender).toHaveBeenCalledTimes(5);
    highlight.set(1);
    expect(scene.scheduler.requestRender).toHaveBeenCalledTimes(6);
    shadow.set(0);
    expect(scene.scheduler.requestRender).toHaveBeenCalledTimes(7);

    expectOneOfEach(scene);
  });

  // The color decodes into a uniform, so a new color repaints the glass
  // without rebuilding the color transform.
  it('changes its highlight color without re-registering either pass', () => {
    const scene = makeScene();
    const { rerender } = render(<FlutedGlass highlightColor="#ffffff" />, {
      wrapper: scene.Wrapper,
    });

    for (const highlightColor of ['#ffd27f', 'oklch(0.8 0.1 250)']) {
      scene.scheduler.requestRender.mockClear();
      rerender(<FlutedGlass highlightColor={highlightColor} />);
      expect(scene.scheduler.requestRender).toHaveBeenCalled();
    }

    expectOneOfEach(scene);
  });

  // A name is a point on the cross-section dial, not a formula of its own,
  // so switching names writes the same uniform a number would.
  it('switches cross-section names without re-registering either pass', () => {
    const scene = makeScene();
    const { rerender } = render(<FlutedGlass crossSection="prism" />, {
      wrapper: scene.Wrapper,
    });

    for (const name of ['round', 'flat', 'prism'] as const) {
      scene.scheduler.requestRender.mockClear();
      rerender(<FlutedGlass crossSection={name} />);
      expect(scene.scheduler.requestRender).toHaveBeenCalled();
    }

    expectOneOfEach(scene);
  });

  // Still glass draws nothing that changes over time, so a scene of still
  // Sources under it can park.
  it('votes idle and never animated', () => {
    const scene = makeScene();

    render(<FlutedGlass />, { wrapper: scene.Wrapper });

    expect(scene.scheduler.setIdle).toHaveBeenCalledWith(true);
    expect(scene.scheduler.setIdle).not.toHaveBeenCalledWith(false);
  });

  // Mode 1 only: outside a scene there is no output stage to bend, so the
  // glass follows its signals without a scheduler to wake and listens to
  // nothing on the page.
  it('does nothing outside a ShaderScene', () => {
    const addListener = vi.spyOn(window, 'addEventListener');
    const refraction = makeSignal(1);

    render(<FlutedGlass refraction={refraction.signal} />);

    expect(() => refraction.set(0.5)).not.toThrow();
    expect(addListener).not.toHaveBeenCalled();
  });
});

import { type ReactNode, StrictMode } from 'react';

import { render } from '@testing-library/react';
import { uniform } from 'three/tsl';
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';

import { FlutedGlass, type FlutedGlassProps } from '../../index.js';
import {
  type ColorTransform,
  ShaderContext,
  type ShaderContextValue,
  type UvWarp,
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
  const warps: UvWarp[] = [];
  const transforms: ColorTransform[] = [];
  const unregisters = { warp: 0, transform: 0 };
  const scheduler = {
    idle: true,
    add: (client: SchedulerClient) => clients.push(client),
    remove: (client: SchedulerClient) => {
      const index = clients.indexOf(client);

      if (index >= 0) clients.splice(index, 1);
    },
    requestRender: vi.fn(() => true),
    setIdle: vi.fn(() => () => undefined),
    onPhaseReset: vi.fn(() => () => undefined),
  };
  const shaderContext = {
    renderer: { three: { domElement: document.createElement('canvas') } },
    scene: {},
    camera: {},
    scheduler,
    registerUvWarp: (warp: UvWarp) => {
      warps.push(warp);

      return () => {
        unregisters.warp += 1;
      };
    },
    registerColorTransform: (transform: ColorTransform) => {
      transforms.push(transform);

      return () => {
        unregisters.transform += 1;
      };
    },
    canvasSize: {
      signal: { get: () => [0, 0, 1] as const, on: () => () => undefined },
      pixelRatio: uniform(1),
    },
  } as unknown as ShaderContextValue;

  function Wrapper({ children }: { children: ReactNode }) {
    return <ShaderContext.Provider value={shaderContext}>{children}</ShaderContext.Provider>;
  }

  return { Wrapper, scheduler, warps, transforms, unregisters };
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
  // The public shape: nine optional dials, each a number or an animation
  // signal. pnpm typecheck runs this file too, so a missing export or a
  // narrowed prop fails there as well as here.
  it('takes nine animatable number props from the package root', () => {
    expectTypeOf<FlutedGlassProps>().toEqualTypeOf<{
      width?: AnimatableProp<number>;
      angle?: AnimatableProp<number>;
      refraction?: AnimatableProp<number>;
      softness?: AnimatableProp<number>;
      shine?: AnimatableProp<number>;
      shadow?: AnimatableProp<number>;
      sway?: AnimatableProp<number>;
      swayFrequency?: AnimatableProp<number>;
      speed?: AnimatableProp<number>;
    }>();
    expectTypeOf<typeof FlutedGlass>().parameter(0).toEqualTypeOf<FlutedGlassProps>();
  });

  it('registers one UV warp and one color transform, and unregisters both on unmount', () => {
    const scene = makeScene();
    const { unmount } = render(<FlutedGlass />, { wrapper: scene.Wrapper });

    expect(scene.warps).toHaveLength(1);
    expect(scene.transforms).toHaveLength(1);

    unmount();
    expect(scene.unregisters).toEqual({ warp: 1, transform: 1 });
  });

  it('survives Strict Mode without a second registration', () => {
    const scene = makeScene();

    render(
      <StrictMode>
        <FlutedGlass />
      </StrictMode>,
      { wrapper: scene.Wrapper },
    );

    expect(scene.warps.length - scene.unregisters.warp).toBe(1);
    expect(scene.transforms.length - scene.unregisters.transform).toBe(1);
  });

  // Every dial rides a stable uniform, so a new value is a uniform write
  // and a repaint, never a recompile of the output chain.
  it('changes every prop without re-registering', () => {
    const scene = makeScene();
    const { rerender } = render(<FlutedGlass />, { wrapper: scene.Wrapper });

    scene.scheduler.requestRender.mockClear();
    rerender(
      <FlutedGlass
        angle={30}
        refraction={0.9}
        shadow={0.6}
        shine={0.7}
        softness={1}
        speed={2}
        sway={0.4}
        swayFrequency={3}
        width={12}
      />,
    );

    expect(scene.warps).toHaveLength(1);
    expect(scene.transforms).toHaveLength(1);
    expect(scene.unregisters).toEqual({ warp: 0, transform: 0 });
    expect(scene.scheduler.requestRender).toHaveBeenCalled();
  });

  it('follows a signal without re-registering', () => {
    const scene = makeScene();
    const width = makeSignal(40);

    render(<FlutedGlass width={width.signal} />, { wrapper: scene.Wrapper });
    scene.scheduler.requestRender.mockClear();

    width.set(20);

    expect(scene.scheduler.requestRender).toHaveBeenCalledTimes(1);
    expect(scene.warps).toHaveLength(1);
    expect(scene.transforms).toHaveLength(1);
  });

  // Only speed moves the glass on its own, and a signal may move later.
  it('votes the scene idle at a literal speed of 0', () => {
    const scene = makeScene();

    render(<FlutedGlass speed={0} />, { wrapper: scene.Wrapper });

    expect(scene.scheduler.setIdle).toHaveBeenCalledWith(true);
    expect(scene.scheduler.setIdle).not.toHaveBeenCalledWith(false);
  });

  it('votes the scene animated at any other speed', () => {
    for (const speed of [1, -0.5]) {
      const scene = makeScene();

      render(<FlutedGlass speed={speed} />, { wrapper: scene.Wrapper });

      expect(scene.scheduler.setIdle).toHaveBeenCalledWith(false);
      expect(scene.scheduler.setIdle).not.toHaveBeenCalledWith(true);
    }
  });

  it('votes the scene animated at a speed signal, even one reading 0', () => {
    const scene = makeScene();

    render(<FlutedGlass speed={makeSignal(0).signal} />, { wrapper: scene.Wrapper });

    expect(scene.scheduler.setIdle).toHaveBeenCalledWith(false);
    expect(scene.scheduler.setIdle).not.toHaveBeenCalledWith(true);
  });

  // Mode 1 only: outside a scene there is no output stage to bend.
  it('renders nothing and does not throw outside a ShaderScene', () => {
    const { container } = render(<FlutedGlass speed={1} />);

    expect(container).toBeEmptyDOMElement();
  });
});

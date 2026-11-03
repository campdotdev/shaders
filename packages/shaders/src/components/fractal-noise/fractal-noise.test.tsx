import { type ReactNode, StrictMode } from 'react';

import { render } from '@testing-library/react';
import { Scene } from 'three/webgpu';
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';

import { FractalNoise, type FractalNoiseProps } from '../../index.js';
import { ShaderContext, type ShaderContextValue } from '../../react/context/shader-context.js';
import type { AnimatableProp } from '../../react/hooks/animatable-signal/animatable-signal.js';
import { createSignal } from '../../react/internal/create-signal.js';

// What FractalNoise asks of the scene when its tilt changes, never what the
// streaks look like. The look is the demo page and
// apps/docs-tests/visual/fractal-noise.spec.ts. A fake context hands it a
// real three Scene, so the test can tell a kept mesh from a rebuilt one.
beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', () => 0);
  vi.stubGlobal('cancelAnimationFrame', () => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** A scene context on an 800 by 400 CSS pixel canvas that never resizes. */
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
    scene,
    camera: {},
    scheduler,
    canvasSize: {
      get: () => [800, 400, 2],
      on: () => () => undefined,
    },
  } as unknown as ShaderContextValue;

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <StrictMode>
        <ShaderContext.Provider value={shaderContext}>{children}</ShaderContext.Provider>
      </StrictMode>
    );
  }

  return { Wrapper, scene, scheduler };
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

describe('FractalNoise', () => {
  it('takes an animatable angle and stretch from the package root', () => {
    expectTypeOf<FractalNoiseProps['angle']>().toEqualTypeOf<AnimatableProp<number> | undefined>();
    expectTypeOf<FractalNoiseProps['stretch']>().toEqualTypeOf<
      AnimatableProp<number> | undefined
    >();
  });

  // Both ride stable uniforms, so a new value is a uniform write and a
  // repaint. A rebuild would swap the mesh for a new one.
  it('changes its angle and stretch without rebuilding the material', () => {
    const scene = makeScene();
    const { rerender } = render(<FractalNoise angle={0} stretch={1} />, {
      wrapper: scene.Wrapper,
    });
    const [mesh] = scene.scene.children;

    expect(scene.scene.children).toHaveLength(1);
    scene.scheduler.requestRender.mockClear();

    rerender(<FractalNoise angle={30} stretch={3} />);

    expect(scene.scene.children).toEqual([mesh]);
    expect(scene.scheduler.requestRender).toHaveBeenCalled();
  });

  it('follows angle and stretch signals without rebuilding the material', () => {
    const scene = makeScene();
    const angle = makeSignal(0);
    const stretch = makeSignal(1);

    render(<FractalNoise angle={angle.signal} stretch={stretch.signal} />, {
      wrapper: scene.Wrapper,
    });
    const [mesh] = scene.scene.children;

    scene.scheduler.requestRender.mockClear();

    angle.set(30);
    expect(scene.scheduler.requestRender).toHaveBeenCalledTimes(1);
    stretch.set(3);
    expect(scene.scheduler.requestRender).toHaveBeenCalledTimes(2);
    expect(scene.scene.children).toEqual([mesh]);
  });
});

import { type ReactNode, StrictMode } from 'react';

import { render } from '@testing-library/react';
import type { WebGPURenderer } from 'three/webgpu';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CursorInput } from '../../engine.js';
import {
  type PostProcessTransform,
  ShaderContext,
  type ShaderContextValue,
} from '../../react/context/shader-context.js';
import { createSignal } from '../../react/internal/create-signal.js';
import type { SchedulerClient } from '../../runtime/frame-scheduler/frame-scheduler.js';
import { CursorSpotlight } from './cursor-spotlight.js';

// What the Effect asks of the scene, never what the light looks like. The
// look is the demo page and its visual spec. A fake context counts what the
// spotlight registers on the output stage and how it votes.
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
  const overlays: PostProcessTransform[] = [];
  const unregisters = { overlay: 0 };
  const canvas = document.createElement('canvas');
  const renderer = {
    domElement: canvas,
    getSize: (target: { set: (x: number, y: number) => unknown }) => target.set(1280, 720),
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
    registerBaseUvTransform: () => () => undefined,
    getCursorInput: () => {
      sharedInput ??= new CursorInput({ element: canvas });

      return sharedInput;
    },
  } as unknown as ShaderContextValue;

  function Wrapper({ children }: { children: ReactNode }) {
    return <ShaderContext.Provider value={shaderContext}>{children}</ShaderContext.Provider>;
  }

  return { Wrapper, scheduler, overlays, unregisters };
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

describe('CursorSpotlight', () => {
  it('registers one overlay and unregisters it on unmount', () => {
    const scene = makeScene();
    const { unmount } = render(<CursorSpotlight />, { wrapper: scene.Wrapper });

    expect(scene.overlays).toHaveLength(1);

    unmount();
    expect(scene.unregisters.overlay).toBe(1);
  });

  // The cursor wakes the scene on its own, so the spotlight never needs to
  // hold the frame loop open.
  it('votes the scene static and never animated', () => {
    const scene = makeScene();

    render(<CursorSpotlight />, { wrapper: scene.Wrapper });

    expect(scene.scheduler.setIdle).toHaveBeenCalledWith(true);
    expect(scene.scheduler.setIdle).not.toHaveBeenCalledWith(false);
  });

  it('survives Strict Mode without a second overlay', () => {
    const scene = makeScene();

    render(
      <StrictMode>
        <CursorSpotlight />
      </StrictMode>,
      { wrapper: scene.Wrapper },
    );

    expect(scene.overlays.length - scene.unregisters.overlay).toBe(1);
  });

  // Both dials ride stable uniforms, so a new value is a uniform write and
  // a repaint, never a recompile of the output chain.
  it('changes radius and intensity without re-registering the overlay', () => {
    const scene = makeScene();
    const { rerender } = render(<CursorSpotlight intensity={0.5} radius={0.3} />, {
      wrapper: scene.Wrapper,
    });

    scene.scheduler.requestRender.mockClear();
    rerender(<CursorSpotlight intensity={0.9} radius={0.1} />);

    expect(scene.overlays).toHaveLength(1);
    expect(scene.unregisters.overlay).toBe(0);
    expect(scene.scheduler.requestRender).toHaveBeenCalled();
  });

  it('follows radius and intensity signals without re-registering the overlay', () => {
    const scene = makeScene();
    const radius = makeSignal(0.3);
    const intensity = makeSignal(0.5);

    render(<CursorSpotlight intensity={intensity.signal} radius={radius.signal} />, {
      wrapper: scene.Wrapper,
    });
    scene.scheduler.requestRender.mockClear();

    radius.set(0.2);
    expect(scene.scheduler.requestRender).toHaveBeenCalledTimes(1);
    intensity.set(1);
    expect(scene.scheduler.requestRender).toHaveBeenCalledTimes(2);

    expect(scene.overlays).toHaveLength(1);
    expect(scene.unregisters.overlay).toBe(0);
  });

  // Mode 1 only: outside a scene there is no output stage to light, so the
  // component must not start a cursor of its own either.
  it('does nothing outside a ShaderScene', () => {
    const addListener = vi.spyOn(window, 'addEventListener');

    render(<CursorSpotlight />);

    expect(addListener).not.toHaveBeenCalledWith('pointermove', expect.anything());
  });
});

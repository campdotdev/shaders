// Exercises CursorSmudge through its mounted component, with the real
// scheduler and shared Input. Only the browser frame clock and three's
// renderer are substitutes; the dev probe checks the actual GPU image.
import { type ReactNode, StrictMode } from 'react';

import { cleanup, render } from '@testing-library/react';
import type { RenderTarget, WebGPURenderer } from 'three/webgpu';
import { afterEach, expect, it, vi } from 'vitest';

import { CursorInput, FrameScheduler, type PrePass, setReducedMotionPolicy } from '../../engine.js';
import {
  ShaderContext,
  type ShaderContextValue,
  type UvTransform,
} from '../../react/context/shader-context.js';
import { CursorSmudge } from './cursor-smudge.js';

// ---- Mounted scene and browser input
const disposers: Array<() => void> = [];

afterEach(() => {
  cleanup();
  for (const dispose of disposers.splice(0)) dispose();
  setReducedMotionPolicy('auto');
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// A still Source supplies its idle vote. The host draws pre-passes before
// ticking the shared cursor, in the same order as ShaderScene.
function makeScene({ scrollPush = false, floatTargets = true } = {}) {
  let now = 1000;
  let nextFrame = 0;
  const frames = new Map<number, FrameRequestCallback>();

  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.set(++nextFrame, callback);

    return nextFrame;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
  const canvas = document.createElement('canvas');
  let top = 0;

  document.body.append(canvas);
  canvas.getBoundingClientRect = () => ({ left: 0, top, width: 1000, height: 1000 }) as DOMRect;
  let target: RenderTarget | null = null;
  const draw = vi.fn();
  const renderer = {
    domElement: canvas,
    getSize: (size: { set: (x: number, y: number) => unknown }) => size.set(1000, 1000),
    render: draw,
    getRenderTarget: () => target,
    setRenderTarget: (next: RenderTarget | null) => {
      target = next;
    },
    backend: {
      isWebGLBackend: true,
      extensions: { has: (name: string) => floatTargets && name === 'EXT_color_buffer_float' },
    },
  } as unknown as WebGPURenderer;
  const scheduler = new FrameScheduler();
  const prePasses = new Set<PrePass>();
  const transforms = new Set<UvTransform>();
  const input = new CursorInput({ element: canvas });

  input.setScrollPush(scrollPush);
  input.onPushStart(() => scheduler.requestRender());
  scheduler.setIdle(true);
  scheduler.add(() => {
    for (const pass of prePasses) pass();
  });
  scheduler.add(({ delta }) => {
    if (!scrollPush) return;
    input.tick(delta);
    if (input.isPushing()) scheduler.requestRender();
  });
  const registerTransform = vi.fn((transform: UvTransform) => {
    transforms.add(transform);

    return () => {
      transforms.delete(transform);
    };
  });
  const context = {
    renderer: { three: renderer },
    scheduler,
    getCursorInput: () => input,
    registerBaseUvTransform: registerTransform,
    registerPrePass: (pass: PrePass) => {
      prePasses.add(pass);

      return () => {
        prePasses.delete(pass);
      };
    },
    canvasSize: { get: () => [1000, 1000, 1] as const, on: () => () => undefined },
  } as unknown as ShaderContextValue;

  function Wrapper({ children }: { children: ReactNode }) {
    return <ShaderContext.Provider value={context}>{children}</ShaderContext.Provider>;
  }

  scheduler.start();
  disposers.push(() => {
    scheduler.dispose();
    input.dispose();
    canvas.remove();
  });

  return {
    Wrapper,
    canvas,
    scheduler,
    draw,
    transforms,
    prePasses,
    registerTransform,
    scrollTo: (next: number) => {
      top = next;
    },
    get parked() {
      return frames.size === 0;
    },
    advance(count = 1) {
      for (let frame = 0; frame < count; frame++) {
        now += 1000 / 60;
        const queued = [...frames.values()];

        frames.clear();
        for (const callback of queued) callback(now);
      }
    },
  };
}

function move(x: number, y = 500) {
  window.dispatchEvent(
    new PointerEvent('pointermove', { clientX: x, clientY: y, pointerType: 'mouse' }),
  );
}

function stroke(scene: ReturnType<typeof makeScene>) {
  move(100);
  scene.advance(2);
  move(300);
  scene.advance(3);
}

// ---- Persistence, recovery, and scene lifecycle
it('parks a persistent smudge and wakes for another stroke', () => {
  const scene = makeScene();

  render(<CursorSmudge decay={0} />, { wrapper: scene.Wrapper });
  stroke(scene);
  expect(scene.parked).toBe(true);
  const drawsAtRest = scene.draw.mock.calls.length;

  scene.advance(3600);
  expect(scene.draw).toHaveBeenCalledTimes(drawsAtRest);
  move(500);
  scene.advance(3);
  expect(scene.draw.mock.calls.length).toBeGreaterThan(drawsAtRest);
  expect(scene.parked).toBe(true);
});

it('starts recovery when decay becomes positive without counting the idle gap', () => {
  const scene = makeScene();
  const { rerender } = render(<CursorSmudge decay={0} />, { wrapper: scene.Wrapper });

  stroke(scene);
  scene.advance(3600);
  rerender(<CursorSmudge decay={0.4} />);
  scene.advance(4);
  expect(scene.parked).toBe(false);
  scene.advance(240);
  expect(scene.parked).toBe(true);
});

it('continues recovery after an ordinary scene pause', () => {
  const scene = makeScene();

  render(<CursorSmudge />, { wrapper: scene.Wrapper });
  stroke(scene);
  expect(scene.parked).toBe(false);

  scene.scheduler.pause();
  const drawsBeforePause = scene.draw.mock.calls.length;

  scene.advance(120);
  expect(scene.draw).toHaveBeenCalledTimes(drawsBeforePause);

  scene.scheduler.resume();
  expect(scene.parked).toBe(false);
  scene.advance(2);
  expect(scene.draw.mock.calls.length).toBeGreaterThan(drawsBeforePause);
  scene.advance(240);
  expect(scene.parked).toBe(true);
});

it.each(['blur', 'pointerleave', 'pointercancel'])('starts a fresh stroke after %s', (event) => {
  const scene = makeScene();

  render(<CursorSmudge />, { wrapper: scene.Wrapper });
  stroke(scene);
  (event === 'blur' ? window : scene.canvas).dispatchEvent(new Event(event));
  scene.advance(240);
  expect(scene.parked).toBe(true);

  move(800);
  scene.advance(3);
  expect(scene.parked).toBe(true);

  move(700);
  scene.advance(3);
  expect(scene.parked).toBe(false);
});

it('clears a live smudge at zero strength and accepts fresh movement when enabled', () => {
  const scene = makeScene();
  const { rerender } = render(<CursorSmudge />, { wrapper: scene.Wrapper });

  stroke(scene);
  expect(scene.parked).toBe(false);
  rerender(<CursorSmudge strength={0} />);
  scene.advance(3);
  expect(scene.parked).toBe(true);
  stroke(scene);
  expect(scene.parked).toBe(true);

  rerender(<CursorSmudge />);
  scene.advance(3);
  expect(scene.parked).toBe(true);
  stroke(scene);
  expect(scene.parked).toBe(false);
  expect(scene.registerTransform).toHaveBeenCalledTimes(1);
});

it('survives Strict Mode and releases its scene work on unmount', () => {
  const scene = makeScene();
  const { unmount } = render(
    <StrictMode>
      <CursorSmudge />
    </StrictMode>,
    { wrapper: scene.Wrapper },
  );

  stroke(scene);
  expect(scene.parked).toBe(false);
  expect(scene.prePasses.size).toBe(1);
  expect(scene.transforms.size).toBe(1);
  unmount();
  scene.advance(3);
  const drawsAfterUnmount = scene.draw.mock.calls.length;

  stroke(scene);
  expect(scene.draw).toHaveBeenCalledTimes(drawsAfterUnmount);
  expect(scene.parked).toBe(true);
  expect(scene.prePasses.size).toBe(0);
  expect(scene.transforms.size).toBe(0);
});

it('clears instead of freezing when the reduced-motion policy is paused', () => {
  const scene = makeScene();

  render(<CursorSmudge />, { wrapper: scene.Wrapper });
  stroke(scene);
  expect(scene.parked).toBe(false);
  setReducedMotionPolicy('paused');
  scene.advance(3);
  expect(scene.parked).toBe(true);
  stroke(scene);
  expect(scene.parked).toBe(true);
  setReducedMotionPolicy('off');
  scene.advance(3);
  expect(scene.parked).toBe(true);
  stroke(scene);
  expect(scene.parked).toBe(false);
});

it.each(['off', 'slow'] as const)('recovers and parks under the %s motion policy', (policy) => {
  setReducedMotionPolicy(policy);
  const scene = makeScene();

  render(<CursorSmudge decay={1} />, { wrapper: scene.Wrapper });
  scene.advance(3);
  expect(scene.parked).toBe(true);
  stroke(scene);
  scene.advance(50);
  expect(scene.parked).toBe(policy === 'off');
  scene.advance(120);
  expect(scene.parked).toBe(true);
  const drawsAtRest = scene.draw.mock.calls.length;

  scene.advance(600);
  expect(scene.draw).toHaveBeenCalledTimes(drawsAtRest);
});

it.each([true, false])(
  'accepts touch scrolling only with scrollPush enabled (%s)',
  (scrollPush) => {
    const scene = makeScene({ scrollPush });

    render(<CursorSmudge />, { wrapper: scene.Wrapper });
    scene.advance(3);
    const drawsBeforeTouch = scene.draw.mock.calls.length;
    const touch = new Touch({ identifier: 1, target: scene.canvas, clientX: 500, clientY: 500 });
    const event = new TouchEvent('touchstart', {
      touches: [touch],
      changedTouches: [touch],
      bubbles: true,
      cancelable: true,
    });

    scene.canvas.dispatchEvent(event);
    scene.advance();
    scene.scrollTo(-30);
    scene.advance(3);
    expect(event.defaultPrevented).toBe(false);
    expect(scene.draw.mock.calls.length > drawsBeforeTouch).toBe(scrollPush);

    scene.canvas.dispatchEvent(
      new TouchEvent('touchend', { touches: [], changedTouches: [touch], bubbles: true }),
    );
    scene.advance(300);
    expect(scene.parked).toBe(true);
  },
);

it('stays inert when floating-point render targets are unavailable', () => {
  const scene = makeScene({ floatTargets: false });

  render(<CursorSmudge />, { wrapper: scene.Wrapper });
  stroke(scene);
  expect(scene.draw).not.toHaveBeenCalled();
  expect(scene.parked).toBe(true);
});

it('updates strength from an animation signal without rebuilding the UV transform', () => {
  const listeners = new Set<(value: number) => void>();
  const strength = {
    get: () => 0.12,
    on: (_event: 'change', listener: (value: number) => void) => {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
  };
  const scene = makeScene();
  const { unmount } = render(<CursorSmudge strength={strength} />, { wrapper: scene.Wrapper });

  stroke(scene);
  for (const listener of listeners) listener(0);
  scene.advance(3);
  expect(scene.parked).toBe(true);
  expect(scene.registerTransform).toHaveBeenCalledTimes(1);
  unmount();
  expect(listeners.size).toBe(0);
});

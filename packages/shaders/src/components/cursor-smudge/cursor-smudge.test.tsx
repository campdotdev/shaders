// Exercises CursorSmudge through its mounted component, with the real
// scheduler and shared Input. Only the browser frame clock and three's
// renderer are substitutes; the dev probe checks the actual GPU image.
import { type ReactNode, StrictMode } from 'react';

import { cleanup, render } from '@testing-library/react';
import type { RenderTarget, WebGPURenderer } from 'three/webgpu';
import { afterEach, expect, it, vi } from 'vitest';

import {
  CursorInput,
  FrameScheduler,
  type PrePass,
  setReducedMotionPolicy,
  type StrokePoint,
} from '../../engine.js';
import {
  type Resample,
  ShaderContext,
  type ShaderContextValue,
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
// ticking the shared cursor, in the same order as ShaderScene, and wakes
// when a `strokeAt` point moves, as ShaderScene does. A resize restarts the
// scripted stroke, then redraws the pre-passes without ticking any client,
// as ShaderScene's canvas watcher does.
function makeScene({
  scrollPush = false,
  floatTargets = true,
  strokeAt = null,
}: { scrollPush?: boolean; floatTargets?: boolean; strokeAt?: StrokePoint | null } = {}) {
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
  const resamples = new Set<Resample>();
  const input = new CursorInput({ element: canvas });
  const sizeListeners = new Set<(value: readonly [number, number, number]) => void>();

  sizeListeners.add(() => input.setStrokePoint(strokeAt));
  input.setScrollPush(scrollPush);
  input.setStrokePoint(strokeAt);
  input.onPushStart(() => scheduler.requestRender());
  const stopWatchingPoint = strokeAt?.on('change', () => scheduler.requestRender());

  scheduler.setIdle(true);
  scheduler.add(() => {
    for (const pass of prePasses) pass();
  });
  scheduler.add(({ delta }) => {
    if (!scrollPush && !strokeAt) return;
    input.tick(delta);
    if (input.isPushing()) scheduler.requestRender();
  });
  const registerResample = vi.fn((resample: Resample) => {
    resamples.add(resample);

    return () => {
      resamples.delete(resample);
    };
  });
  const context = {
    renderer: { three: renderer },
    scheduler,
    getCursorInput: () => input,
    registerResample,
    registerPrePass: (pass: PrePass) => {
      prePasses.add(pass);

      return () => {
        prePasses.delete(pass);
      };
    },
    canvasSize: {
      get: () => [1000, 1000, 1] as const,
      on: (_event: 'change', listener: (value: readonly [number, number, number]) => void) => {
        sizeListeners.add(listener);

        return () => sizeListeners.delete(listener);
      },
    },
  } as unknown as ShaderContextValue;

  function Wrapper({ children }: { children: ReactNode }) {
    return <ShaderContext.Provider value={context}>{children}</ShaderContext.Provider>;
  }

  scheduler.start();
  disposers.push(() => {
    stopWatchingPoint?.();
    scheduler.dispose();
    input.dispose();
    canvas.remove();
  });

  return {
    Wrapper,
    canvas,
    scheduler,
    draw,
    resamples,
    prePasses,
    registerResample,
    scrollTo: (next: number) => {
      top = next;
    },
    resize(width: number, height: number) {
      for (const listener of sizeListeners) listener([width, height, 1]);
      for (const pass of prePasses) pass();
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

// A point code moves, shaped like an animation signal such as Motion's
// MotionValue.
function createPoint(initial: readonly [number, number]) {
  let value = initial;
  const listeners = new Set<(next: readonly [number, number]) => void>();

  return {
    get: () => value,
    on: (_event: 'change', listener: (next: readonly [number, number]) => void) => {
      listeners.add(listener);

      return () => listeners.delete(listener);
    },
    set: (next: readonly [number, number]) => {
      value = next;
      for (const listener of listeners) listener(next);
    },
  };
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

it('pulls a fast swipe as hard after the scene parks as before', () => {
  const scene = makeScene();
  // Frames until the pull recovers and the scene parks. A stronger pull
  // takes longer to fall under the settle threshold.
  const settle = () => {
    let frames = 0;

    for (; !scene.parked && frames < 600; frames++) scene.advance();

    return frames;
  };

  render(<CursorSmudge decay={1} />, { wrapper: scene.Wrapper });
  move(100);
  scene.advance();
  move(200);
  scene.advance();
  const pulledRunning = settle();

  scene.advance(600);
  move(300);
  scene.advance();
  expect(settle()).toBe(pulledRunning);
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
  expect(scene.registerResample).toHaveBeenCalledTimes(1);
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
  expect(scene.resamples.size).toBe(1);
  unmount();
  scene.advance(3);
  const drawsAfterUnmount = scene.draw.mock.calls.length;

  stroke(scene);
  expect(scene.draw).toHaveBeenCalledTimes(drawsAfterUnmount);
  expect(scene.parked).toBe(true);
  expect(scene.prePasses.size).toBe(0);
  expect(scene.resamples.size).toBe(0);
});

it('redraws a parked scene once after removing a held smudge', () => {
  const scene = makeScene();
  const { unmount } = render(<CursorSmudge decay={0} />, { wrapper: scene.Wrapper });

  stroke(scene);
  expect(scene.parked).toBe(true);
  unmount();
  expect(scene.parked).toBe(false);
  scene.advance();
  expect(scene.parked).toBe(true);
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

// ---- Scripted strokes
it('smudges along a scripted stroke, with no pointer and no scrollPush', () => {
  const point = createPoint([0.1, 0.5]);
  const scene = makeScene({ strokeAt: point });

  render(<CursorSmudge decay={0} />, { wrapper: scene.Wrapper });
  scene.advance(3);
  const drawsAtRest = scene.draw.mock.calls.length;

  point.set([0.3, 0.5]);
  scene.advance(3);

  expect(scene.draw.mock.calls.length).toBeGreaterThan(drawsAtRest);
  expect(scene.parked).toBe(true);
});

// The segment is gathered on one frame and drawn on the next, so these
// events land between the two.
it.each(['blur', 'pointerleave', 'pointercancel'])(
  'draws a gathered scripted segment after %s',
  (event) => {
    const point = createPoint([0.1, 0.5]);
    const scene = makeScene({ strokeAt: point });

    render(<CursorSmudge decay={0} />, { wrapper: scene.Wrapper });
    scene.advance(3);
    const drawsAtRest = scene.draw.mock.calls.length;

    point.set([0.3, 0.5]);
    scene.advance();
    (event === 'blur' ? window : scene.canvas).dispatchEvent(new Event(event));
    scene.advance();

    expect(scene.draw.mock.calls.length).toBeGreaterThan(drawsAtRest);
  },
);

it('leaves the field clear when a resize lands after a scripted segment is gathered', () => {
  const point = createPoint([0.1, 0.5]);
  const scene = makeScene({ strokeAt: point });

  render(<CursorSmudge />, { wrapper: scene.Wrapper });
  scene.advance(3);
  point.set([0.3, 0.5]);
  scene.advance();
  scene.resize(800, 600);
  scene.advance();

  expect(scene.parked).toBe(true);
});

it('ignores the mouse while a scripted stroke is attached', () => {
  const point = createPoint([0.1, 0.5]);
  const scene = makeScene({ strokeAt: point });

  render(<CursorSmudge decay={0} />, { wrapper: scene.Wrapper });
  scene.advance(3);
  const drawsAtRest = scene.draw.mock.calls.length;

  stroke(scene);

  expect(scene.draw).toHaveBeenCalledTimes(drawsAtRest);
});

it('ignores a scroll push while a scripted stroke is attached', () => {
  const scene = makeScene({ scrollPush: true, strokeAt: createPoint([0.1, 0.5]) });

  render(<CursorSmudge decay={0} />, { wrapper: scene.Wrapper });
  scene.advance(3);
  const drawsAtRest = scene.draw.mock.calls.length;
  const touch = new Touch({ identifier: 1, target: scene.canvas, clientX: 500, clientY: 500 });

  scene.canvas.dispatchEvent(
    new TouchEvent('touchstart', { touches: [touch], changedTouches: [touch], bubbles: true }),
  );
  scene.advance();
  scene.scrollTo(-30);
  scene.advance(3);

  expect(scene.draw).toHaveBeenCalledTimes(drawsAtRest);
});

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
  expect(scene.registerResample).toHaveBeenCalledTimes(1);
  unmount();
  expect(listeners.size).toBe(0);
});

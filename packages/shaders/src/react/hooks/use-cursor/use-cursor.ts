'use client';

// The pointer as an animatable signal (0..1 across the scene's canvas), plus
// a `presence` signal that eases in when the pointer enters the canvas and
// out when it leaves. Inside a ShaderScene every call reads the scene's ONE
// shared CursorInput and smooths toward it at its own rate. Outside a scene,
// or with a caller-supplied element, the call owns a private input.
import { useEffect, useRef, useState } from 'react';

import { CursorInput, type CursorInputOptions, type Vector2 } from '../../../engine.js';
import { POSITION_SETTLE_THRESHOLD } from '../../../inputs/cursor-input/cursor-input.js';
import { Smoother } from '../../../inputs/cursor-input/smoother.js';
import { createSignal } from '../../internal/create-signal.js';
import type { AnimatableSignal } from '../animatable-signal/animatable-signal.js';
import { useShaderContext } from '../use-shader-context/use-shader-context.js';

export interface CursorOptions extends CursorInputOptions {
  /**
   * Whether to track the pointer at all. When false the hook attaches no
   * listener, joins no frame loop, and returns a signal fixed at `initial`
   * with presence 0, so a position prop that is not `"cursor"` costs
   * nothing. Defaults to true.
   */
  enabled?: boolean;
  /**
   * Called on every raw pointer move, before any smoothing. The latest
   * callback is always the one called, with no re-subscription.
   */
  onMove?: () => void;
}

export interface CursorSignal extends AnimatableSignal<Vector2> {
  /**
   * How present the pointer is on the canvas, 0..1. Eases toward 1 after
   * the pointer enters the canvas rect and toward 0 after it leaves, and
   * sits at 0 until the first move, so a cursor effect that multiplies its
   * strength by this is invisible on a fresh page and fades at the edge
   * rather than freezing there.
   */
  presence: AnimatableSignal<number>;
}

// ----------------------------------------------------------------------------
// Presence easing
// ----------------------------------------------------------------------------

/**
 * How much of the remaining presence gap survives one 60fps frame, 0..1.
 * With the settle threshold below, 0.63 lands a full 0-to-1 ease in 15
 * frames, a quarter second at 60fps. Raise it for a slower fade, lower it
 * for a snappier one.
 */
const PRESENCE_SMOOTHING = 0.63;

/**
 * Gap below which presence lands exactly on 0 or 1. A thousandth of full
 * strength is under one shade on an 8-bit display, so the snap cannot be
 * seen, and it is what lets the scene park a few frames after the pointer
 * settles rather than chasing float precision.
 */
const PRESENCE_SETTLE_THRESHOLD = 1e-3;

// ----------------------------------------------------------------------------
// The stub
// ----------------------------------------------------------------------------

// What the hook returns while disabled, and on the first render before its
// effect has built the live signal. It sits at the caller's `initial`, so a
// consumer that parks its point off-canvas is parked from the first value
// it reads, not at the canvas center for one pass.
const createStubSignal = (initial: Vector2): CursorSignal => ({
  get: () => initial,
  on: () => () => undefined,
  presence: {
    get: () => 0,
    on: () => () => undefined,
  },
});

const noop = () => undefined;

/** Where a call's easing starts when the caller passes no `initial`. */
const CANVAS_CENTER: Vector2 = [0.5, 0.5];

// ----------------------------------------------------------------------------
// The hook
// ----------------------------------------------------------------------------

export function useCursor(opts: CursorOptions = {}): CursorSignal {
  const shaderContext = useShaderContext();
  const [signal, setSignal] = useState<CursorSignal | null>(null);
  // Created once, at mount, so the stub reads `initial` once. The easing
  // below re-reads it whenever its effect re-runs.
  const [stubSignal] = useState(() => createStubSignal(opts.initial ?? CANVAS_CENTER));
  const onMoveRef = useRef(opts.onMove);
  const { enabled = true, element, target } = opts;

  useEffect(() => {
    onMoveRef.current = opts.onMove;
  }, [opts.onMove]);

  // ONE effect creates the input, the easings, and the tick source, and
  // returns the teardown. React 18's Strict Mode runs every effect twice on
  // mount (mount, unmount, mount); splitting create and dispose across
  // separate effects lets that double-cycle leak a listener or kill a live
  // instance. Collapsed into one effect, each cycle cleans up after itself.
  useEffect(() => {
    if (!enabled) return undefined;

    // Which input feeds this call. A caller-supplied element or event
    // target means a private input. Inside a scene it still normalizes to
    // the canvas unless the caller named an element, so overriding only
    // the event source keeps the canvas frame. Without either, the scene's
    // shared input. Outside a scene (Mode 2), a private viewport input.
    const canvas = shaderContext?.renderer.three.domElement;
    const canvasElement = canvas instanceof HTMLElement ? canvas : undefined;
    const usePrivateInput = element !== undefined || target !== undefined || !shaderContext;
    const input = usePrivateInput
      ? new CursorInput({ element: element ?? canvasElement, target })
      : shaderContext.getCursorInput();
    const scheduler = shaderContext?.scheduler;

    // This call's own easing. Both start from the caller's initial and 0,
    // not from wherever the shared pointer already is, so a consumer that
    // parks its position off-canvas stays parked until the pointer moves.
    const position = new Smoother(opts.initial ?? CANVAS_CENTER, {
      smoothing: opts.smoothing ?? 0.1,
      settleThreshold: POSITION_SETTLE_THRESHOLD,
    });
    const presence = new Smoother([0], {
      smoothing: PRESENCE_SMOOTHING,
      settleThreshold: PRESENCE_SETTLE_THRESHOLD,
    });
    const readPosition = (): Vector2 => {
      const [x, y] = position.get();

      return [x ?? 0, y ?? 0];
    };
    const readPresence = () => presence.get()[0] ?? 0;
    const positionChannel = createSignal<Vector2>(readPosition);
    const presenceChannel = createSignal<number>(readPresence);

    // Point both easings at the pointer. Returns false before the first
    // move, when there is no pointer to follow yet.
    const followTarget = (): boolean => {
      const pointer = input.getTarget();

      if (pointer === null) return false;
      position.setTarget(pointer);
      presence.setTarget([input.isInside() ? 1 : 0]);

      return true;
    };

    // --- Waking the scene ---------------------------------------------------
    // The scene renders on demand, and a static scene parks its frame loop,
    // which is also the only thing that ticks this call, so a new target
    // would otherwise sit there with nothing ever smoothing toward it or
    // drawing it. Asking for one frame breaks that loop; the tick below
    // keeps the frames coming until position and presence have settled.
    let wakeTickPending = false;
    let cursorBurstActive = false;
    // A target has landed and no tick of real length has smoothed toward
    // it yet. The scheduler's first-ever tick is zero-length, which moves
    // nothing, so this keeps the burst alive across it.
    let untickedTarget = false;

    const wake = () => {
      if (!cursorBurstActive && scheduler?.idle === true) wakeTickPending = true;
      scheduler?.requestRender();
      cursorBurstActive = true;
      untickedTarget = true;
    };

    // A call mounted after the first move has a pointer to glide toward
    // straight away, and the scene may already be parked, so it wakes on
    // mount the same way a move would.
    if (followTarget()) wake();

    const unsubscribeMove = input.onMove(() => {
      followTarget();
      wake();
      onMoveRef.current?.();
    });

    // --- Ticking ------------------------------------------------------------
    // Each tick that moves something asks for one more frame. The scene
    // adds its render client before any child hook, so a frame draws the
    // value from the previous tick: the frame requested by the tick that
    // lands on the target is the one that draws it. A settled tick asks
    // for nothing, and an otherwise static scene parks.
    const tick = (delta: number) => {
      const afterIdle = wakeTickPending;

      wakeTickPending = false;
      if (delta > 0) untickedTarget = false;
      const positionMoved = position.tick(delta, afterIdle);
      const presenceMoved = presence.tick(delta, afterIdle);

      if (positionMoved) {
        const snapshot = readPosition();

        for (const listener of positionChannel.listeners) listener(snapshot);
      }
      if (presenceMoved) {
        const snapshot = readPresence();

        for (const listener of presenceChannel.listeners) listener(snapshot);
      }
      cursorBurstActive = positionMoved || presenceMoved || untickedTarget;
      if (cursorBurstActive) scheduler?.requestRender();
    };

    setSignal({ ...positionChannel.signal, presence: presenceChannel.signal });

    // The easing needs a steady tick. Inside a ShaderScene, ride the scene's
    // frame scheduler; outside one (Mode 2), run a private rAF loop.
    let detach: () => void = noop;

    if (scheduler) {
      const schedulerTickHandler = ({ delta }: { delta: number }) => tick(delta);

      scheduler.add(schedulerTickHandler);
      detach = () => scheduler.remove(schedulerTickHandler);
    } else {
      let animationFrameId: number | null = null;
      let lastNow = performance.now();
      const loop = (now: number) => {
        const delta = (now - lastNow) / 1000;

        lastNow = now;
        tick(delta);
        // Mode 2 has no renderer of ours to hand a setAnimationLoop callback
        // to; this loop only advances cursor smoothing, and the scheduler
        // branch above takes over whenever a ShaderScene owns the frame.
        // react-doctor-disable-next-line react-doctor/three-prefer-set-animation-loop
        animationFrameId = requestAnimationFrame(loop);
      };

      // The loop IS cancelled: cleanup calls detach(), which cancels the most
      // recently scheduled frame. The detector can't follow the cancellation
      // through the closure variable.
      // react-doctor-disable-next-line react-doctor/effect-raf-loop-needs-cancel
      animationFrameId = requestAnimationFrame(loop);
      detach = () => {
        if (animationFrameId !== null) cancelAnimationFrame(animationFrameId);
      };
    }

    // --- Teardown -----------------------------------------------------------
    return () => {
      detach();
      unsubscribeMove();
      // The shared input belongs to the scene and outlives this call.
      if (usePrivateInput) input.dispose();
      positionChannel.listeners.clear();
      presenceChannel.listeners.clear();
      setSignal(null);
    };
    // smoothing and initial are read once at creation, as they always were:
    // a consumer that wants a new rate remounts. element and target are
    // deps, because a new frame needs a new input, so pass them as stable
    // references rather than fresh objects per render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shaderContext, enabled, element, target]);

  return signal ?? stubSignal;
}

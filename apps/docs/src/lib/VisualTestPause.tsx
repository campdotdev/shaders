'use client';

import { useEffect } from 'react';

import {
  type ReducedMotionPolicy,
  resetRendererClock,
  type SchedulerTick,
  setReducedMotionPolicy,
  useShaderContext,
} from '@camp-dev/shaders';

const TARGET_FRAME = 2;

const QUERY_FLAG = 'visualTest';
const REDUCED_MOTION_FLAG = 'reducedMotion';
const POINTER_FLAG = 'pointer';
const VALID_POLICIES: ReducedMotionPolicy[] = ['auto', 'off', 'slow', 'paused'];

/**
 * How long the scene keeps drawing after the spec's pointer move before the
 * capture, in milliseconds. A cursor effect eases its position and presence
 * toward the pointer and then lands exactly on both, so once settled the
 * frame no longer depends on how many frames ran. The slowest consumer, the
 * spotlight at 0.65 smoothing, lands on the pointer in about a third of a
 * second; a full second leaves room for SwiftShader's slow frames on CI.
 */
const POINTER_SETTLE_MS = 1000;

const isReducedMotionPolicy = (policyName: string): policyName is ReducedMotionPolicy =>
  (VALID_POLICIES as readonly string[]).includes(policyName);

declare global {
  interface Window {
    __shadersTestReady?: boolean;
    /**
     * Set under `?pointer=1` once the scene's cursor listeners are attached,
     * so a spec knows its pointer move will be heard.
     */
    __shadersTestAwaitingPointer?: boolean;
  }
}

function useVisualTestPause(): void {
  const ctx = useShaderContext();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);

    if (params.get(QUERY_FLAG) !== '1') return;
    if (!ctx) return;

    const policyParam = params.get(REDUCED_MOTION_FLAG);
    const policy: ReducedMotionPolicy =
      policyParam !== null && isReducedMotionPolicy(policyParam) ? policyParam : 'paused';

    setReducedMotionPolicy(policy);

    const releaseAnimated = ctx.scheduler.setIdle(false);

    // Pointer mode, for cursor effects: the capture waits for the spec to
    // move the pointer, then for the effect to settle on it. VisualTestPause
    // loads through next/dynamic and mounts as the scene's last child, so
    // any useCursor in the scene has already attached its window listener
    // by the time the flag goes up.
    const awaitPointer = params.get(POINTER_FLAG) === '1';
    let pointerMovedAt: number | null = null;
    const onPointerMove = () => {
      pointerMovedAt ??= performance.now();
    };

    if (awaitPointer) {
      window.addEventListener('pointermove', onPointerMove);
      window.__shadersTestAwaitingPointer = true;
    }

    const settled = (now: number) =>
      !awaitPointer || (pointerMovedAt !== null && now - pointerMovedAt >= POINTER_SETTLE_MS);

    let frame = 0;
    const client = ({ now }: SchedulerTick) => {
      frame += 1;

      if (frame === 1) {
        // Two time sources feed the shaders and both must rewind for the
        // captured frame to be reproducible: the renderer clock (elapsedTime)
        // and the CPU-side phase accumulators (useAnimatableSpeed), which
        // integrate wall-clock deltas from mount and would otherwise carry a
        // load-timing-dependent residual into the screenshot.
        resetRendererClock(ctx.renderer.three);
        ctx.scheduler.resetPhases();

        return;
      }

      if (frame > TARGET_FRAME && settled(now)) {
        ctx.scheduler.remove(client);
        ctx.scheduler.pause();
        window.__shadersTestReady = true;
      }
    };

    ctx.scheduler.add(client);

    return () => {
      ctx.scheduler.remove(client);
      window.removeEventListener('pointermove', onPointerMove);
      if (awaitPointer) window.__shadersTestAwaitingPointer = false;
      releaseAnimated();
    };
  }, [ctx]);
}

export default function VisualTestPause(): null {
  useVisualTestPause();

  return null;
}

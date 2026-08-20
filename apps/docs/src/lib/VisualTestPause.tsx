'use client';

import { useEffect } from 'react';

import { resetRendererClock, setReducedMotionPolicy } from '@mattermix/shaders';
import type { ReducedMotionPolicy, SchedulerTick } from '@mattermix/shaders';
import { useShaderContext } from '@mattermix/shaders-react';

const TARGET_FRAME = 2;

const QUERY_FLAG = 'visualTest';
const REDUCED_MOTION_FLAG = 'reducedMotion';
const VALID_POLICIES: ReducedMotionPolicy[] = ['auto', 'off', 'slow', 'paused'];

const isReducedMotionPolicy = (policyName: string): policyName is ReducedMotionPolicy =>
  (VALID_POLICIES as readonly string[]).includes(policyName);

declare global {
  interface Window {
    __shadersTestReady?: boolean;
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

    let frame = 0;
    const client = (_tick: SchedulerTick) => {
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

      if (frame > TARGET_FRAME) {
        ctx.scheduler.remove(client);
        ctx.scheduler.pause();
        window.__shadersTestReady = true;
      }
    };

    ctx.scheduler.add(client);

    return () => {
      ctx.scheduler.remove(client);
      releaseAnimated();
    };
  }, [ctx]);
}

export default function VisualTestPause(): null {
  useVisualTestPause();

  return null;
}

'use client';

import { useEffect } from 'react';

import { setReducedMotionPolicy } from '@lovo/matter';
import type { ReducedMotionPolicy, SchedulerTick } from '@lovo/matter';
import { useShaderContext } from '@lovo/matter-react';

const TARGET_FRAME = 2;

const QUERY_FLAG = 'visualTest';
const REDUCED_MOTION_FLAG = 'reducedMotion';
const VALID_POLICIES: ReducedMotionPolicy[] = ['auto', 'off', 'slow', 'paused'];

const isReducedMotionPolicy = (policyName: string): policyName is ReducedMotionPolicy =>
  (VALID_POLICIES as readonly string[]).includes(policyName);

declare global {
  interface Window {
    __matterTestReady?: boolean;
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

    interface NodeFrameInternal {
      time?: number;
      deltaTime?: number;
      lastTime?: number;
    }
    const getNodeFrame = (): NodeFrameInternal | undefined => {
      const three: unknown = ctx.renderer.three;

      if (!(typeof three === 'object' && three !== null && '_nodes' in three)) return undefined;
      const nodes = three._nodes;

      if (!(typeof nodes === 'object' && nodes !== null && 'nodeFrame' in nodes)) return undefined;
      const frame = nodes.nodeFrame;

      if (typeof frame !== 'object' || frame === null) return undefined;

      return frame;
    };

    let frame = 0;
    const client = (_tick: SchedulerTick) => {
      frame += 1;

      if (frame === 1) {
        const nodeFrame = getNodeFrame();

        if (nodeFrame) {
          nodeFrame.time = 0;
          nodeFrame.deltaTime = 0;
          nodeFrame.lastTime = undefined;
        }

        return;
      }

      if (frame > TARGET_FRAME) {
        ctx.scheduler.remove(client);
        ctx.scheduler.pause();
        window.__matterTestReady = true;
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

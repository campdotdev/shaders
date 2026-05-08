'use client'

// This file is the real implementation. It imports from @lovo/matter-react
// which transitively pulls in three/webgpu. Never statically import this from
// a page — use the dynamic re-export in visualTestHooks.ts instead so that
// Next.js does not attempt to prerender it on the server.

import { useEffect } from 'react'
import { useMatterContext } from '@lovo/matter-react'
import type { SchedulerTick } from '@lovo/matter'

// Number of renderer frames to wait after context init before screenshotting.
// 2 frames is enough for the TSL material to compile and produce a stable
// raster while keeping `time` near zero.
const TARGET_FRAME = 2
const QUERY_FLAG = 'visualTest'

/**
 * If the page is loaded with `?visualTest=1`, pauses the scheduler after
 * `TARGET_FRAME` renderer ticks and sets `window.__matterTestReady = true`.
 * Playwright waits for that flag before screenshotting.
 *
 * Implementation notes:
 * - Resets the Three.js NodeFrame elapsed time to 0 before counting frames so
 *   that animated shaders using the `time` TSL node produce identical output
 *   regardless of how long the page took to initialize. This is the determinism
 *   fix for components like Waves (speed=1) whose output is sensitive to time.
 * - Calls `scheduler.setIdle(false)` so that static components (e.g.
 *   LinearGradient at speed=0, which calls useStaticHint(true)) don't halt
 *   the rAF loop before the frame target is reached.
 * - Uses scheduler ticks (not raw rAF) so the frame count is tied to actual
 *   renderer frames.
 *
 * Must be rendered as a child of a registry component (inside its MatterScene)
 * so that useMatterContext() can find the scene context.
 */
export function useVisualTestPause(): void {
  const ctx = useMatterContext()
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    if (params.get(QUERY_FLAG) !== '1') return
    if (!ctx) return

    // Reset the Three.js NodeFrame elapsed time to zero. This ensures that
    // TSL's `time` uniform reads as 0 (or very close to 0) for the first
    // captured frame, making animated shaders deterministic regardless of
    // page initialization latency.
    // NodeFrame is a private implementation detail of WebGPURenderer; the
    // accessor path is stable across three@0.170.x.
    const nodeFrame = (
      ctx.renderer.three as unknown as {
        _nodes?: { nodeFrame?: { time?: number; deltaTime?: number; lastTime?: number } }
      }
    )._nodes?.nodeFrame
    if (nodeFrame) {
      nodeFrame.time = 0
      nodeFrame.deltaTime = 0
      // Reset lastTime so the next update() recomputes delta from now.
      nodeFrame.lastTime = undefined as unknown as number
    }

    // Wake the scheduler in case a static component has already idled it.
    ctx.scheduler.setIdle(false)

    let frame = 0
    const client = (_tick: SchedulerTick) => {
      frame += 1
      if (frame >= TARGET_FRAME) {
        ctx.scheduler.remove(client)
        ctx.scheduler.pause()
        ;(window as unknown as { __matterTestReady: boolean }).__matterTestReady = true
      }
    }
    ctx.scheduler.add(client)

    return () => {
      ctx.scheduler.remove(client)
    }
  }, [ctx])
}

/**
 * Renders nothing. Pauses the scheduler at frame 60 when `?visualTest=1` is
 * in the URL, then signals `window.__matterTestReady = true` for Playwright.
 */
export default function VisualTestPause(): null {
  useVisualTestPause()
  return null
}

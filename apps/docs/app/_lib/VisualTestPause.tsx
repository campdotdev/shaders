'use client'

// This file is the real implementation. It imports from @lovo/matter-react
// which transitively pulls in three/webgpu. Never statically import this from
// a page — use the dynamic re-export in visualTestHooks.ts instead so that
// Next.js does not attempt to prerender it on the server.

import { useEffect } from 'react'
import { useMatterContext } from '@lovo/matter-react'
import { setReducedMotionPolicy } from '@lovo/matter'
import type { SchedulerTick, ReducedMotionPolicy } from '@lovo/matter'

// Number of renderer frames to wait after context init before screenshotting.
// 2 frames is enough for the TSL material to compile and produce a stable
// raster while keeping `time` near zero.
const TARGET_FRAME = 2

/**
 * URL query flags supported by this hook:
 *
 * - `?visualTest=1`
 *   Pauses the scheduler after TARGET_FRAME renderer ticks and sets
 *   `window.__matterTestReady = true`. Playwright waits for that flag before
 *   screenshotting.
 *
 * - `?reducedMotion=<policy>`
 *   Overrides the reduced-motion policy. Valid values: `auto` | `off` | `slow`
 *   | `paused`. When `?visualTest=1` is set, this defaults to `paused` (so the
 *   gated `time` re-export evaluates to 0 in TSL chains, removing platform
 *   jitter at sub-pixel boundaries — the only known cross-platform divergence
 *   source for animated shaders). Pass an explicit override to opt out
 *   (`?reducedMotion=auto` for live time, etc.).
 */
const QUERY_FLAG = 'visualTest'
const REDUCED_MOTION_FLAG = 'reducedMotion'
const VALID_POLICIES: ReducedMotionPolicy[] = ['auto', 'off', 'slow', 'paused']

/**
 * If the page is loaded with `?visualTest=1`, pauses the scheduler after
 * `TARGET_FRAME` renderer ticks and sets `window.__matterTestReady = true`.
 * Playwright waits for that flag before screenshotting.
 *
 * Implementation notes:
 * - Resets the Three.js NodeFrame elapsed time to 0 on the FIRST scheduler
 *   tick (not in the effect body). This is critical: `_nodes.nodeFrame` is
 *   populated lazily by Three.js during the first `render()` call. Resetting
 *   it in the effect body risks a race where `nodeFrame` is null and the reset
 *   is silently skipped, leaving `time` at whatever value has accumulated since
 *   page load. By resetting inside the client on frame 1 (which fires AFTER the
 *   renderer's render() call in the same rAF cycle), we guarantee the node
 *   frame exists. The screenshot is captured at frame TARGET_FRAME + 1 so the
 *   renderer gets one full frame after the reset with time starting near 0.
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

    // Apply reduced-motion policy BEFORE the scheduler starts. Default to
    // `paused` for visual tests: gating `time` to 0 in TSL chains is the only
    // way to get pixel-identical output across platforms (Linux/macOS Chromium
    // have ~ms-level init jitter that NodeFrame.time reset can't fully absorb).
    // Explicit `?reducedMotion=<policy>` overrides this default.
    const policyParam = params.get(REDUCED_MOTION_FLAG)
    const policy: ReducedMotionPolicy =
      policyParam && (VALID_POLICIES as string[]).includes(policyParam)
        ? (policyParam as ReducedMotionPolicy)
        : 'paused'
    setReducedMotionPolicy(policy)

    // Wake the scheduler in case a static component has already idled it.
    ctx.scheduler.setIdle(false)

    type NodeFrameInternal = { time?: number; deltaTime?: number; lastTime?: number }
    const getNodeFrame = (): NodeFrameInternal | undefined =>
      (
        ctx.renderer.three as unknown as {
          _nodes?: { nodeFrame?: NodeFrameInternal }
        }
      )._nodes?.nodeFrame

    let frame = 0
    const client = (_tick: SchedulerTick) => {
      frame += 1

      if (frame === 1) {
        // Reset NodeFrame elapsed time to 0 on the first tick, AFTER the
        // renderer has called render() in this same rAF cycle (and therefore
        // after Three.js has had a chance to populate _nodes.nodeFrame).
        // Resetting here rather than in the effect body avoids the race where
        // nodeFrame is null at effect-fire time (Three.js populates it lazily
        // on the first render call).
        const nodeFrame = getNodeFrame()
        if (nodeFrame) {
          nodeFrame.time = 0
          nodeFrame.deltaTime = 0
          // Reset lastTime so the next update() recomputes delta from now.
          nodeFrame.lastTime = undefined as unknown as number
        }
        return
      }

      if (frame > TARGET_FRAME) {
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

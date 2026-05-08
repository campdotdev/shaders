'use client'

// This file is the real implementation. It imports from @lovo/matter-react
// which transitively pulls in three/webgpu. Never statically import this from
// a page — use the dynamic re-export in visualTestHooks.ts instead so that
// Next.js does not attempt to prerender it on the server.

import { useEffect } from 'react'
import { useMatterContext } from '@lovo/matter-react'
import type { SchedulerTick } from '@lovo/matter'

const TARGET_FRAME = 60
const QUERY_FLAG = 'visualTest'

/**
 * If the page is loaded with `?visualTest=1`, pauses the scheduler at frame
 * `TARGET_FRAME` and sets `window.__matterTestReady = true`. Playwright waits
 * for that flag before screenshotting.
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

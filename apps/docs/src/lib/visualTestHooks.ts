'use client'

// Re-exports VisualTestPause via next/dynamic so pages that import from here
// do not pull three/webgpu into the SSR bundle. The actual hook lives in
// VisualTestPause.tsx — never statically import that file from a page.

import dynamic from 'next/dynamic'

/**
 * A no-op component that, when rendered as a child of a registry component
 * (inside its ShaderScene), pauses the scheduler at frame 60 when
 * `?visualTest=1` is in the URL and sets `window.__matterTestReady = true`.
 *
 * Import this from visualTestHooks — not directly from VisualTestPause.tsx —
 * to keep three/webgpu out of the SSR bundle.
 *
 * Usage:
 *   import { VisualTestPause } from '@/lib/visualTestHooks'
 *
 *   <LinearGradient ...>
 *     <VisualTestPause />
 *   </LinearGradient>
 */
export const VisualTestPause = dynamic(() => import('./VisualTestPause').then((m) => m.default), {
  ssr: false,
})

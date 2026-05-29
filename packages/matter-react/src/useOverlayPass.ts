'use client'

import { useContext, useEffect, type DependencyList } from 'react'
import { MatterContext, type OverlayTransform } from './matter-context.js'

/**
 * Register a TSL transform as an overlay pass on the parent <MatterScene>.
 *
 * The transform takes the "color so far" — base scene + any earlier
 * overlays as a TSL vec4 node — and returns a modified vec4. Registration
 * happens on mount; unregistration on unmount. The hook re-registers
 * whenever any value in `deps` changes (useEffect semantics): use this
 * for structural changes (e.g., a `mode: 'centered' | 'subtractive'`
 * toggle) that swap the transform function itself. Uniforms captured
 * inside the transform mutate in place, so uniform value changes do
 * NOT need to be in deps.
 *
 * When called outside a <MatterScene> provider, this hook is a no-op.
 * Matches the existing useMatterContext convention.
 */
export function useOverlayPass(transform: OverlayTransform, deps: DependencyList): void {
  const ctx = useContext(MatterContext)

  useEffect(() => {
    if (!ctx) return
    const unregister = ctx.registerOverlay(transform)
    return unregister
    // The transform captures the latest values via the deps array; we re-register
    // when deps change. ctx is included so a remounted MatterScene re-attaches.
    // oxlint-disable-next-line react/exhaustive-deps
  }, [ctx, ...deps])
}

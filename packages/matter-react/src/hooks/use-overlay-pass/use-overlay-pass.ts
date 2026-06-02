'use client'

import { type DependencyList, useEffect } from 'react'

import type { OverlayTransform } from '../../context/matter-context.js'
import { useShaderContext } from '../use-matter-context/use-matter-context.js'

/**
 * Register a TSL transform as an overlay pass on the parent <ShaderScene>.
 *
 * The transform takes the "color so far" — base scene + any earlier
 * overlays as a TSL vec4 node — and returns a modified vec4. Registration
 * happens on mount; unregistration on unmount. The hook re-registers
 * whenever any value in `deps` changes (useEffect semantics): use this
 * for structural changes (e.g., a `mode: 'additive' | 'subtractive'`
 * toggle) that swap the transform function itself. Uniforms captured
 * inside the transform mutate in place, so uniform value changes do
 * NOT need to be in deps.
 *
 * When called outside a <ShaderScene> provider, this hook is a no-op.
 * Matches the existing useShaderContext convention.
 */
export function useOverlayPass(transform: OverlayTransform, deps: DependencyList): void {
  const ctx = useShaderContext()

  useEffect(() => {
    if (!ctx) return
    const unregister = ctx.registerOverlay(transform)

    return unregister
    // The transform captures the latest values via the deps array; we re-register
    // when deps change. ctx is included so a remounted ShaderScene re-attaches.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, ...deps])
}

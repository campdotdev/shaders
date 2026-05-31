'use client'

import { MatterScene, useCursor, useMatterContext } from '@lovo/matter-react'
import { useEffect, useMemo } from 'react'
import { uniform } from 'three/tsl'
import { Mesh, MeshBasicNodeMaterial, PlaneGeometry, Vector2 } from 'three/webgpu'

import { RECIPE_BUILDS } from '@/app/recipes/_builds'

interface RecipeSceneProps {
  slug: string
  variant: string
}

// Inner scene — wraps <MatterScene> and dispatches the live build callback by
// composite key '<slug>.<variant>'. Lives in a separate file from
// RecipeViewer because three/webgpu pulls in `self` at module load (breaks
// SSR). The Server page can't ssr-disable a dynamic import directly anymore
// in Next 15, so RecipeViewer is the Client host that ssr-disables this
// module.
export function RecipeScene({ slug, variant }: RecipeSceneProps) {
  return (
    <MatterScene>
      <RecipeMesh slug={slug} variant={variant} />
    </MatterScene>
  )
}

function RecipeMesh({ slug, variant }: { slug: string; variant: string }) {
  const ctx = useMatterContext()
  const cursor = useCursor()

  // Cursor uniform — UV-space, y flipped from DOM-space. Pattern lifted from
  // registry/aurora.tsx: cursorVec is a stable Vector2 that the cursor's
  // 'change' callback mutates in place, and cursorUniform is the TSL uniform
  // wrapping that same vector. useMemo with a stable [] dep means the
  // identity survives Strict Mode's mount→unmount→mount cycle (gotcha #14).
  const cursorVec = useMemo(() => new Vector2(0.5, 0.5), [])
  const cursorUniform = useMemo(() => uniform(cursorVec), [cursorVec])

  // Cursor listener lives in its own effect with a cleanup so each Strict
  // Mode lifecycle creates+destroys the subscription cleanly. cursor.on
  // returns an unsub fn (or the inert STUB_SIGNAL's no-op before the
  // CursorInput is ready) — both are safe to invoke on cleanup.
  useEffect(() => {
    return cursor.on('change', ([x, y]) => cursorVec.set(x, 1 - y))
  }, [cursor, cursorVec])

  // Mesh lifecycle in its own effect — when slug, variant, or ctx changes,
  // we tear down the old colorNode/material/mesh and rebuild. The dispose
  // try/catch mirrors registry components: three's WebGPURenderer
  // occasionally throws inside material.dispose() during rapid rebuilds;
  // swallowing is benign.
  useEffect(() => {
    if (!ctx) return
    const key = `${slug}.${variant}`
    const build = RECIPE_BUILDS[key]

    if (!build) return

    const colorNode = build({ cursorUniform })
    const material = new MeshBasicNodeMaterial()

    material.colorNode = colorNode

    const mesh = new Mesh(new PlaneGeometry(2, 2), material)

    ctx.scene.add(mesh)

    return () => {
      ctx.scene.remove(mesh)
      try {
        material.dispose()
      } catch {
        /* benign during rebuild */
      }
      try {
        mesh.geometry.dispose()
      } catch {
        /* same */
      }
    }
  }, [ctx, slug, variant, cursorUniform])

  return null
}

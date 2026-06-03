'use client'

import { ShaderScene, useCursor, useShaderContext } from '@lovo/matter-react'
import { useEffect, useMemo } from 'react'
import { uniform } from 'three/tsl'
import { Vector2 } from 'three/webgpu'

import { RECIPE_BUILDS } from '@/app/recipes/_builds'
import { addPlaneMesh } from '@/lib/meshUtils'

interface RecipeSceneProps {
  slug: string
  variant: string
}

export function RecipeScene({ slug, variant }: RecipeSceneProps) {
  return (
    <ShaderScene>
      <RecipeMesh slug={slug} variant={variant} />
    </ShaderScene>
  )
}

function RecipeMesh({ slug, variant }: { slug: string; variant: string }) {
  const ctx = useShaderContext()
  const cursor = useCursor()

  const cursorVec = useMemo(() => new Vector2(0.5, 0.5), [])
  const cursorUniform = useMemo(() => uniform(cursorVec), [cursorVec])

  useEffect(() => {
    return cursor.on('change', ([x, y]) => cursorVec.set(x, 1 - y))
  }, [cursor, cursorVec])

  useEffect(() => {
    if (!ctx) return
    const key = `${slug}.${variant}`
    const build = RECIPE_BUILDS[key]

    if (!build) return

    const colorNode = build({ cursorUniform })

    return addPlaneMesh(ctx, colorNode)
  }, [ctx, slug, variant, cursorUniform])

  return null
}

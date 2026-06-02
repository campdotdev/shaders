'use client'

import dynamic from 'next/dynamic'

interface RecipeViewerProps {
  slug: string
  /**
   * Variant key (e.g. 'canonical', 'square', 'pinpoint'). Composed with slug
   * to look up RECIPE_BUILDS via key '<slug>.<variant>'.
   */
  variant: string
  /**
   * When true, skip the framed/bordered host div — the parent owns the
   * frame (e.g. the variant card). Default false renders the standalone
   * 320px frame used by the per-recipe canonical preview.
   */
  unframed?: boolean
}

// RecipeScene pulls in three/webgpu transitively (via @lovo/matter-react's
// ShaderScene), and three/webgpu touches `self` at module load — that breaks
// SSR. `ssr: false` is no longer allowed in Server Components in Next 15, so
// this Client host owns the dynamic import. Mirrors PrimitiveDemo's pattern.
const RecipeScene = dynamic(() => import('./RecipeScene').then((m) => m.RecipeScene), {
  ssr: false,
})

export function RecipeViewer({ slug, variant, unframed = false }: RecipeViewerProps) {
  if (unframed) {
    // Variant cards on the recipe page own their own height/frame; we just
    // mount the scene and let it fill the parent.
    return <RecipeScene slug={slug} variant={variant} />
  }

  return (
    <div
      style={{
        position: 'relative',
        height: 320,
        background: '#0a0a14',
        borderRadius: 8,
        overflow: 'hidden',
        border: '1px solid var(--border)',
      }}
    >
      <RecipeScene slug={slug} variant={variant} />
    </div>
  )
}

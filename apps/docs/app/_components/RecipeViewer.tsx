'use client'

import dynamic from 'next/dynamic'

interface RecipeViewerProps {
  slug: string
}

// RecipeScene pulls in three/webgpu transitively (via @lovo/matter-react's
// MatterScene), and three/webgpu touches `self` at module load — that breaks
// SSR. `ssr: false` is no longer allowed in Server Components in Next 15, so
// this Client host owns the dynamic import. Mirrors PrimitiveDemo's pattern.
const RecipeScene = dynamic(
  () => import('./RecipeScene').then((m) => m.RecipeScene),
  { ssr: false },
)

export function RecipeViewer({ slug }: RecipeViewerProps) {
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
      <RecipeScene slug={slug} />
    </div>
  )
}

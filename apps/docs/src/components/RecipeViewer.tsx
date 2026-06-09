'use client';

import dynamic from 'next/dynamic';

interface RecipeViewerProps {
  slug: string;
  variant: string;
  unframed?: boolean;
}

const RecipeScene = dynamic(() => import('./RecipeScene').then((m) => m.RecipeScene), {
  ssr: false,
});

export function RecipeViewer({ slug, variant, unframed = false }: RecipeViewerProps) {
  if (unframed) {
    return <RecipeScene slug={slug} variant={variant} />;
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
  );
}

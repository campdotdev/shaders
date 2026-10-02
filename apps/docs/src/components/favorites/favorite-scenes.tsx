'use client';

/**
 * Each favorite's live scene: the same scene module its component page
 * renders, at its demo defaults, so a favorite cannot drift from its page.
 * Keyed by FavoriteSlug, so a favorite added in content/homepage.ts with no
 * scene here fails the type check. Each module loads behind next/dynamic with
 * `ssr: false` (the SSR gotcha in docs/agents/docs-site.md), on the first
 * hover that asks for it.
 */
import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';

import godRaysStyles from '@/app/components/god-rays/demo.module.css';
import waveLinesStyles from '@/app/components/wave-lines/demo.module.css';
import type { FavoriteSlug } from '@/content/homepage';

// What a favorite renders its scene with: no props, so every scene module
// falls back to its demo defaults. Each dynamic() call names this type,
// because a scene module's props type, with its `= {}` default, includes
// undefined, which ComponentType's class half rejects.
type NoProps = Record<string, never>;

interface FavoriteScene {
  Scene: ComponentType<NoProps>;
  /**
   * The demo's backdrop class, for a component that draws over a transparent
   * ground, so the scene sits on the same backdrop as on its own page.
   */
  backdrop?: string;
}

export const FAVORITE_SCENES: Record<FavoriteSlug, FavoriteScene> = {
  'simplex-noise': {
    Scene: dynamic<NoProps>(() => import('@/app/components/simplex-noise/scene'), { ssr: false }),
  },
  'mesh-gradient': {
    Scene: dynamic<NoProps>(() => import('@/app/components/mesh-gradient/scene'), { ssr: false }),
  },
  'wave-lines': {
    Scene: dynamic<NoProps>(() => import('@/app/components/wave-lines/scene'), { ssr: false }),
    backdrop: waveLinesStyles.demoBackdrop,
  },
  voronoi: {
    Scene: dynamic<NoProps>(() => import('@/app/components/voronoi/scene'), { ssr: false }),
  },
  dither: {
    Scene: dynamic<NoProps>(() => import('@/app/components/dither/scene'), { ssr: false }),
  },
  'god-rays': {
    Scene: dynamic<NoProps>(() => import('@/app/components/god-rays/scene'), { ssr: false }),
    backdrop: godRaysStyles.demoBackdrop,
  },
  'led-wall': {
    Scene: dynamic<NoProps>(() => import('@/app/components/led-wall/scene'), { ssr: false }),
  },
};

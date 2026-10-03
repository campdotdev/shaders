'use client';

/**
 * Each favorite's live scene: the scene module its component page renders,
 * at its demo defaults, keyed by FavoriteSlug so a favorite added in
 * content/homepage.ts with no scene here fails the type check. favorites-
 * list.tsx preloads them all and renders one with useFavoriteScene.
 */
import { type ComponentType, useEffect, useState } from 'react';

import godRaysStyles from '@/app/components/god-rays/demo.module.css';
import waveLinesStyles from '@/app/components/wave-lines/demo.module.css';
import type { FavoriteSlug } from '@/content/homepage';

// What a favorite renders its scene with: no params, so every scene module
// falls back to its demo defaults, and whether the scene is paused.
interface SceneProps {
  paused: boolean;
}

type Scene = ComponentType<SceneProps>;

interface FavoriteScene {
  /** Loads the scene's module. */
  load: () => Promise<{ default: Scene }>;
  /**
   * The demo's backdrop class, for a component that draws over a transparent
   * ground, so the scene sits on the same backdrop as on its own page.
   */
  backdrop?: string;
}

const FAVORITE_SCENES: Record<FavoriteSlug, FavoriteScene> = {
  'simplex-noise': { load: () => import('@/app/components/simplex-noise/scene') },
  'mesh-gradient': { load: () => import('@/app/components/mesh-gradient/scene') },
  'wave-lines': {
    load: () => import('@/app/components/wave-lines/scene'),
    backdrop: waveLinesStyles.demoBackdrop,
  },
  voronoi: { load: () => import('@/app/components/voronoi/scene') },
  dither: { load: () => import('@/app/components/dither/scene') },
  'god-rays': {
    load: () => import('@/app/components/god-rays/scene'),
    backdrop: godRaysStyles.demoBackdrop,
  },
  'led-wall': { load: () => import('@/app/components/led-wall/scene') },
};

// ---------------------------------------------
// Loading, once per scene
// ---------------------------------------------

// The modules load through a plain import() rather than next/dynamic, which
// is React.lazy underneath. A lazy component suspends on its first render
// even when its module has already loaded, and React then holds the reveal
// back by 300ms, so every first hover waited that long. The import() still
// runs only in the browser, from an effect or the preload, which keeps three
// out of the server render (the SSR gotcha in docs/agents/docs-site.md).

// The component of every scene whose module has loaded, so a render can
// read it straight away.
const loadedScenes = new Map<FavoriteScene, Scene>();

function loadScene(favoriteScene: FavoriteScene): Promise<Scene> {
  return favoriteScene.load().then((module) => {
    loadedScenes.set(favoriteScene, module.default);

    return module.default;
  });
}

/** Loads every favorite's scene module ahead of its first hover. */
export function preloadFavoriteScenes(): void {
  for (const favoriteScene of Object.values(FAVORITE_SCENES)) {
    // A failed preload leaves the module for the hover to load.
    loadScene(favoriteScene).catch(() => undefined);
  }
}

/** The demo backdrop class a favorite's scene sits on, if its demo has one. */
export function favoriteSceneBackdrop(slug: FavoriteSlug): string | undefined {
  return FAVORITE_SCENES[slug].backdrop;
}

/**
 * A favorite's scene component, or null until its module has loaded. A
 * preloaded scene is there on the first render, so a hover mounts its canvas
 * in the same commit.
 */
export function useFavoriteScene(slug: FavoriteSlug): Scene | null {
  const favoriteScene = FAVORITE_SCENES[slug];
  const [scene, setScene] = useState(() => loadedScenes.get(favoriteScene) ?? null);

  useEffect(() => {
    if (scene) return;

    let cancelled = false;

    void loadScene(favoriteScene)
      // A module that fails to load leaves the favorite on its poster.
      .catch(() => null)
      .then((loaded) => {
        if (!cancelled && loaded) setScene(() => loaded);
      });

    return () => {
      cancelled = true;
    };
  }, [favoriteScene, scene]);

  return scene;
}

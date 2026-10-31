'use client';

/**
 * The Gallery's plain grid, until the author designs it: a card per
 * composition with its poster, title, and description, linking to its page.
 * A card plays live under the pointer or keyboard focus, through the hover
 * logic the homepage favorites share (lib/use-live-on-hover.ts).
 */
import Image from 'next/image';
import Link from 'next/link';
import { useId, useRef } from 'react';

import { ShaderPoster } from '@camp-dev/shaders/poster';

import type { CompositionScene as CompositionSceneComponent } from '@/compositions/composition-scene';
import type { Composition } from '@/compositions/define';
import { compositionPoster } from '@/compositions/posters';
import {
  engagementHandlers,
  type OnEngagedChange,
  useLiveOnHover,
  useLoadedScene,
} from '@/lib/use-live-on-hover';

import styles from './page.module.css';

export function GalleryGrid({ compositions }: { compositions: readonly Composition[] }) {
  const listRef = useRef<HTMLUListElement>(null);
  const { canGoLive, mountedSlugs, playingSlug, setEngaged } = useLiveOnHover<string>(
    listRef,
    preloadCompositionScene,
  );

  return (
    <ul className={styles.grid} ref={listRef}>
      {compositions.map((composition) => (
        <li key={composition.slug}>
          <GalleryCard
            composition={composition}
            onEngagedChange={(engagement, engaged) =>
              setEngaged(composition.slug, engagement, engaged)
            }
            playing={composition.slug === playingSlug}
            sceneMounted={canGoLive && mountedSlugs.has(composition.slug)}
          />
        </li>
      ))}
    </ul>
  );
}

// The whole card is the link. Its name is the title alone and the
// description is attached as the link's description, as on the components
// index, so a screen reader says the title and then the description. The
// poster repeats the title in pictures, so its alt is empty. ShaderPoster
// keeps it over the window until the live scene's first frame.
function GalleryCard({
  composition,
  sceneMounted,
  playing,
  onEngagedChange,
}: {
  composition: Composition;
  sceneMounted: boolean;
  playing: boolean;
  onEngagedChange: OnEngagedChange;
}) {
  const id = useId();
  const titleId = `${id}-title`;
  const descriptionId = `${id}-description`;

  return (
    <Link
      aria-describedby={descriptionId}
      aria-labelledby={titleId}
      className={styles.card}
      href={`/gallery/${composition.slug}`}
      {...engagementHandlers(onEngagedChange)}
    >
      <div className={styles.window}>
        <ShaderPoster
          poster={
            // No `sizes`, for the reason favorites-list.tsx gives: image
            // optimization is off for the static export.
            // react-doctor-disable-next-line react-doctor/nextjs-image-missing-sizes
            <Image
              alt=""
              className={styles.poster}
              fill
              src={compositionPoster(composition.slug)}
            />
          }
        >
          {sceneMounted && <LiveScene composition={composition} paused={!playing} />}
        </ShaderPoster>
      </div>
      <span className={styles.title} id={titleId}>
        {composition.title}
      </span>
      <span className={styles.description} id={descriptionId}>
        {composition.description}
      </span>
    </Link>
  );
}

// `data-paused` mirrors the scene's pause for the Playwright spec, as the
// favorites' scene layer does.
function LiveScene({ composition, paused }: { composition: Composition; paused: boolean }) {
  const Scene = useCompositionScene();

  return (
    <div aria-hidden className={styles.scene} data-paused={paused || undefined}>
      {Scene && <Scene composition={composition} paused={paused} />}
    </div>
  );
}

// ---------------------------------------------
// Loading the renderer, once
// ---------------------------------------------
// Every composition shares the one renderer module. It loads through
// import(), from the preload or a hover's effect, so three stays out of the
// server render (the SSR gotcha in docs/agents/docs-site.md);
// useLoadedScene says why not next/dynamic.

type Scene = typeof CompositionSceneComponent;

let loadedScene: Scene | null = null;

function loadCompositionScene(): Promise<Scene> {
  return import('@/compositions/composition-scene').then((module) => {
    loadedScene = module.CompositionScene;

    return module.CompositionScene;
  });
}

/** Loads the renderer ahead of the first hover. A failure leaves it for the hover. */
function preloadCompositionScene(): void {
  loadCompositionScene().catch(() => undefined);
}

/** The renderer, or null until its module has loaded. */
const useCompositionScene = () => useLoadedScene(loadedScene, loadCompositionScene);

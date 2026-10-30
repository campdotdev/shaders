'use client';

/**
 * The favorites' cards, and the hover that brings one to life. Hovering or
 * focusing a card mounts its live scene under the poster, which fades on the
 * scene's first frame, and shows its card tab (card-tab.tsx). The scene
 * plays while the pointer or keyboard focus is on its card, then stays
 * paused on its last frame. One plays at a time, and the homepage hero
 * pauses while it does. The Gallery grid shares the hover logic, which lives
 * in lib/use-live-on-hover.ts.
 */
import Image from 'next/image';
import Link from 'next/link';
import { type CSSProperties, type RefObject, useEffect, useRef, useState } from 'react';

import { ShaderPoster } from '@camp-dev/shaders/poster';

import { useHeroPause } from '@/components/home-hero/hero-pause';
import type { Favorite, FavoriteSlug } from '@/content/homepage';
import { type Engagement, engagementHandlers, useLiveOnHover } from '@/lib/use-live-on-hover';

import { CardTab } from './card-tab';
import { favoriteSceneBackdrop, preloadFavoriteScenes, useFavoriteScene } from './favorite-scenes';
import styles from './favorites.module.css';

// A card's place in the grid's reveal (favorites.module.css): the heading
// goes first, at 0, so the cards count from 1.
type RevealStyle = CSSProperties & { '--reveal-index': number };

function revealStyle(index: number): RevealStyle {
  return { '--reveal-index': index + 1 };
}

// ---------------------------------------------
// The list: which favorites are mounted, and which one plays
// ---------------------------------------------

// useLiveOnHover decides which favorites are mounted and which one plays. A
// favorite's card tab mounts on its first hover or focus too, without
// waiting on the WebGPU gate, and stays mounted, so it can slide back out
// when the card is let go and slide in again from wherever it is.
export function FavoritesList({
  favorites,
  labelledBy,
}: {
  favorites: Favorite[];
  labelledBy: string;
}) {
  const listRef = useRef<HTMLUListElement>(null);
  const { canGoLive, mountedSlugs, playingSlug, isEngaged, setEngaged } =
    useLiveOnHover<FavoriteSlug>(listRef, preloadFavoriteScenes);

  usePauseHeroWhilePlaying(canGoLive && playingSlug !== null);

  return (
    <ul aria-labelledby={labelledBy} className={styles.list} ref={listRef}>
      {favorites.map((favorite, index) => (
        <li key={favorite.url} style={revealStyle(index)}>
          <FavoriteCard
            cardTabMounted={mountedSlugs.has(favorite.slug)}
            engaged={isEngaged(favorite.slug)}
            favorite={favorite}
            onEngagedChange={(engagement, engaged) =>
              setEngaged(favorite.slug, engagement, engaged)
            }
            playing={favorite.slug === playingSlug}
            sceneMounted={canGoLive && mountedSlugs.has(favorite.slug)}
          />
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------
// The card: the poster, and the live scene under it
// ---------------------------------------------

// The whole card is the link, and the poster's alt is the component's label,
// so the link's name is the label and a screen reader says "Simplex Noise,
// link". The poster stays in place, faded, while the scene plays, so the name
// holds. engagementHandlers keeps a tap from taking the card live.
function FavoriteCard({
  favorite,
  engaged,
  cardTabMounted,
  sceneMounted,
  playing,
  onEngagedChange,
}: {
  favorite: Favorite;
  /** Whether the pointer or keyboard focus is on the card, which shows its card tab. */
  engaged: boolean;
  cardTabMounted: boolean;
  sceneMounted: boolean;
  playing: boolean;
  onEngagedChange: (engagement: Engagement, engaged: boolean) => void;
}) {
  return (
    <Link className={styles.card} href={favorite.url} {...engagementHandlers(onEngagedChange)}>
      <div className={styles.window}>
        {sceneMounted && <LiveScene paused={!playing} slug={favorite.slug} />}
        {/* No `sizes`: next.config.ts turns image optimization off for the
            static export, so next/image renders a plain `<img>` with no
            srcset for `sizes` to pick from. If optimization comes on, add
            `sizes` to match the grid's columns in favorites.module.css. */}
        {/* react-doctor-disable-next-line react-doctor/nextjs-image-missing-sizes */}
        <Image alt={favorite.label} className={styles.poster} fill src={favorite.poster} />
        {cardTabMounted && <CardTab shortName={favorite.shortName} shown={engaged} />}
      </div>
    </Link>
  );
}

// The scene, on its demo's backdrop, with `data-scene` saying whether its
// first frame is on screen yet. favorites.module.css fades the card's poster
// on "painted", and the Playwright spec reads it too, along with
// `data-paused`. The state lives here, so every mount starts from "loading".
// A paused scene keeps its last frame on the canvas, and ShaderScene stops
// its clock, so it resumes on the same frame.
//
// ShaderPoster is what learns of the first frame: ShaderScene tells the
// nearest one, which then drops its poster. The poster here is an empty
// marker, so its unmount is the signal. If the renderer is ever rebuilt, as
// on a display gamut change, ShaderPoster puts the marker back and the card's
// poster returns until the new renderer paints.
//
// The scene renders at SCENE_SIZE and is scaled to cover the card's window,
// the way the poster is, so the two shrink together on a narrower card.
// Rendered at the window's own size instead, a component that sizes its
// pattern in CSS pixels, such as Dither's cells or LED Wall's dots, would
// keep its pattern full size while the poster's shrank.
function LiveScene({ slug, paused }: { slug: FavoriteSlug; paused: boolean }) {
  const Scene = useFavoriteScene(slug);
  const backdrop = favoriteSceneBackdrop(slug);
  const [painted, setPainted] = useState(false);
  const sceneRef = useRef<HTMLDivElement>(null);

  useCoverScale(sceneRef);

  return (
    <div
      aria-hidden
      className={`${styles.scene} ${backdrop ?? styles.ground}`}
      data-paused={paused || undefined}
      data-scene={painted ? 'painted' : 'loading'}
      ref={sceneRef}
      style={{ width: SCENE_SIZE.width, height: SCENE_SIZE.height }}
    >
      {Scene && (
        <ShaderPoster poster={<UntilFirstPaint onPaintedChange={setPainted} />}>
          <Scene paused={paused} />
        </ShaderPoster>
      )}
    </div>
  );
}

// The size every favorite renders at, in CSS pixels, and the size
// scripts/build-posters.sh captures every favorite's card poster at. It is
// the card window's size at the grid's full 1440px, where useCoverScale
// leaves the scene at a scale of 1, so Dither's and LED Wall's cells, which
// are sized in CSS pixels, show at their real size. Four narrower columns
// scale it down. Larger would draw more pixels than the window shows, and
// smaller would scale the scene up, which softens it. The two-column and
// one-column grids already scale it up at their wider widths, as far as
// about 1.8 times for the 579 by 427 window at 639px. A change to the
// grid's width or the card's padding moves the window, so change this with
// it and recapture the card posters.
const SCENE_SIZE = { width: 320, height: 233 };

/**
 * Scales the scene to cover its window, the way `object-fit: cover` scales
 * the poster: up or down until both sides fill it, centered, with the
 * overflow cropped. Written straight to the element's `scale`, so a resize
 * re-renders nothing.
 */
function useCoverScale(sceneRef: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const scene = sceneRef.current;
    const sceneWindow = scene?.parentElement;

    if (!scene || !sceneWindow) return;

    const observer = new ResizeObserver(() => {
      scene.style.scale = String(
        Math.max(
          sceneWindow.clientWidth / SCENE_SIZE.width,
          sceneWindow.clientHeight / SCENE_SIZE.height,
        ),
      );
    });

    observer.observe(sceneWindow);

    return () => observer.disconnect();
  }, [sceneRef]);
}

function UntilFirstPaint({ onPaintedChange }: { onPaintedChange: (painted: boolean) => void }) {
  useEffect(() => {
    onPaintedChange(false);

    return () => onPaintedChange(true);
  }, [onPaintedChange]);

  return null;
}

// ---------------------------------------------
// Pausing the hero while a favorite plays
// ---------------------------------------------

/**
 * Pauses the homepage hero while a favorite plays, for the reason
 * components/home-hero/hero-pause.ts gives. A favorite plays only once
 * useLiveOnHover's gate opens, so with no WebGPU the hero keeps drawing.
 */
function usePauseHeroWhilePlaying(playing: boolean) {
  const heroPause = useHeroPause();

  useEffect(() => {
    if (!playing || !heroPause) return undefined;
    heroPause.setPaused(true);

    return () => heroPause.setPaused(false);
  }, [playing, heroPause]);
}

'use client';

/**
 * The favorites' cards, and the hover that brings one to life. Hovering or
 * focusing a card mounts its live scene under the poster, which fades on the
 * scene's first frame. The scene plays while the pointer or keyboard focus
 * is on its card, then stays paused on its last frame. One plays at a time.
 */
import Image from 'next/image';
import Link from 'next/link';
import {
  type CSSProperties,
  type RefObject,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';

import { ShaderPoster } from '@camp-dev/shaders/poster';

import type { Favorite, FavoriteSlug } from '@/content/homepage';

import { favoriteSceneBackdrop, preloadFavoriteScenes, useFavoriteScene } from './favorite-scenes';
import styles from './favorites.module.css';

// The width each poster renders at, per the grid's columns in
// favorites.module.css, so next/image picks a file no larger than it needs.
const POSTER_SIZES = '(width < 40rem) 100vw, (width < 64rem) 50vw, 25vw';

// A card's place in the grid's reveal (favorites.module.css): the heading
// goes first, at 0, so the cards count from 1.
type RevealStyle = CSSProperties & { '--reveal-index': number };

function revealStyle(index: number): RevealStyle {
  return { '--reveal-index': index + 1 };
}

// ---------------------------------------------
// The list: which favorites are mounted, and which one plays
// ---------------------------------------------

/** What brought a visitor to a card: the pointer, or keyboard focus. */
type Engagement = 'pointer' | 'focus';

// Every favorite a visitor has hovered or focused keeps its scene mounted,
// paused on the frame it stopped on, so its card never falls back to the
// poster, and coming back resumes it at once. Each mounted scene holds a
// renderer, so the page can hold one per favorite, but a paused one does no
// GPU work. Only the most recently engaged favorite plays, and only while
// the pointer or keyboard focus is still on it. When that one is let go, a
// favorite the other input is still on plays instead.
//
// Engagement is tracked before the gate opens, so a card hovered or focused
// while the WebGPU adapter is still on its way goes live once it arrives.
export function FavoritesList({
  favorites,
  labelledBy,
}: {
  favorites: Favorite[];
  labelledBy: string;
}) {
  const canGoLive = useCanGoLive();
  const listRef = useRef<HTMLUListElement>(null);
  const [mountedSlugs, setMountedSlugs] = useState<ReadonlySet<FavoriteSlug>>(() => new Set());
  const [lastEngagedSlug, setLastEngagedSlug] = useState<FavoriteSlug | null>(null);
  // The favorite under the pointer and the favorite with keyboard focus, each
  // null when there is none. The last engaged favorite plays while either is
  // still on it, and otherwise whichever one is still engaged.
  const [hoveredSlug, setHoveredSlug] = useState<FavoriteSlug | null>(null);
  const [focusedSlug, setFocusedSlug] = useState<FavoriteSlug | null>(null);
  const playingSlug =
    lastEngagedSlug !== null && (hoveredSlug === lastEngagedSlug || focusedSlug === lastEngagedSlug)
      ? lastEngagedSlug
      : (hoveredSlug ?? focusedSlug);

  usePreloadScenesNearView(listRef, canGoLive);

  const setEngaged = (slug: FavoriteSlug, engagement: Engagement, engaged: boolean) => {
    const setSlug = engagement === 'pointer' ? setHoveredSlug : setFocusedSlug;

    if (engaged) {
      setLastEngagedSlug(slug);
      setMountedSlugs((current) => (current.has(slug) ? current : new Set(current).add(slug)));
      setSlug(slug);
    } else {
      setSlug((current) => (current === slug ? null : current));
    }
  };

  return (
    <ul aria-labelledby={labelledBy} className={styles.list} ref={listRef}>
      {favorites.map((favorite, index) => (
        <li key={favorite.url} style={revealStyle(index)}>
          <FavoriteCard
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
// holds.
//
// A tap never takes a card live, even on a touch-screen laptop that passes
// the hover gate, because the tap is on its way to the component page. The
// pointer checks skip a touch's pointerenter and pointerleave. The
// :focus-visible check skips the focus a tap or a click gives the link, and
// keeps keyboard focus.
function FavoriteCard({
  favorite,
  sceneMounted,
  playing,
  onEngagedChange,
}: {
  favorite: Favorite;
  sceneMounted: boolean;
  playing: boolean;
  onEngagedChange: ((engagement: Engagement, engaged: boolean) => void) | undefined;
}) {
  return (
    <Link
      className={styles.card}
      href={favorite.url}
      onBlur={() => onEngagedChange?.('focus', false)}
      onFocus={(event) => {
        if (event.currentTarget.matches(':focus-visible')) onEngagedChange?.('focus', true);
      }}
      onPointerEnter={(event) => {
        if (event.pointerType !== 'touch') onEngagedChange?.('pointer', true);
      }}
      onPointerLeave={(event) => {
        if (event.pointerType !== 'touch') onEngagedChange?.('pointer', false);
      }}
    >
      <div className={styles.window}>
        {sceneMounted && <LiveScene paused={!playing} slug={favorite.slug} />}
        <Image
          alt={favorite.label}
          className={styles.poster}
          fill
          sizes={POSTER_SIZES}
          src={favorite.poster}
        />
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

// The card window's size at the site container's full width, in CSS pixels.
// Every favorite renders at this size, and scripts/build-posters.sh captures
// every favorite's card poster at it.
const SCENE_SIZE = { width: 376, height: 275 };

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
// Preloading: the scenes' code, before the first hover
// ---------------------------------------------

// How far outside the viewport the cards are when their scenes start to
// load, in CSS pixels. Larger loads them sooner on the way down the page.
const PRELOAD_MARGIN = '200px';

/**
 * Loads every favorite's scene module once the cards come within
 * PRELOAD_MARGIN of the viewport, the way next/link prefetches a page in
 * view, so a first hover mounts its canvas at once rather than waiting on
 * the code. It loads code only: a renderer starts on a favorite's first
 * hover, so a favorite never hovered costs nothing on the GPU. The list is
 * `display: contents` and has no box to observe, so its first card stands in
 * for it.
 */
function usePreloadScenesNearView(listRef: RefObject<HTMLUListElement | null>, enabled: boolean) {
  useEffect(() => {
    const firstCard = listRef.current?.firstElementChild;

    if (!enabled || !firstCard) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        preloadFavoriteScenes();
      },
      { rootMargin: PRELOAD_MARGIN },
    );

    observer.observe(firstCard);

    return () => observer.disconnect();
  }, [listRef, enabled]);
}

// ---------------------------------------------
// The gate: a mouse or trackpad, and a WebGPU adapter
// ---------------------------------------------

// The site's hover gate, the same query the stylesheets put hover styles
// behind. A phone or tablet fails it, so its favorites stay posters.
const HOVER_QUERY = '(hover: hover) and (pointer: fine)';

function subscribeToHoverQuery(onChange: () => void): () => void {
  const query = window.matchMedia(HOVER_QUERY);

  query.addEventListener('change', onChange);

  return () => query.removeEventListener('change', onChange);
}

const readHoverQuery = () => window.matchMedia(HOVER_QUERY).matches;

// The server has no pointer to ask about, and the posters are the safe
// answer, so it renders every favorite at rest.
const readServerHoverQuery = () => false;

/**
 * True where a favorite may mount its scene: the device can hover, and the
 * browser hands out a WebGPU adapter. Without one, ShaderScene would fall
 * back to WebGL2, and the favorites stay posters instead. Only a device that
 * can hover asks for the adapter.
 */
function useCanGoLive(): boolean {
  const canHover = useSyncExternalStore(
    subscribeToHoverQuery,
    readHoverQuery,
    readServerHoverQuery,
  );
  const [hasWebGpu, setHasWebGpu] = useState(false);

  useEffect(() => {
    // navigator.gpu is typed as always present, but it is missing in a
    // browser without WebGPU and outside a secure context, so probe with `in`.
    if (!canHover || !('gpu' in navigator)) return;

    let cancelled = false;

    void navigator.gpu
      .requestAdapter()
      // A browser that refuses the request has no WebGPU to offer either.
      .catch(() => null)
      .then((adapter) => {
        if (!cancelled) setHasWebGpu(adapter !== null);
      });

    return () => {
      cancelled = true;
    };
  }, [canHover]);

  return canHover && hasWebGpu;
}

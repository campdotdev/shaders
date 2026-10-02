'use client';

/**
 * The favorites' cards, and the hover that brings one to life. At rest each
 * card is its poster. Hovering or focusing a card mounts its live scene under
 * the poster, and the poster fades once the scene's first frame is on
 * screen. The list holds at most one live scene, so the page never runs more
 * than the hero's renderer and one favorite's. favorites.tsx renders this
 * inside the section and its heading.
 */
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState, useSyncExternalStore } from 'react';

import { ShaderPoster } from '@camp-dev/shaders/poster';

import type { Favorite, FavoriteSlug } from '@/content/homepage';

import { FAVORITE_SCENES } from './favorite-scenes';
import styles from './favorites.module.css';

// The width each poster renders at, per the grid's columns in
// favorites.module.css, so next/image picks a file no larger than it needs.
const POSTER_SIZES = '(width < 40rem) 100vw, (width < 64rem) 50vw, 25vw';

// ---------------------------------------------
// The list: which favorite is live
// ---------------------------------------------

// A live scene stays mounted after the pointer leaves, until another favorite
// takes over. Coming back to the same favorite is then instant, with no
// renderer to start, and the page still holds one favorite's renderer at
// most. Unmounting on leave would start a renderer on every hover.
export function FavoritesList({
  favorites,
  labelledBy,
}: {
  favorites: Favorite[];
  labelledBy: string;
}) {
  const canGoLive = useCanGoLive();
  const [liveSlug, setLiveSlug] = useState<FavoriteSlug | null>(null);

  return (
    <ul aria-labelledby={labelledBy} className={styles.list}>
      {favorites.map((favorite) => (
        <li key={favorite.url}>
          <FavoriteCard
            favorite={favorite}
            live={canGoLive && favorite.slug === liveSlug}
            onGoLive={canGoLive ? () => setLiveSlug(favorite.slug) : undefined}
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
// pointer check skips a touch's pointerenter. The :focus-visible check skips
// the focus a tap or a click gives the link, and keeps keyboard focus.
function FavoriteCard({
  favorite,
  live,
  onGoLive,
}: {
  favorite: Favorite;
  live: boolean;
  onGoLive: (() => void) | undefined;
}) {
  return (
    <Link
      className={styles.card}
      href={favorite.url}
      onFocus={(event) => {
        if (event.currentTarget.matches(':focus-visible')) onGoLive?.();
      }}
      onPointerEnter={(event) => {
        if (event.pointerType !== 'touch') onGoLive?.();
      }}
    >
      <div className={styles.window}>
        {live && <LiveScene slug={favorite.slug} />}
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
// on "painted", and the Playwright spec reads it too. The state lives here, so
// every mount starts from "loading".
//
// ShaderPoster is what learns of the first frame: ShaderScene tells the
// nearest one, which then drops its poster. The poster here is an empty
// marker, so its unmount is the signal. If the renderer is ever rebuilt, as
// on a display gamut change, ShaderPoster puts the marker back and the card's
// poster returns until the new renderer paints.
function LiveScene({ slug }: { slug: FavoriteSlug }) {
  const { Scene, backdrop } = FAVORITE_SCENES[slug];
  const [painted, setPainted] = useState(false);

  return (
    <div
      aria-hidden
      className={`${styles.scene} ${backdrop ?? styles.ground}`}
      data-scene={painted ? 'painted' : 'loading'}
    >
      <ShaderPoster poster={<UntilFirstPaint onPaintedChange={setPainted} />}>
        <Scene />
      </ShaderPoster>
    </div>
  );
}

function UntilFirstPaint({ onPaintedChange }: { onPaintedChange: (painted: boolean) => void }) {
  useEffect(() => {
    onPaintedChange(false);

    return () => onPaintedChange(true);
  }, [onPaintedChange]);

  return null;
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

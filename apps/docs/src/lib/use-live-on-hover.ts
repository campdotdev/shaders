'use client';

/**
 * Live-on-hover for a grid of shader cards, shared by the homepage favorites
 * and the Gallery grid. Hovering or focusing a card mounts its scene, which
 * stays mounted and paused once let go, and one plays at a time. Without a
 * hovering pointer or a WebGPU adapter, every card stays a poster.
 */
import { type FocusEvent, type PointerEvent, type RefObject, useEffect, useState } from 'react';

import { useCanHover } from './use-can-hover';

/** What brought a visitor to a card: the pointer, or keyboard focus. */
export type Engagement = 'pointer' | 'focus';

/** Hears a card gain or lose the pointer or keyboard focus. */
export type OnEngagedChange = (engagement: Engagement, engaged: boolean) => void;

export interface LiveOnHover<Slug extends string> {
  /** Whether cards may mount scenes at all; see useCanGoLive below. */
  canGoLive: boolean;
  /** Every card hovered or focused at least once. Its scene stays mounted. */
  mountedSlugs: ReadonlySet<Slug>;
  /** The card whose scene plays, or null. Every other mounted scene is paused. */
  playingSlug: Slug | null;
  /** Whether the pointer or keyboard focus is on the card right now. */
  isEngaged: (slug: Slug) => boolean;
  /** Reports a card gaining or losing the pointer or keyboard focus. */
  setEngaged: (slug: Slug, engagement: Engagement, engaged: boolean) => void;
}

// ---------------------------------------------
// Which cards are mounted, and which one plays
// ---------------------------------------------

// Every card a visitor has hovered or focused keeps its scene mounted, paused
// on the frame it stopped on, so it never falls back to its poster, and
// coming back resumes it at once. Each mounted scene holds a renderer, but a
// paused one does no GPU work. Only the most recently engaged card plays, and
// only while the pointer or keyboard focus is still on it. When that one is
// let go, a card the other input is still on plays instead.
//
// Engagement is tracked before the gate opens, so a card hovered or focused
// while the WebGPU adapter is still on its way goes live once it arrives.
export function useLiveOnHover<Slug extends string>(
  listRef: RefObject<HTMLElement | null>,
  preload: () => void,
): LiveOnHover<Slug> {
  const canGoLive = useCanGoLive();
  const [mountedSlugs, setMountedSlugs] = useState<ReadonlySet<Slug>>(() => new Set());
  const [lastEngagedSlug, setLastEngagedSlug] = useState<Slug | null>(null);
  // The card under the pointer and the card with keyboard focus, each null
  // when there is none.
  const [hoveredSlug, setHoveredSlug] = useState<Slug | null>(null);
  const [focusedSlug, setFocusedSlug] = useState<Slug | null>(null);
  const playingSlug =
    lastEngagedSlug !== null && (hoveredSlug === lastEngagedSlug || focusedSlug === lastEngagedSlug)
      ? lastEngagedSlug
      : (hoveredSlug ?? focusedSlug);

  usePreloadScenesNearView(listRef, canGoLive, preload);

  const setEngaged = (slug: Slug, engagement: Engagement, engaged: boolean) => {
    const setSlug = engagement === 'pointer' ? setHoveredSlug : setFocusedSlug;

    if (engaged) {
      setLastEngagedSlug(slug);
      setMountedSlugs((current) => (current.has(slug) ? current : new Set(current).add(slug)));
      setSlug(slug);
    } else {
      setSlug((current) => (current === slug ? null : current));
    }
  };

  return {
    canGoLive,
    mountedSlugs,
    playingSlug,
    isEngaged: (slug) => slug === hoveredSlug || slug === focusedSlug,
    setEngaged,
  };
}

/**
 * The handlers a card's link takes to report its engagement. A tap never
 * takes a card live, even on a touch-screen laptop that passes the hover
 * gate, because the tap is on its way to the card's page. The pointer
 * handlers skip a touch's pointerenter and pointerleave, and the focus
 * handler skips the focus a tap or a click gives the link, keeping keyboard
 * focus only.
 */
export function engagementHandlers(onEngagedChange: OnEngagedChange) {
  return {
    onBlur: () => onEngagedChange('focus', false),
    onFocus: (event: FocusEvent<HTMLElement>) => {
      if (event.currentTarget.matches(':focus-visible')) onEngagedChange('focus', true);
    },
    onPointerEnter: (event: PointerEvent<HTMLElement>) => {
      if (event.pointerType !== 'touch') onEngagedChange('pointer', true);
    },
    onPointerLeave: (event: PointerEvent<HTMLElement>) => {
      if (event.pointerType !== 'touch') onEngagedChange('pointer', false);
    },
  };
}

// ---------------------------------------------
// Loading a scene's code
// ---------------------------------------------

/**
 * A scene component that loads through import(), or null until it has.
 * `cached` is the component when its module has already loaded, from the
 * preload or an earlier card, so the first render has it and a hover mounts
 * its canvas in the same commit. A plain import() rather than next/dynamic,
 * which is React.lazy underneath: a lazy component suspends on its first
 * render even when its module has loaded, and React then holds the reveal
 * back by 300ms. A module that fails to load leaves the card on its poster.
 * `load` must keep its identity across renders.
 */
export function useLoadedScene<Scene>(
  cached: Scene | null,
  load: () => Promise<Scene>,
): Scene | null {
  const [scene, setScene] = useState(() => cached);

  useEffect(() => {
    if (scene !== null) return;

    let cancelled = false;

    void load()
      .catch(() => null)
      .then((loaded) => {
        // The updater form, because a component is itself a function.
        if (!cancelled && loaded !== null) setScene(() => loaded);
      });

    return () => {
      cancelled = true;
    };
  }, [load, scene]);

  return scene;
}

// ---------------------------------------------
// Preloading: the scenes' code, before the first hover
// ---------------------------------------------

// How far outside the viewport the cards are when their scenes start to
// load, in CSS pixels. Larger loads them sooner on the way down the page.
const PRELOAD_MARGIN = '200px';

/**
 * Runs `preload` once the cards come within PRELOAD_MARGIN of the viewport,
 * the way next/link prefetches a page in view, so a first hover mounts its
 * canvas at once rather than waiting on the code. It loads code only: a
 * renderer starts on a card's first hover, so a card never hovered costs
 * nothing on the GPU. The first card stands in for the list, because the
 * favorites' list is `display: contents` and has no box to observe.
 */
function usePreloadScenesNearView(
  listRef: RefObject<HTMLElement | null>,
  enabled: boolean,
  preload: () => void,
) {
  useEffect(() => {
    const firstCard = listRef.current?.firstElementChild;

    if (!enabled || !firstCard) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        preload();
      },
      { rootMargin: PRELOAD_MARGIN },
    );

    observer.observe(firstCard);

    return () => observer.disconnect();
  }, [listRef, enabled, preload]);
}

// ---------------------------------------------
// The gate: a mouse or trackpad, and a WebGPU adapter
// ---------------------------------------------

/**
 * True where a card may mount its scene: the device passes the site's hover
 * gate (lib/use-can-hover.ts), and the browser hands out a WebGPU adapter. A
 * phone or tablet fails the gate, so its cards stay posters. Without an
 * adapter, ShaderScene would fall back to WebGL2, and the cards stay posters
 * instead. Only a device that can hover asks for the adapter.
 */
function useCanGoLive(): boolean {
  const canHover = useCanHover();
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

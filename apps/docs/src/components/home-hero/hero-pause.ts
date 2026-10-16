/**
 * Lets what rides in the homepage hero's pin pause the hero's scene. A
 * playing favorite pauses it (components/favorites/favorites-list.tsx): at
 * 2x on an M1 Max, the hero and Voronoi, the most expensive favorite, took
 * about 7 ms of GPU time a frame together, over SHA-203's 4 ms limit. A
 * feature card's live story pauses it too (components/features).
 */
import { createContext, useContext, useEffect, useSyncExternalStore } from 'react';

export interface HeroPause {
  /**
   * Pauses the hero's scene, and returns the release. The hero stays paused
   * until every pause is released, so a favorite and a feature card's story
   * that overlap never resume it under each other. A release counts once.
   */
  pause: () => () => void;
  /** Calls `onChange` whenever the hero pauses or resumes, and returns the unsubscribe. */
  subscribe: (onChange: () => void) => () => void;
  isPaused: () => boolean;
}

/** The hero creates one and reads it through useIsHeroPaused, so a pause re-renders only its scene. */
export function createHeroPause(): HeroPause {
  let pauses = 0;
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) listener();
  };

  return {
    pause() {
      let released = false;

      pauses += 1;
      if (pauses === 1) notify();

      return () => {
        if (released) return;
        released = true;
        pauses -= 1;
        if (pauses === 0) notify();
      };
    },
    subscribe(onChange) {
      listeners.add(onChange);

      return () => listeners.delete(onChange);
    },
    isPaused: () => pauses > 0,
  };
}

// Nothing pauses the hero before the page hydrates.
const readServerPaused = () => false;

/** Whether the hero's scene is paused. The caller re-renders when that changes. */
export function useIsHeroPaused(heroPause: HeroPause): boolean {
  return useSyncExternalStore(heroPause.subscribe, heroPause.isPaused, readServerPaused);
}

/** The hero's pause, for what rides in its pin. Null outside the hero, where there is nothing to pause. */
export const HeroPauseContext = createContext<HeroPause | null>(null);

function useHeroPause() {
  return useContext(HeroPauseContext);
}

/** Pauses the hero while `paused` holds, from inside the hero's pin. */
export function usePauseHeroWhile(paused: boolean) {
  const heroPause = useHeroPause();

  useEffect(() => (paused && heroPause ? heroPause.pause() : undefined), [paused, heroPause]);
}

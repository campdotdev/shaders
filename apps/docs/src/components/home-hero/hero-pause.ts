/**
 * Lets what rides in the homepage hero's pin pause the hero's scene. A
 * playing favorite pauses it (components/favorites/favorites-list.tsx): at
 * 2x on an M1 Max, the hero and Voronoi, the most expensive favorite, took
 * about 7 ms of GPU time a frame together, over SHA-203's 4 ms limit.
 */
import { createContext, useContext, useSyncExternalStore } from 'react';

export interface HeroPause {
  /** Pauses the hero's scene, or lets it play again. */
  setPaused: (paused: boolean) => void;
  /** Calls `onChange` whenever the hero pauses or resumes, and returns the unsubscribe. */
  subscribe: (onChange: () => void) => () => void;
  isPaused: () => boolean;
}

/** The hero creates one and reads it through useIsHeroPaused, so a pause re-renders only its scene. */
export function createHeroPause(): HeroPause {
  let paused = false;
  const listeners = new Set<() => void>();

  return {
    setPaused(next) {
      if (next === paused) return;
      paused = next;
      for (const listener of listeners) listener();
    },
    subscribe(onChange) {
      listeners.add(onChange);

      return () => listeners.delete(onChange);
    },
    isPaused: () => paused,
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

export function useHeroPause() {
  return useContext(HeroPauseContext);
}

/**
 * The homepage hero's scroll progress, shared with what rides in its pin:
 * 0 at the top of the page to 1 where the pin releases, as the demo lands.
 * The favorites' reveal follows it so their last card lands with the demo
 * (components/favorites/favorites-reveal.tsx). It is null wherever the hero
 * doesn't pin, so a reader knows to play on its own clock instead.
 */
import { createContext, useContext } from 'react';

import type { MotionValue } from 'motion/react';

export const HeroProgressContext = createContext<MotionValue<number> | null>(null);

export function useHeroProgress() {
  return useContext(HeroProgressContext);
}

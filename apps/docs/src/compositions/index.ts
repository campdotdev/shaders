/**
 * The composition registry. Its order is the Gallery's order, and the
 * composition pages build their static params from it. Every document here
 * is three-free, so server code reads the registry directly: the page's
 * metadata and the Gallery grid.
 */
import { bitComet } from './bit-comet/composition';
import type { Composition } from './define';
import { reededGlass } from './reeded-glass/composition';

export const COMPOSITIONS: readonly Composition[] = [reededGlass, bitComet];

/** The composition with this slug, or undefined when there is none. */
export function findComposition(slug: string): Composition | undefined {
  return COMPOSITIONS.find((composition) => composition.slug === slug);
}

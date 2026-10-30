/**
 * The composition registry. Its order is the Gallery's order, and the
 * composition pages build their static params from it. Every document here
 * is three-free, so server code reads the registry directly: the page's
 * metadata, the Gallery grid, and the "Used in" strip on reference pages.
 */
import type { Composition } from './define';
import { fixture } from './fixture/composition';

export const COMPOSITIONS: readonly Composition[] = [fixture];

/**
 * The compositions whose stack includes the component exported as
 * `componentName`, in Gallery order. A reference page's "Used in" strip
 * lists them.
 */
export function compositionsUsing(
  componentName: string,
  compositions: readonly Composition[] = COMPOSITIONS,
): Composition[] {
  return compositions.filter(({ stack }) =>
    stack.some(({ component }) => component === componentName),
  );
}

/** The composition with this slug, or undefined when there is none. */
export function findComposition(slug: string): Composition | undefined {
  return COMPOSITIONS.find((composition) => composition.slug === slug);
}

/**
 * The homepage's content: the favorites, hand-picked in the Figma mock's
 * order, read row by row after the heading cell. The list is typed against
 * the slugs in components.ts, so a renamed or removed component fails the
 * type check here, and the live scenes in components/favorites/ are typed
 * against this list. The catalog itself carries no favorite flag.
 */
import { type ComponentCatalogRecord, getComponentsCatalog } from './catalog';
import type { ComponentSlug } from './components';

const FAVORITES = [
  'simplex-noise',
  'mesh-gradient',
  'wave-lines',
  'voronoi',
  'dither',
  'god-rays',
  'led-wall',
] as const satisfies readonly ComponentSlug[];

/** A favorite's slug. The live scenes in components/favorites are keyed by it. */
export type FavoriteSlug = (typeof FAVORITES)[number];

// Each favorite's card poster: its live scene's first frame, captured by
// scripts/build-posters.sh at the size the favorites render every scene, so
// the poster lines up with the scene that replaces it. A complete record, so
// a favorite with no card poster fails the type check.
const CARD_POSTERS: Record<FavoriteSlug, string> = {
  'simplex-noise': '/posters/simplex-noise-card.png',
  'mesh-gradient': '/posters/mesh-gradient-card.jpg',
  'wave-lines': '/posters/wave-lines-card.jpg',
  voronoi: '/posters/voronoi-card.jpg',
  dither: '/posters/dither-card.jpg',
  'god-rays': '/posters/god-rays-card.jpg',
  'led-wall': '/posters/led-wall-card.jpg',
};

/** A favorite's catalog record, with the slug that picks its live scene. */
export interface Favorite extends ComponentCatalogRecord {
  slug: FavoriteSlug;
  /** The URL of the favorite's card poster, from CARD_POSTERS. */
  poster: string;
}

/** The favorites' catalog records, in the order FAVORITES lists them. */
export async function getFavorites(): Promise<Favorite[]> {
  const catalog = await getComponentsCatalog();

  return FAVORITES.map((slug) => {
    const record = catalog.find((entry) => entry.url === `/components/${slug}`);

    // The slug type rules this out, so reaching it means the catalog and its
    // URLs have drifted apart.
    if (!record) throw new Error(`Favorite ${slug} has no catalog record.`);

    return { ...record, slug, poster: CARD_POSTERS[slug] };
  });
}

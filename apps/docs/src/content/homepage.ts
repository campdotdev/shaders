/**
 * The homepage's content: the favorites in the Figma mock's order, read row
 * by row after the heading cell, then the feature cards' copy. The
 * favorites are typed against the slugs in components.ts, so a renamed or
 * removed component fails the type check here. The catalog carries no
 * favorite flag.
 */
import { type ComponentCatalogRecord, getComponentsCatalog } from './catalog';
import type { ComponentSlug } from './components';

// ---- Favorites

// The live scenes in components/favorites/ are typed against this list.
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

// The short name each favorite's card tab shows. The catalog label, such as
// "Simplex Noise", runs longer than the strip the mock draws, so the card
// tab takes a name of its own. Every card tab is the mock's one length, and
// its swell holds a name up to about 60px long: God Rays, the longest here,
// is about 54px. favorites-card-tab.spec.ts fails on a name past that. A
// complete record, so a favorite with no short name fails the type check.
const SHORT_NAMES: Record<FavoriteSlug, string> = {
  'simplex-noise': 'Simplex',
  'mesh-gradient': 'Mesh',
  'wave-lines': 'Waves',
  voronoi: 'Voronoi',
  dither: 'Dither',
  'god-rays': 'God Rays',
  'led-wall': 'LED Wall',
};

/** A favorite's catalog record, with the slug that picks its live scene. */
export interface Favorite extends ComponentCatalogRecord {
  slug: FavoriteSlug;
  /** The URL of the favorite's card poster, from CARD_POSTERS. */
  poster: string;
  /** The short name the favorite's card tab shows, from SHORT_NAMES. */
  shortName: string;
}

/** The favorites' catalog records, in the order FAVORITES lists them. */
export async function getFavorites(): Promise<Favorite[]> {
  const catalog = await getComponentsCatalog();

  return FAVORITES.map((slug) => {
    const record = catalog.find((entry) => entry.url === `/components/${slug}`);

    // The slug type rules this out, so reaching it means the catalog and its
    // URLs have drifted apart.
    if (!record) throw new Error(`Favorite ${slug} has no catalog record.`);

    return { ...record, slug, poster: CARD_POSTERS[slug], shortName: SHORT_NAMES[slug] };
  });
}

// ---- Feature cards

/** Names a feature card. components/features picks its illustration by it. */
export type FeatureCardId = 'composable' | 'performant' | 'reactive' | 'extensible';

/** A feature card's copy. */
export interface FeatureCard {
  id: FeatureCardId;
  title: string;
  description: string;
}

/** The feature cards, in the mock's order, with the mock's copy. */
export const FEATURE_CARDS: readonly FeatureCard[] = [
  {
    id: 'composable',
    title: 'Composable',
    description: 'Stack shaders in a single scene to build the exact effect you want.',
  },
  {
    id: 'performant',
    title: 'Performant',
    description: 'Reduce browser overhead for your users with WebGPU rendering.',
  },
  {
    id: 'reactive',
    title: 'Reactive',
    description: 'Bring shaders to life with animation, cursor, and scroll inputs.',
  },
  {
    id: 'extensible',
    title: 'Extensible',
    description: 'Write your own shaders with the same TSL primitives our components use.',
  },
];

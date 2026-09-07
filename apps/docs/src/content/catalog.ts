import { cache } from 'react';

import { PRIMITIVES } from '@/data/primitives';

import { COMPONENTS } from './components';
import { groupByTaxonomy } from './taxonomy';
import type { CategorySlug, TaxonomyTier } from './taxonomy';

interface CatalogRecord {
  url: string;
  label: string;
  description: string;
  source: 'components' | 'primitives';
  order: number;
  tags: string[];
}

/* Component records also carry the leaf group the taxonomy files them
   under, which is what the sidebar groups by. Primitives have no taxonomy. */
export interface ComponentCatalogRecord extends CatalogRecord {
  source: 'components';
  category: CategorySlug;
}

function prettifySlug(slug: string): string {
  return slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// eslint-disable-next-line @typescript-eslint/require-await -- kept async so every catalog getter has one shape
export const getComponentsCatalog = cache(async (): Promise<ComponentCatalogRecord[]> => {
  // COMPONENTS is written in whatever order made sense to its author; the
  // catalog (sidebar, components index, search) presents slugs alphabetically.
  return Object.entries(COMPONENTS)
    .sort(([slugA], [slugB]) => slugA.localeCompare(slugB))
    .map(([slug, info], index) => ({
      url: `/components/${slug}`,
      label: prettifySlug(slug),
      description: info.description,
      source: 'components' as const,
      category: info.category,
      order: index * 10,
      tags: [],
    }));
});

// The components catalog folded into the sidebar's tiers and groups. The
// sidebar renders it and the component pages page through it, so both agree
// on what comes next.
export const getComponentsTree = cache(
  async (): Promise<Array<TaxonomyTier<ComponentCatalogRecord>>> =>
    groupByTaxonomy(await getComponentsCatalog()),
);

// eslint-disable-next-line @typescript-eslint/require-await -- kept async for parity with getComponentsCatalog and to allow future async additions
export const getPrimitivesCatalog = cache(async (): Promise<CatalogRecord[]> => {
  return PRIMITIVES.map((primitive, index) => ({
    url: `/primitives/${primitive.slug}`,
    label: primitive.name,
    description: primitive.description,
    source: 'primitives' as const,
    order: index * 10,
    tags: [],
  }));
});

export const getCatalogRecords = cache(
  async (source: 'components' | 'primitives'): Promise<CatalogRecord[]> => {
    if (source === 'components') return getComponentsCatalog();

    return getPrimitivesCatalog();
  },
);

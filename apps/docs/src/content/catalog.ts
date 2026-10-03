import { cache } from 'react';

import { COMPONENTS } from './components';
import type { ComponentMeta } from './components';
import { groupByTaxonomy } from './taxonomy';
import type { CategorySlug, TaxonomyTier } from './taxonomy';

interface CatalogRecord {
  url: string;
  label: string;
  description: string;
  order: number;
  tags: string[];
}

/* Component records also carry the leaf group the taxonomy files them
   under, which is what the sidebar groups by, and the component's JSX tag
   name, which the page header's Copy React writes into the copied snippet.
   The label is for reading ("Conic Gradient") and the tag name is for code
   ("ConicGradient"), so a page cannot use one for the other. The thumbnail
   is the URL of the small square the components index shows on each card. */
export interface ComponentCatalogRecord extends CatalogRecord {
  category: CategorySlug;
  componentName: string;
  thumbnail: string;
}

const capitalize = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

function prettifySlug(slug: string): string {
  return slug.split('-').map(capitalize).join(' ');
}

// The slug doubles as the component's folder name under
// packages/shaders/src/components, and every component there is named as
// the PascalCase of its folder, so the tag name derives from the slug too.
function pascalizeSlug(slug: string): string {
  return slug.split('-').map(capitalize).join('');
}

// scripts/build-posters.sh cuts every component's thumbnail from its poster
// and writes it beside the poster under the slug, whatever format the poster
// itself is, so the URL derives from the slug alone.
function thumbnailUrl(slug: string): string {
  return `/posters/${slug}.thumb.webp`;
}

// eslint-disable-next-line @typescript-eslint/require-await -- kept async so every catalog getter has one shape
export const getComponentsCatalog = cache(async (): Promise<ComponentCatalogRecord[]> => {
  // COMPONENTS is written in whatever order made sense to its author; the
  // catalog (sidebar, components index, search) presents slugs alphabetically.
  return (Object.entries(COMPONENTS) as Array<[string, ComponentMeta]>)
    .sort(([slugA], [slugB]) => slugA.localeCompare(slugB))
    .map(([slug, info], index) => ({
      url: `/components/${slug}`,
      label: info.label ?? prettifySlug(slug),
      componentName: pascalizeSlug(slug),
      thumbnail: thumbnailUrl(slug),
      description: info.description,
      category: info.category,
      order: index * 10,
      tags: [],
    }));
});

// The components catalog folded into the sidebar's tiers and groups. The
// sidebar and the components index render it and the component pages page
// through it, so all three agree on the order.
export const getComponentsTree = cache(
  async (): Promise<Array<TaxonomyTier<ComponentCatalogRecord>>> =>
    groupByTaxonomy(await getComponentsCatalog()),
);

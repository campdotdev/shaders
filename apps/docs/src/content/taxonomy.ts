/**
 * The component taxonomy: which leaf group each registry category belongs
 * to, which tier each group sits in, and how to fold a flat list of catalog
 * records into that tree. The registry stores one word per component and
 * this file owns everything else, so adding a group is one entry here plus
 * the enum in registry/registry.schema.json. The sidebar, prev and next
 * paging, and breadcrumbs all read the tree this builds. The decision record
 * is the "Component taxonomy" document in Linear.
 */

// ---- The table ----

/* Tuple order is the curated order: Sources before Effects before Motion,
   and within a tier the simpler groups first. Motion has no shipped group
   yet, so it is not listed; a tier appears here when its first group does.
   The tuples are also what z.enum checks the registry against, and the
   records beside them are typed so a slug cannot be added to one without
   the other. */
export const TIER_SLUGS = ['sources', 'effects'] as const;

export type TierSlug = (typeof TIER_SLUGS)[number];

export const TIERS: Record<TierSlug, { label: string }> = {
  sources: { label: 'Sources' },
  effects: { label: 'Effects' },
};

export const CATEGORY_SLUGS = [
  'gradients',
  'noise',
  'patterns',
  'scenes',
  'lens-film',
  'retro-glitch',
] as const;

export type CategorySlug = (typeof CATEGORY_SLUGS)[number];

export const CATEGORIES: Record<CategorySlug, { label: string; tier: TierSlug }> = {
  gradients: { label: 'Gradients', tier: 'sources' },
  noise: { label: 'Noise', tier: 'sources' },
  patterns: { label: 'Patterns', tier: 'sources' },
  scenes: { label: 'Scenes', tier: 'sources' },
  'lens-film': { label: 'Lens & Film', tier: 'effects' },
  'retro-glitch': { label: 'Retro & Glitch', tier: 'effects' },
};

// ---- The tree ----

export interface TaxonomyGroup<Record> {
  slug: CategorySlug;
  label: string;
  items: Record[];
}

export interface TaxonomyTier<Record> {
  slug: TierSlug;
  label: string;
  groups: Array<TaxonomyGroup<Record>>;
}

/**
 * Folds records into tiers of groups. Tiers and groups keep the table's
 * order, records sort alphabetically by label inside their group, and a
 * group or tier with nothing in it is left out rather than rendered empty.
 */
export function groupByTaxonomy<Record extends { category: CategorySlug; label: string }>(
  records: readonly Record[],
): Array<TaxonomyTier<Record>> {
  const tiers: Array<TaxonomyTier<Record>> = [];

  for (const tierSlug of TIER_SLUGS) {
    const groups: Array<TaxonomyGroup<Record>> = [];

    for (const categorySlug of CATEGORY_SLUGS) {
      const category = CATEGORIES[categorySlug];

      if (category.tier !== tierSlug) continue;
      const items = records
        .filter((record) => record.category === categorySlug)
        .sort((a, b) => a.label.localeCompare(b.label));

      if (items.length > 0) groups.push({ slug: categorySlug, label: category.label, items });
    }

    if (groups.length > 0) tiers.push({ slug: tierSlug, label: TIERS[tierSlug].label, groups });
  }

  return tiers;
}

/** The tree's records in reading order: tier by tier, group by group. Prev
 * and next paging walks this so a reader steps through the sidebar top to
 * bottom. */
export function flattenTaxonomy<Record>(tiers: ReadonlyArray<TaxonomyTier<Record>>): Record[] {
  return tiers.flatMap((tier) => tier.groups.flatMap((group) => group.items));
}

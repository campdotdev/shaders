import { describe, expect, it } from 'vitest';

import { CATEGORIES, groupByTaxonomy } from './taxonomy';

const record = (label: string, category: keyof typeof CATEGORIES) => ({ label, category });

describe('groupByTaxonomy', () => {
  it('nests records under their tier and leaf group in curated order, alphabetical within a group', () => {
    const tree = groupByTaxonomy([
      record('Vignette', 'lens-film'),
      record('Wave Lines', 'scenes'),
      record('Linear Gradient', 'gradients'),
      record('Aurora', 'scenes'),
      record('Conic Gradient', 'gradients'),
      record('Grain', 'lens-film'),
    ]);

    expect(tree.map((tier) => tier.label)).toEqual(['Sources', 'Effects']);
    expect(tree[0]?.groups.map((group) => group.label)).toEqual(['Gradients', 'Scenes']);
    expect(tree[0]?.groups[0]?.items.map((item) => item.label)).toEqual([
      'Conic Gradient',
      'Linear Gradient',
    ]);
    expect(tree[0]?.groups[1]?.items.map((item) => item.label)).toEqual(['Aurora', 'Wave Lines']);
    expect(tree[1]?.groups.map((group) => group.label)).toEqual(['Lens & Film']);
  });

  it('drops groups and tiers that have no records', () => {
    const tree = groupByTaxonomy([record('Dither', 'retro-glitch')]);

    expect(tree).toEqual([
      {
        slug: 'effects',
        label: 'Effects',
        groups: [
          {
            slug: 'retro-glitch',
            label: 'Retro & Glitch',
            items: [record('Dither', 'retro-glitch')],
          },
        ],
      },
    ]);
  });

  it('returns an empty tree for no records', () => {
    expect(groupByTaxonomy([])).toEqual([]);
  });
});

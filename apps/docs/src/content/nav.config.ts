import type { NavGroup } from './types';

export const NAV: NavGroup[] = [
  {
    label: 'Overview',
    sidebar: 'docs',
    items: [
      { kind: 'page', slug: '/getting-started' },
      { kind: 'page', slug: '/cli' },
      { kind: 'page', slug: '/changelog' },
      { kind: 'page', slug: '/examples' },
      { kind: 'link', label: 'Palette', url: '/palette' },
    ],
  },
  // The mock's components sidebar is the taxonomy tiers and nothing else,
  // so there is no Overview row: the index is reachable from the header.
  {
    label: 'Components',
    sidebar: 'components',
    items: [{ kind: 'taxonomy' }],
  },
  {
    label: 'Primitives',
    sidebar: 'primitives',
    items: [
      { kind: 'link', label: 'Overview', url: '/primitives' },
      { kind: 'catalog', source: 'primitives' },
    ],
  },
  {
    label: 'Guides',
    sidebar: 'docs',
    items: [{ kind: 'section', collectsFrom: 'guides' }],
  },
  {
    label: 'Frameworks',
    sidebar: 'docs',
    items: [
      {
        label: 'React',
        items: [
          { kind: 'page', slug: '/react/api' },
          { kind: 'section', collectsFrom: 'react.guides' },
        ],
      },
    ],
  },
  {
    label: 'Reference',
    sidebar: 'docs',
    items: [{ kind: 'section', collectsFrom: 'reference' }],
  },
];

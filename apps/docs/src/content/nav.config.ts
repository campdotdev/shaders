import type { NavGroup } from './types';

/**
 * The docs home, where the header's Docs link, the sidebar's first row, and
 * every Documentation breadcrumb lead. It is a route of its own rather than
 * an MDX page, because it lists this config (app/(docs-content)/docs/).
 */
export const DOCS_HOME_URL = '/docs';

export const NAV: NavGroup[] = [
  {
    label: 'Overview',
    sidebar: 'docs',
    items: [
      { kind: 'link', label: 'Documentation', url: DOCS_HOME_URL },
      { kind: 'page', slug: '/getting-started' },
      { kind: 'page', slug: '/cli' },
      { kind: 'page', slug: '/changelog' },
      { kind: 'link', label: 'Palette', url: '/palette' },
    ],
  },
  // The mock's components sidebar is the taxonomy categories and nothing
  // else, so there is no Overview row: the index is reachable from the
  // header.
  {
    label: 'Components',
    sidebar: 'components',
    items: [{ kind: 'taxonomy' }],
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

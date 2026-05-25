import type { NavGroup } from './types'

/**
 * Single source of truth for sidebar structure and ordering.
 *
 * Adding a framework later: add an MDX page with the right `section`,
 * then append a nested group under `Frameworks` here. No component changes.
 */
export const NAV: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { kind: 'page', slug: '/getting-started' },
      { kind: 'page', slug: '/cli' },
      { kind: 'page', slug: '/changelog' },
      { kind: 'page', slug: '/examples' },
    ],
  },
  {
    label: 'Components',
    items: [
      { kind: 'link', label: 'Overview', url: '/components' },
      { kind: 'catalog', source: 'components' },
    ],
  },
  {
    label: 'Primitives',
    items: [
      { kind: 'link', label: 'Overview', url: '/primitives' },
      { kind: 'catalog', source: 'primitives' },
    ],
  },
  {
    label: 'Guides',
    items: [{ kind: 'section', collectsFrom: 'guides' }],
  },
  {
    label: 'Frameworks',
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
    items: [{ kind: 'section', collectsFrom: 'reference' }],
  },
]

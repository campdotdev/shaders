import { cache } from 'react';

import { getCatalogRecords, getComponentsTree } from './catalog';
import { NAV } from './nav.config';
import { getMdxDocsPages } from './source';
import type {
  DocsBreadcrumb,
  DocsNeighbor,
  DocsPage,
  NavGroup,
  NavItem,
  ResolvedNavGroup,
  ResolvedNavItem,
  SidebarSection,
} from './types';

function isNavGroup(candidate: NavGroup | NavItem): candidate is NavGroup {
  return 'label' in candidate && 'items' in candidate;
}

function isResolvedGroup(
  candidate: ResolvedNavGroup | ResolvedNavItem,
): candidate is ResolvedNavGroup {
  return 'items' in candidate;
}

// Every item resolves to a list: a group to a list of one, a page or link to
// a list of one entry, and a section, catalog, or taxonomy to however many
// entries it expands to. The caller flattens, which splices expanded
// sections into their parent in order.
async function resolveItem(
  item: NavGroup | NavItem,
  pages: DocsPage[],
): Promise<Array<ResolvedNavGroup | ResolvedNavItem>> {
  if (isNavGroup(item)) {
    // Children resolve independently, so run them together; Promise.all
    // preserves item order.
    const resolvedChildren = await Promise.all(
      item.items.map((child) => resolveItem(child, pages)),
    );

    return [{ label: item.label, sidebar: item.sidebar, items: resolvedChildren.flat() }];
  }

  switch (item.kind) {
    case 'page': {
      const page = pages.find((candidatePage) => candidatePage.url === item.slug);

      if (!page || page.frontmatter.hidden) return [];

      return [{ label: page.frontmatter.navTitle, url: page.url }];
    }
    case 'link': {
      return [{ label: item.label, url: item.url }];
    }
    case 'section': {
      return pages
        .filter(
          (page) => page.frontmatter.section === item.collectsFrom && !page.frontmatter.hidden,
        )
        .map((page) => ({ label: page.frontmatter.navTitle, url: page.url }));
    }
    case 'catalog': {
      const records = await getCatalogRecords(item.source);

      return records.map((record) => ({ label: record.label, url: record.url }));
    }
    case 'taxonomy': {
      // Each tier becomes a group whose items are the leaf groups, so the
      // sidebar renders tier headers over group headers over rows, and
      // flatten() below gives MDX breadcrumbs the full trail if a component
      // ever needs one.
      const tiers = await getComponentsTree();

      return tiers.map((tier) => ({
        label: tier.label,
        items: tier.groups.map((group) => ({
          label: group.label,
          items: group.items.map((record) => ({ label: record.label, url: record.url })),
        })),
      }));
    }
  }
}

export const getDocsNavTree = cache(async (): Promise<ResolvedNavGroup[]> => {
  const pages = await getMdxDocsPages();
  const resolved = await Promise.all(NAV.map((group) => resolveItem(group, pages)));

  // Top-level entries are all groups, so the filter only narrows the type.
  return resolved.flat().filter(isResolvedGroup);
});

/**
 * The groups one sidebar shows. The components sidebar unwraps its single
 * group so the taxonomy tiers render as the top-level headers, as in the
 * mock; the other sections show their groups as they are.
 */
export const getDocsSidebarTree = cache(
  async (section: SidebarSection): Promise<ResolvedNavGroup[]> => {
    const groups = (await getDocsNavTree()).filter((group) => group.sidebar === section);

    if (section !== 'components') return groups;

    return groups.flatMap((group) => group.items.filter(isResolvedGroup));
  },
);

interface FlatEntry {
  url: string;
  label: string;
  trail: string[];
}

function flatten(groups: ResolvedNavGroup[], trail: string[] = []): FlatEntry[] {
  const out: FlatEntry[] = [];

  for (const group of groups) {
    const groupTrail = [...trail, group.label];

    for (const item of group.items) {
      if ('items' in item) {
        out.push(...flatten([item], groupTrail));
      } else {
        out.push({ url: item.url, label: item.label, trail: groupTrail });
      }
    }
  }

  return out;
}

export const getDocsPrevNext = cache(
  async (page: DocsPage): Promise<{ prev: DocsNeighbor | null; next: DocsNeighbor | null }> => {
    const tree = await getDocsNavTree();
    const flat = flatten(tree);
    const idx = flat.findIndex((item) => item.url === page.url);

    if (idx === -1) return { prev: null, next: null };
    const prev = idx > 0 ? flat[idx - 1] : undefined;
    const next = idx < flat.length - 1 ? flat[idx + 1] : undefined;

    return {
      prev: prev ? { url: prev.url, label: prev.label } : null,
      next: next ? { url: next.url, label: next.label } : null,
    };
  },
);

export const getDocsBreadcrumbs = cache(async (page: DocsPage): Promise<DocsBreadcrumb[]> => {
  const tree = await getDocsNavTree();
  const flat = flatten(tree);
  const item = flat.find((i) => i.url === page.url);

  if (!item) return [{ label: page.frontmatter.navTitle, url: page.url }];

  return [
    ...item.trail.map((label) => ({ label, url: null })),
    { label: page.frontmatter.navTitle, url: page.url },
  ];
});

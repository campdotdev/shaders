import { cache } from 'react';

import { getCatalogRecords } from './catalog';
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
} from './types';

function isNavGroup(candidate: NavGroup | NavItem): candidate is NavGroup {
  return 'label' in candidate && 'items' in candidate;
}

async function resolveItem(
  item: NavGroup | NavItem,
  pages: DocsPage[],
): Promise<ResolvedNavGroup | ResolvedNavItem[]> {
  if (isNavGroup(item)) {
    // Children resolve independently, so run them together; Promise.all
    // preserves item order, and flat() splices expanded sections (which
    // resolve to arrays) into the group the same way sequential pushes did.
    const resolvedChildren = await Promise.all(
      item.items.map((child) => resolveItem(child, pages)),
    );

    return { label: item.label, items: resolvedChildren.flat() };
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
  }
}

export const getDocsNavTree = cache(async (): Promise<ResolvedNavGroup[]> => {
  const pages = await getMdxDocsPages();
  // Top-level entries are all groups; resolveItem only returns an array for
  // bare items, so the filter keeps the same shape the sequential loop built.
  const resolved = await Promise.all(NAV.map((group) => resolveItem(group, pages)));

  return resolved.filter((group): group is ResolvedNavGroup => !Array.isArray(group));
});

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

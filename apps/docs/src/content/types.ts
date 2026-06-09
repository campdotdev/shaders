export type DocsSection = 'overview' | 'guides' | 'react.guides' | 'react.api' | 'reference';

export type DocsStatus = 'draft' | 'ready';

export interface DocsFrontmatter {
  title: string;
  description: string;
  section: DocsSection;
  order: number;
  navTitle: string;
  hidden: boolean;
  status: DocsStatus;
  tags: string[];
}

export interface DocsHeading {
  id: string;
  text: string;
  depth: 2 | 3;
}

export interface DocsPage {
  url: string;
  slugs: string[];
  sourcePath: string;
  body: string;
  frontmatter: DocsFrontmatter;
  headings: DocsHeading[];
}

export interface DocsSearchDocument {
  url: string;
  title: string;
  description: string;
  section: string;
  headings: string[];
  tags: string[];
}

export type NavItem =
  | { kind: 'page'; slug: string }
  | { kind: 'link'; label: string; url: string }
  | { kind: 'section'; collectsFrom: DocsSection }
  | { kind: 'catalog'; source: 'components' | 'primitives' };

export interface NavGroup {
  label: string;
  items: Array<NavGroup | NavItem>;
}

export interface ResolvedNavItem {
  label: string;
  url: string;
}

export interface ResolvedNavGroup {
  label: string;
  items: Array<ResolvedNavGroup | ResolvedNavItem>;
}

export interface DocsBreadcrumb {
  label: string;
  url: string | null;
}

export interface DocsNeighbor {
  label: string;
  url: string;
}

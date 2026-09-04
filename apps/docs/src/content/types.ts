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

/** Which sidebar a top-level nav group belongs to. Each docs layout renders
 * only its own section's groups, so a component page shows the component
 * tiers and nothing else. */
export type SidebarSection = 'components' | 'primitives' | 'docs';

export type NavItem =
  | { kind: 'page'; slug: string }
  | { kind: 'link'; label: string; url: string }
  | { kind: 'section'; collectsFrom: DocsSection }
  | { kind: 'catalog'; source: 'components' | 'primitives' }
  /** The components catalog folded into taxonomy tiers, each a group of groups. */
  | { kind: 'taxonomy' };

export interface NavGroup {
  label: string;
  /** Set on top-level groups only; nested groups inherit their parent's sidebar. */
  sidebar?: SidebarSection;
  items: Array<NavGroup | NavItem>;
}

export interface ResolvedNavItem {
  label: string;
  url: string;
}

export interface ResolvedNavGroup {
  label: string;
  sidebar?: SidebarSection;
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

/**
 * Renders one docs page as markdown for the /md/ route
 * (app/md/[...slug]/route.ts), which the header menu's "Copy as markdown"
 * and "View as markdown" rows read (components/page-actions/). A component
 * page is assembled from its catalog record, the demo registry's usage
 * snippet, and its props table rows. A prose page returns its MDX body.
 * The two renderers are pure, so they test with literals, and
 * renderPageMarkdown takes its data sources as an argument: importing the
 * demo registry here would pull every demo island, and with them
 * three/webgpu, into module scope, which cannot load under Vitest's Node
 * environment (see vitest.config.ts).
 */
import { deriveUsageImport } from '@/lib/usage-import';

import type { ComponentCatalogRecord } from './catalog';
import type { PropRow } from './props';
import type { DocsPage } from './types';

// ---------------------------------------------
// Data sources
// ---------------------------------------------

/**
 * What renderPageMarkdown reads. The route passes the real getters and
 * COMPONENT_PAGES; tests pass literals.
 */
export interface MarkdownSources {
  getDocsPage: (slugs: string[]) => Promise<DocsPage | null>;
  getComponentsCatalog: () => Promise<ComponentCatalogRecord[]>;
  getComponentProps: (slug: string) => Promise<PropRow[]>;
  /** Keyed by component slug. Only the usage snippet is read. */
  componentPages: Record<string, { usageSnippet: string }>;
}

// ---------------------------------------------
// Table cells
// ---------------------------------------------

// A pipe ends the cell in a GFM table, and type text is full of them
// (`AnimatableProp<number> | string`). Escaping every pipe keeps the column
// count honest, and GFM honors the escape inside a code span too. A newline
// would also break a cell, but props.ts collapses description whitespace
// and sets defaultSummary only for one-line defaults, so none reach here.
export function escapeTableCell(text: string): string {
  return text.replace(/\|/g, '\\|');
}

function code(text: string): string {
  return `\`${escapeTableCell(text)}\``;
}

function fence(lang: string, body: string): string {
  return ['```' + lang, body, '```'].join('\n');
}

// ---------------------------------------------
// Component pages
// ---------------------------------------------

const TABLE_HEADER = ['| Prop | Type | Default | Description |', '| --- | --- | --- | --- |'];

// The table shows a default only when it fits one line (defaultSummary). A
// longer default, such as a resolved stops array, is listed under the table
// in its own code block, and the cell says where to look.
function defaultCell(row: PropRow): string {
  if (row.defaultSummary !== undefined) return code(row.defaultSummary);
  if (row.defaultValue !== undefined) return 'see below';

  return '';
}

export function renderComponentMarkdown(
  record: ComponentCatalogRecord,
  entry: { usageSnippet: string },
  props: PropRow[],
): string {
  const tableRows = props.map(
    (row) =>
      `| ${code(row.name)} | ${code(row.type)} | ${defaultCell(row)} | ${escapeTableCell(row.description)} |`,
  );
  const longDefaults = props.flatMap((row) =>
    row.defaultValue !== undefined && row.defaultSummary === undefined
      ? [{ name: row.name, defaultValue: row.defaultValue }]
      : [],
  );

  // The demo cannot cross into markdown, so a link to the page stands in
  // for it. It is site-relative because the site has no configured origin.
  const sections = [
    `# ${record.label}`,
    record.description,
    `[Live demo](${record.url})`,
    '## Usage',
    fence('tsx', `${deriveUsageImport(entry.usageSnippet)}\n\n${entry.usageSnippet}`),
    '## API Reference',
    [...TABLE_HEADER, ...tableRows].join('\n'),
  ];

  if (longDefaults.length > 0) {
    sections.push('### Defaults too long for the table');

    for (const { name, defaultValue } of longDefaults) {
      sections.push(`\`${name}\`:`, fence('tsx', defaultValue));
    }
  }

  return `${sections.join('\n\n')}\n`;
}

// ---------------------------------------------
// Prose pages
// ---------------------------------------------

// Every file under content/docs opens its body with an h1 that matches its
// frontmatter title, so the body is the whole document. The title is added
// only for a future page that omits its own.
export function renderDocMarkdown(page: DocsPage): string {
  const body = page.body.trim();

  if (body.startsWith('# ')) return `${body}\n`;

  return `# ${page.frontmatter.title}\n\n${body}\n`;
}

// ---------------------------------------------
// Lookup
// ---------------------------------------------

/** Renders the page at `slugs`, or null when no page lives there. */
export async function renderPageMarkdown(
  slugs: string[],
  sources: MarkdownSources,
): Promise<string | null> {
  const [head, slug, ...rest] = slugs;

  if (head === 'components') {
    if (slug === undefined || rest.length > 0) return null;
    const entry = sources.componentPages[slug];

    if (entry === undefined) return null;
    const record = (await sources.getComponentsCatalog()).find(
      (candidate) => candidate.url === `/components/${slug}`,
    );

    if (record === undefined) return null;

    return renderComponentMarkdown(record, entry, await sources.getComponentProps(slug));
  }

  const page = await sources.getDocsPage(slugs);

  return page === null ? null : renderDocMarkdown(page);
}

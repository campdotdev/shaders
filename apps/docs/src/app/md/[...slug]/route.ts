/**
 * Static markdown for every docs page, at the page's own path under /md/
 * with a .md suffix: /components/aurora is served at
 * /md/components/aurora.md. The header menu's "Copy as markdown" fetches
 * it and "View as markdown" links to it (components/page-actions/).
 * Rendering lives in content/markdown.ts. This file lists the pages, wires
 * the real data sources in, and adds the suffix, which exists so a static
 * host serves the file with a text content type rather than as a download.
 * The site is a static export, so force-static writes one file per param
 * at build.
 */
import { getComponentsCatalog } from '@/content/catalog';
import { renderPageMarkdown } from '@/content/markdown';
import { getComponentProps } from '@/content/props';
import { getDocsPage, getDocsStaticParams } from '@/content/source';

import { COMPONENT_PAGES } from '../../components/demo-registry';

export const dynamic = 'force-static';
export const dynamicParams = false;

const SUFFIX = '.md';

function withSuffix(slugs: string[]): string[] {
  const last = slugs.at(-1);

  if (last === undefined) return slugs;

  return [...slugs.slice(0, -1), `${last}${SUFFIX}`];
}

// Component slugs come from the registry, the same source the component
// page reads, and prose slugs from getDocsStaticParams, so a markdown file
// exists exactly where a page exists. getDocsStaticParams drops hidden
// pages and keeps drafts, which matches the page and not the search index.
export async function generateStaticParams(): Promise<Array<{ slug: string[] }>> {
  const components = Object.keys(COMPONENT_PAGES).map((slug) => ({
    slug: withSuffix(['components', slug]),
  }));
  const docs = (await getDocsStaticParams()).map(({ slug }) => ({ slug: withSuffix(slug) }));

  return [...components, ...docs];
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string[] }> },
): Promise<Response> {
  const { slug } = await params;
  const last = slug.at(-1);

  if (last?.endsWith(SUFFIX) !== true) {
    return new Response('Not found', { status: 404 });
  }

  const markdown = await renderPageMarkdown([...slug.slice(0, -1), last.slice(0, -SUFFIX.length)], {
    getDocsPage,
    getComponentsCatalog,
    getComponentProps,
    componentPages: COMPONENT_PAGES,
  });

  if (markdown === null) return new Response('Not found', { status: 404 });

  return new Response(markdown, {
    headers: { 'content-type': 'text/markdown; charset=utf-8' },
  });
}

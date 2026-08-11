import { cache } from 'react';

import matter from 'gray-matter';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import { parseFrontmatter } from './schema';
import { extractHeadings } from './toc';
import type { DocsPage } from './types';

const CONTENT_ROOT = path.join(process.cwd(), 'content', 'docs');

async function walkMdx(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });

  // Subdirectories walk independently, so descend into all of them together
  // instead of one at a time. Each entry maps to its list of .mdx paths
  // (empty for skips), and flat() stitches them back in readdir order —
  // though callers sort by frontmatter anyway, so order carries no meaning.
  const nested = await Promise.all(
    entries.map(async (entry) => {
      if (entry.name.startsWith('_')) return [];
      const full = path.join(dir, entry.name);

      if (entry.isDirectory()) return walkMdx(full);
      if (entry.isFile() && entry.name.endsWith('.mdx')) return [full];

      return [];
    }),
  );

  return nested.flat();
}

function fileToUrl(absolute: string): { url: string; slugs: string[] } {
  const rel = path.relative(CONTENT_ROOT, absolute).replace(/\.mdx$/, '');
  const cleaned = rel.replace(/\/index$/, '');
  const slugs = cleaned.split(path.sep);

  return { url: '/' + slugs.join('/'), slugs };
}

export const getMdxDocsPages = cache(async (): Promise<DocsPage[]> => {
  let files: string[];

  try {
    files = await walkMdx(CONTENT_ROOT);
  } catch (caughtError) {
    if (caughtError instanceof Error && 'code' in caughtError && caughtError.code === 'ENOENT')
      return [];
    throw caughtError;
  }

  // Every page parses independently, so read them all concurrently; the
  // sort below is what establishes page order, not the read order.
  const pages: DocsPage[] = await Promise.all(
    files.map(async (filePath) => {
      const raw = await fs.readFile(filePath, 'utf8');
      const { data, content } = matter(raw);
      const frontmatter = parseFrontmatter(data, filePath);
      const { url, slugs } = fileToUrl(filePath);
      const headings = extractHeadings(content);

      return {
        url,
        slugs,
        sourcePath: filePath,
        body: content,
        frontmatter,
        headings,
      };
    }),
  );

  pages.sort((a, b) => {
    const sectionComparison = a.frontmatter.section.localeCompare(b.frontmatter.section);

    if (sectionComparison !== 0) return sectionComparison;
    const orderDifference = a.frontmatter.order - b.frontmatter.order;

    if (orderDifference !== 0) return orderDifference;

    return a.frontmatter.title.localeCompare(b.frontmatter.title);
  });

  return pages;
});

export const getDocsPage = cache(async (slugs: string[]): Promise<DocsPage | null> => {
  const pages = await getMdxDocsPages();
  const target = '/' + slugs.join('/');

  return pages.find((page) => page.url === target) ?? null;
});

export const getDocsStaticParams = cache(async () => {
  const pages = await getMdxDocsPages();

  return pages.filter((page) => !page.frontmatter.hidden).map((page) => ({ slug: page.slugs }));
});

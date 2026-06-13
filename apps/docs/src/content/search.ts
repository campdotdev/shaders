import { cache } from 'react';

import { getComponentsCatalog, getPrimitivesCatalog } from './catalog';
import { getMdxDocsPages } from './source';
import type { DocsSearchDocument } from './types';

export const getDocsSearchDocuments = cache(async (): Promise<DocsSearchDocument[]> => {
  const [pages, components, primitives] = await Promise.all([
    getMdxDocsPages(),
    getComponentsCatalog(),
    getPrimitivesCatalog(),
  ]);

  const mdxDocs: DocsSearchDocument[] = pages
    .filter((page) => !page.frontmatter.hidden && page.frontmatter.status !== 'draft')
    .map((page) => ({
      url: page.url,
      title: page.frontmatter.title,
      description: page.frontmatter.description,
      section: page.frontmatter.section,
      headings: page.headings.map((heading) => heading.text),
      tags: page.frontmatter.tags,
    }));

  const catalogDocs: DocsSearchDocument[] = [
    ...components.map((component) => ({
      url: component.url,
      title: component.label,
      description: component.description,
      section: 'components',
      headings: [],
      tags: component.tags,
    })),
    ...primitives.map((primitive) => ({
      url: primitive.url,
      title: primitive.label,
      description: primitive.description,
      section: 'primitives',
      headings: [],
      tags: primitive.tags,
    })),
  ];

  return [...mdxDocs, ...catalogDocs];
});

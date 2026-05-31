import { cache } from 'react'

import { getComponentsCatalog, getPrimitivesCatalog } from './catalog'
import { getMdxDocsPages } from './source'
import type { DocsSearchDocument } from './types'

export const getDocsSearchDocuments = cache(async (): Promise<DocsSearchDocument[]> => {
  const [pages, components, primitives] = await Promise.all([
    getMdxDocsPages(),
    getComponentsCatalog(),
    getPrimitivesCatalog(),
  ])

  const mdxDocs: DocsSearchDocument[] = pages
    .filter((p) => !p.frontmatter.hidden && p.frontmatter.status !== 'draft')
    .map((p) => ({
      url: p.url,
      title: p.frontmatter.title,
      description: p.frontmatter.description,
      section: p.frontmatter.section,
      headings: p.headings.map((h) => h.text),
      tags: p.frontmatter.tags,
    }))

  const catalogDocs: DocsSearchDocument[] = [
    ...components.map((c) => ({
      url: c.url,
      title: c.label,
      description: c.description,
      section: 'components',
      headings: [],
      tags: c.tags,
    })),
    ...primitives.map((p) => ({
      url: p.url,
      title: p.label,
      description: p.description,
      section: 'primitives',
      headings: [],
      tags: p.tags,
    })),
  ]

  return [...mdxDocs, ...catalogDocs]
})

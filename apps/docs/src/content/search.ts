import { cache } from 'react'
import { getMdxDocsPages } from './source'
import type { DocsSearchDocument } from './types'

export const getDocsSearchDocuments = cache(
  async (): Promise<DocsSearchDocument[]> => {
    const pages = await getMdxDocsPages()
    return pages
      .filter(
        (p) => !p.frontmatter.hidden && p.frontmatter.status !== 'draft',
      )
      .map((p) => ({
        url: p.url,
        title: p.frontmatter.title,
        description: p.frontmatter.description,
        section: p.frontmatter.section,
        headings: p.headings.map((h) => h.text),
        tags: p.frontmatter.tags,
      }))
  },
)
